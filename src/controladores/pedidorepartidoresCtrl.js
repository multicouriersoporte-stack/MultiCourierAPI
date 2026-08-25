// src/controladores/pedidorepartidoresCtrl.js

import { conmysql } from "../db.js";

// Configuración de asignación.
const RADIOS_ASIGNACION = [3, 6, 10, 16];
const MAX_ANTIGUEDAD_UBICACION_MINUTOS = 3;
const VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS = 5;
const DIFERENCIA_PEDIDOS_RANKING = 5;
const ESTADOS_REPARTIDOR_DISPONIBLES = ["LISTO", "REPARTIENDO"];
const ESTADO_PEDIDO_PENDIENTE = 10;
const ESTADO_PEDIDO_ASIGNADO = 13;
const ESTADO_ASIGNACION_ACTIVA = 13;

// Asigna automáticamente el repartidor más adecuado al pedido.
export const asignarRepartidorAutomaticamente = async (id_pedido) => {
    const conexion = await conmysql.getConnection();

    try {
        await conexion.beginTransaction();

        // 1. Obtener y bloquear el pedido.
        const [pedidos] = await conexion.query(`
            SELECT p.id_pedido, p.pedido_codigo, p.id_cliente, p.id_local, p.id_repartidor,
                   p.id_estado, p.pedido_fecha, p.pedido_total, p.pedido_carrera,
                   p.pedido_local_latitud, p.pedido_local_longitud,
                   p.pedido_cliente_latitud, p.pedido_cliente_longitud
            FROM pedidos p
            WHERE p.id_pedido = ? FOR UPDATE
        `, [id_pedido]);

        if (!pedidos.length) throw new Error("El pedido no existe");

        const pedido = pedidos[0];

        // 2. Evitar reasignar pedidos que ya tienen repartidor.
        if (pedido.id_repartidor !== null) {
            await conexion.rollback();
            return { asignado: false, motivo: "El pedido ya tiene un repartidor asignado", id_repartidor: pedido.id_repartidor };
        }

        if (pedido.pedido_local_latitud === null || pedido.pedido_local_longitud === null) {
            await conexion.rollback();
            return { asignado: false, motivo: "El pedido no tiene coordenadas válidas del local" };
        }

        // 3. Verificar que no exista una asignación activa.
        const [asignaciones] = await conexion.query(`
            SELECT id_pedido_repartidor, id_repartidor, id_estado
            FROM pedido_repartidores
            WHERE id_pedido = ? AND id_estado = ?
            LIMIT 1 FOR UPDATE
        `, [id_pedido, ESTADO_ASIGNACION_ACTIVA]);

        if (asignaciones.length) {
            await conexion.rollback();
            return { asignado: false, motivo: "El pedido ya tiene una asignación activa" };
        }

        // 4. Un pedido de mayor valor dentro de la ventana tiene prioridad.
        const [pedidosSimultaneos] = await conexion.query(`
            SELECT p2.id_pedido, p2.pedido_codigo, p2.pedido_total, p2.pedido_fecha
            FROM pedidos p2
            WHERE p2.id_estado = ? AND p2.id_repartidor IS NULL AND p2.id_pedido <> ?
              AND p2.pedido_fecha BETWEEN DATE_SUB(?, INTERVAL ? MINUTE) AND DATE_ADD(?, INTERVAL ? MINUTE)
            ORDER BY p2.pedido_total DESC, p2.pedido_fecha ASC, p2.id_pedido ASC
        `, [
            ESTADO_PEDIDO_PENDIENTE,
            id_pedido,
            pedido.pedido_fecha,
            VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS,
            pedido.pedido_fecha,
            VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS
        ]);

        const pedidoDeMayorValor = pedidosSimultaneos.find(
            otro => Number(otro.pedido_total || 0) > Number(pedido.pedido_total || 0)
        );

        if (pedidoDeMayorValor) {
            await conexion.rollback();
            return {
                asignado: false,
                motivo: "El pedido espera porque existe otro pedido simultáneo de mayor valor",
                pedido_prioritario: {
                    id_pedido: pedidoDeMayorValor.id_pedido,
                    pedido_codigo: pedidoDeMayorValor.pedido_codigo,
                    pedido_total: Number(pedidoDeMayorValor.pedido_total || 0)
                }
            };
        }

        // 5. Obtener repartidores activos con ubicación reciente.
        const [repartidores] = await conexion.query(`
            SELECT r.id_repartidor, r.id_usuario, r.repartidor_codigo,
                   r.repartidor_posicion_ranking, r.repartidor_total_pedidos,
                   r.repartidor_puntos, r.repartidor_calificacion, r.id_estado_repartidor,
                   er.estado_repartidor_nombre, er.estado_repartidor_permite_pedidos,
                   er.estado_repartidor_permite_seleccion, ru.repartidor_ubicacion_latitud,
                   ru.repartidor_ubicacion_longitud, ru.repartidor_ubicacion_fecha,
                   (6371 * ACOS(LEAST(1, GREATEST(-1,
                       COS(RADIANS(?)) * COS(RADIANS(ru.repartidor_ubicacion_latitud)) *
                       COS(RADIANS(ru.repartidor_ubicacion_longitud) - RADIANS(?)) +
                       SIN(RADIANS(?)) * SIN(RADIANS(ru.repartidor_ubicacion_latitud))
                   )))) AS distancia_km
            FROM repartidores r
            INNER JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor
            INNER JOIN (
                SELECT ru1.*
                FROM repartidor_ubicaciones ru1
                INNER JOIN (
                    SELECT id_repartidor, MAX(id_repartidor_ubicacion) AS ultima_ubicacion
                    FROM repartidor_ubicaciones GROUP BY id_repartidor
                ) ultima ON ru1.id_repartidor_ubicacion = ultima.ultima_ubicacion
            ) ru ON r.id_repartidor = ru.id_repartidor
            WHERE er.estado_repartidor_estado = 1
              AND er.estado_repartidor_nombre IN ('LISTO', 'REPARTIENDO')
              AND er.estado_repartidor_permite_pedidos = 1
              AND ru.repartidor_ubicacion_fecha >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `, [
            pedido.pedido_local_latitud,
            pedido.pedido_local_longitud,
            pedido.pedido_local_latitud,
            MAX_ANTIGUEDAD_UBICACION_MINUTOS
        ]);

        if (!repartidores.length) {
            await conexion.rollback();
            return { asignado: false, motivo: "No existen repartidores LISTO o REPARTIENDO con ubicación reciente" };
        }

        // 6. Seleccionar el primer radio que tenga candidatos.
        let candidatos = [];
        let radioSeleccionado = null;

        for (const radio of RADIOS_ASIGNACION) {
            candidatos = repartidores.filter(r => Number(r.distancia_km) <= radio);
            if (candidatos.length) {
                radioSeleccionado = radio;
                break;
            }
        }

        if (!candidatos.length) {
            await conexion.rollback();
            return { asignado: false, motivo: "No existe repartidor disponible dentro de 16 km" };
        }

        // 7. Ordenar: distancia, ranking, pedidos, puntos, calificación e ID.
        candidatos.sort((a, b) => {
            const distanciaA = Number(a.distancia_km || 999999);
            const distanciaB = Number(b.distancia_km || 999999);
            if (distanciaA !== distanciaB) return distanciaA - distanciaB;

            const pedidosA = Number(a.repartidor_total_pedidos || 0);
            const pedidosB = Number(b.repartidor_total_pedidos || 0);

            if (Math.abs(pedidosA - pedidosB) <= DIFERENCIA_PEDIDOS_RANKING) {
                const rankingA = Number(a.repartidor_posicion_ranking ?? 999999);
                const rankingB = Number(b.repartidor_posicion_ranking ?? 999999);
                if (rankingA !== rankingB) return rankingA - rankingB;
            }

            if (pedidosA !== pedidosB) return pedidosA - pedidosB;

            const puntosA = Number(a.repartidor_puntos || 0);
            const puntosB = Number(b.repartidor_puntos || 0);
            if (puntosA !== puntosB) return puntosB - puntosA;

            const calificacionA = Number(a.repartidor_calificacion || 0);
            const calificacionB = Number(b.repartidor_calificacion || 0);
            if (calificacionA !== calificacionB) return calificacionB - calificacionA;

            return Number(a.id_repartidor) - Number(b.id_repartidor);
        });

        const repartidor = candidatos[0];

        // 8. Bloquear nuevamente al repartidor para evitar condiciones de carrera.
        const [repartidorBloqueado] = await conexion.query(`
            SELECT r.id_repartidor, r.id_estado_repartidor,
                   er.estado_repartidor_nombre, er.estado_repartidor_permite_pedidos
            FROM repartidores r
            INNER JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor
            WHERE r.id_repartidor = ? FOR UPDATE
        `, [repartidor.id_repartidor]);

        if (!repartidorBloqueado.length) throw new Error("El repartidor seleccionado ya no existe");

        const repartidorActual = repartidorBloqueado[0];
        const estadoRepartidor = String(repartidorActual.estado_repartidor_nombre).toUpperCase();

        if (!ESTADOS_REPARTIDOR_DISPONIBLES.includes(estadoRepartidor)) {
            await conexion.rollback();
            return { asignado: false, motivo: "El repartidor seleccionado ya no está disponible" };
        }

        if (Number(repartidorActual.estado_repartidor_permite_pedidos) !== 1) {
            await conexion.rollback();
            return { asignado: false, motivo: "El repartidor seleccionado no puede recibir pedidos" };
        }

        // 9. Crear la asignación.
        const [insert] = await conexion.query(`
            INSERT INTO pedido_repartidores (
                id_pedido, id_repartidor, pedido_repartidor_fecha_solicitud,
                pedido_repartidor_fecha_asignacion, pedido_repartidor_prioridad,
                pedido_repartidor_es_seleccion_cliente, pedido_repartidor_costo_seleccion,
                pedido_repartidor_orden_simultaneo, id_estado
            )
            VALUES (?, ?, ?, NOW(), 0, 0, 0, 1, ?)
        `, [id_pedido, repartidor.id_repartidor, pedido.pedido_fecha, ESTADO_ASIGNACION_ACTIVA]);

        // 10. Asociar el repartidor y cambiar el estado del pedido.
        await conexion.query(`
            UPDATE pedidos
            SET id_repartidor = ?, id_estado = ?
            WHERE id_pedido = ? AND id_repartidor IS NULL AND id_estado = ?
        `, [
            repartidor.id_repartidor,
            ESTADO_PEDIDO_ASIGNADO,
            id_pedido,
            ESTADO_PEDIDO_PENDIENTE
        ]);

        await conexion.commit();

        // 11. Devolver información de la asignación.
        return {
            asignado: true,
            id_pedido,
            pedido_codigo: pedido.pedido_codigo,
            id_pedido_repartidor: insert.insertId,
            id_repartidor: repartidor.id_repartidor,
            repartidor_codigo: repartidor.repartidor_codigo,
            estado_repartidor: repartidorActual.estado_repartidor_nombre,
            distancia_km: Number(Number(repartidor.distancia_km).toFixed(3)),
            radio_asignacion_km: radioSeleccionado,
            pedido_total: Number(pedido.pedido_total || 0)
        };
    } catch (error) {
        try {
            await conexion.rollback();
        } catch (rollbackError) {
            console.error("Error rollback asignación:", rollbackError);
        }

        console.error("Error asignarRepartidorAutomaticamente:", error);
        throw error;
    } finally {
        conexion.release();
    }
};
