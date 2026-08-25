// src/controladores/pedidorepartidoresCtrl.js

import { conmysql } from "../db.js";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const RADIOS_ASIGNACION = [3, 6, 10, 16];
const MAX_ANTIGUEDAD_UBICACION_MINUTOS = 3;
const VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS = 5;
const DIFERENCIA_PEDIDOS_RANKING = 5;
const ESTADOS_REPARTIDOR_DISPONIBLES = ["LISTO", "REPARTIENDO"];

// Estados: 10 = PENDIENTE, 13 = ASIGNADO.
const ESTADO_PEDIDO_PENDIENTE = 10;
const ESTADO_PEDIDO_ASIGNADO = 13;
const ESTADO_ASIGNACION_ACTIVA = 13;

// ============================================================
// UTILIDADES
// ============================================================

const numeroSeguro = (valor, defecto = 0) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : defecto;
};

const coordenadaValida = (latitud, longitud) => {
    const lat = Number(latitud);
    const lng = Number(longitud);

    return Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
};

// ============================================================
// ASIGNACIÓN AUTOMÁTICA
// ============================================================

export const asignarRepartidorAutomaticamente = async (id_pedido) => {
    const conexion = await conmysql.getConnection();
    let transaccionIniciada = false;

    try {
        await conexion.beginTransaction();
        transaccionIniciada = true;

        // 1. Obtener y bloquear el pedido.
        const [pedidos] = await conexion.query(`
            SELECT
                p.id_pedido, p.pedido_codigo,
                p.id_cliente, p.id_local, p.id_repartidor, p.id_estado,
                p.pedido_fecha, p.pedido_total, p.pedido_carrera,
                p.pedido_local_latitud, p.pedido_local_longitud,
                p.pedido_cliente_latitud, p.pedido_cliente_longitud
            FROM pedidos p
            WHERE p.id_pedido = ?
            FOR UPDATE
        `, [id_pedido]);

        if (!pedidos.length) throw new Error("El pedido no existe");

        const pedido = pedidos[0];

        // 2. Solo los pedidos pendientes entran en asignación.
        if (Number(pedido.id_estado) !== ESTADO_PEDIDO_PENDIENTE) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido no se encuentra en estado PENDIENTE",
                id_estado: pedido.id_estado
            };
        }

        // Evita reasignaciones.
        if (pedido.id_repartidor !== null && pedido.id_repartidor !== undefined) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido ya tiene un repartidor asignado",
                id_repartidor: pedido.id_repartidor
            };
        }

        // 3. El local debe tener coordenadas válidas.
        if (!coordenadaValida(
            pedido.pedido_local_latitud,
            pedido.pedido_local_longitud
        )) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido no tiene coordenadas válidas del local"
            };
        }

        // 4. Evitar asignaciones duplicadas.
        const [asignaciones] = await conexion.query(`
            SELECT id_pedido_repartidor, id_repartidor, id_estado
            FROM pedido_repartidores
            WHERE id_pedido = ? AND id_estado = ?
            LIMIT 1
            FOR UPDATE
        `, [id_pedido, ESTADO_ASIGNACION_ACTIVA]);

        if (asignaciones.length) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido ya tiene una asignación activa",
                id_pedido_repartidor: asignaciones[0].id_pedido_repartidor,
                id_repartidor: asignaciones[0].id_repartidor
            };
        }

        // 5. Si existe otro pedido simultáneo de mayor valor, espera.
        const [pedidosSimultaneos] = await conexion.query(`
            SELECT
                p2.id_pedido,
                p2.pedido_codigo,
                p2.pedido_total,
                p2.pedido_fecha
            FROM pedidos p2
            WHERE p2.id_estado = ?
              AND p2.id_repartidor IS NULL
              AND p2.id_pedido <> ?
              AND p2.pedido_fecha BETWEEN
                  DATE_SUB(?, INTERVAL ? MINUTE)
                  AND DATE_ADD(?, INTERVAL ? MINUTE)
            ORDER BY p2.pedido_total DESC, p2.pedido_fecha ASC, p2.id_pedido ASC
        `, [
            ESTADO_PEDIDO_PENDIENTE,
            id_pedido,
            pedido.pedido_fecha,
            VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS,
            pedido.pedido_fecha,
            VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS
        ]);

        const pedidoTotal = numeroSeguro(pedido.pedido_total);
        const pedidoDeMayorValor = pedidosSimultaneos.find(
            otro => numeroSeguro(otro.pedido_total) > pedidoTotal
        );

        if (pedidoDeMayorValor) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido espera porque existe otro pedido simultáneo de mayor valor",
                pedido_prioritario: {
                    id_pedido: pedidoDeMayorValor.id_pedido,
                    pedido_codigo: pedidoDeMayorValor.pedido_codigo,
                    pedido_total: numeroSeguro(pedidoDeMayorValor.pedido_total)
                }
            };
        }

        // 6. Buscar repartidores disponibles con ubicación reciente.
        const [repartidores] = await conexion.query(`
            SELECT
                r.id_repartidor,
                r.id_usuario,
                r.repartidor_codigo,
                r.repartidor_posicion_ranking,
                r.repartidor_total_pedidos,
                r.repartidor_puntos,
                r.repartidor_calificacion,
                r.id_estado_repartidor,
                er.estado_repartidor_nombre,
                er.estado_repartidor_permite_pedidos,
                er.estado_repartidor_permite_seleccion,
                ru.repartidor_ubicacion_latitud,
                ru.repartidor_ubicacion_longitud,
                ru.repartidor_ubicacion_fecha,
                (
                    6371 * ACOS(
                        LEAST(1, GREATEST(-1,
                            COS(RADIANS(?)) *
                            COS(RADIANS(ru.repartidor_ubicacion_latitud)) *
                            COS(
                                RADIANS(ru.repartidor_ubicacion_longitud) -
                                RADIANS(?)
                            ) +
                            SIN(RADIANS(?)) *
                            SIN(RADIANS(ru.repartidor_ubicacion_latitud))
                        ))
                    )
                ) AS distancia_km
            FROM repartidores r
            INNER JOIN estados_repartidor er
                ON r.id_estado_repartidor = er.id_estado_repartidor
            INNER JOIN (
                SELECT ru1.*
                FROM repartidor_ubicaciones ru1
                INNER JOIN (
                    SELECT
                        id_repartidor,
                        MAX(id_repartidor_ubicacion) AS ultima_ubicacion
                    FROM repartidor_ubicaciones
                    GROUP BY id_repartidor
                ) ultima
                    ON ru1.id_repartidor_ubicacion = ultima.ultima_ubicacion
            ) ru
                ON r.id_repartidor = ru.id_repartidor
            WHERE er.estado_repartidor_estado = 1
              AND UPPER(er.estado_repartidor_nombre) IN ('LISTO', 'REPARTIENDO')
              AND er.estado_repartidor_permite_pedidos = 1
              AND ru.repartidor_ubicacion_fecha >=
                  DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `, [
            pedido.pedido_local_latitud,
            pedido.pedido_local_longitud,
            pedido.pedido_local_latitud,
            MAX_ANTIGUEDAD_UBICACION_MINUTOS
        ]);

        if (!repartidores.length) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "No existen repartidores LISTO o REPARTIENDO con ubicación reciente"
            };
        }

        // 7. Eliminar candidatos cuya distancia no pudo calcularse.
        const repartidoresValidos = repartidores.filter(
            repartidor => Number.isFinite(Number(repartidor.distancia_km))
        );

        if (!repartidoresValidos.length) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "No se pudieron calcular las distancias de los repartidores"
            };
        }

        // 8. Usar el primer radio que encuentre candidatos.
        let candidatos = [];
        let radioSeleccionado = null;

        for (const radio of RADIOS_ASIGNACION) {
            candidatos = repartidoresValidos.filter(
                repartidor => Number(repartidor.distancia_km) <= radio
            );

            if (candidatos.length) {
                radioSeleccionado = radio;
                break;
            }
        }

        if (!candidatos.length) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "No existe repartidor disponible dentro de 16 km"
            };
        }

        // 9. Orden de prioridad: distancia, ranking, pedidos, puntos, calificación e ID.
        candidatos.sort((a, b) => {
            const distanciaA = numeroSeguro(a.distancia_km, 999999);
            const distanciaB = numeroSeguro(b.distancia_km, 999999);

            if (distanciaA !== distanciaB) return distanciaA - distanciaB;

            const pedidosA = numeroSeguro(a.repartidor_total_pedidos);
            const pedidosB = numeroSeguro(b.repartidor_total_pedidos);

            if (Math.abs(pedidosA - pedidosB) <= DIFERENCIA_PEDIDOS_RANKING) {
                const rankingA = numeroSeguro(a.repartidor_posicion_ranking, 999999);
                const rankingB = numeroSeguro(b.repartidor_posicion_ranking, 999999);

                if (rankingA !== rankingB) return rankingA - rankingB;
            }

            if (pedidosA !== pedidosB) return pedidosA - pedidosB;

            const puntosA = numeroSeguro(a.repartidor_puntos);
            const puntosB = numeroSeguro(b.repartidor_puntos);

            if (puntosA !== puntosB) return puntosB - puntosA;

            const calificacionA = numeroSeguro(a.repartidor_calificacion);
            const calificacionB = numeroSeguro(b.repartidor_calificacion);

            if (calificacionA !== calificacionB) {
                return calificacionB - calificacionA;
            }

            return Number(a.id_repartidor) - Number(b.id_repartidor);
        });

        const repartidor = candidatos[0];

        if (!repartidor) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "No se pudo seleccionar un repartidor"
            };
        }

        // 10. Bloquear nuevamente al repartidor antes de asignarlo.
        const [repartidorBloqueado] = await conexion.query(`
            SELECT
                r.id_repartidor,
                r.id_estado_repartidor,
                er.estado_repartidor_nombre,
                er.estado_repartidor_permite_pedidos
            FROM repartidores r
            INNER JOIN estados_repartidor er
                ON r.id_estado_repartidor = er.id_estado_repartidor
            WHERE r.id_repartidor = ?
            FOR UPDATE
        `, [repartidor.id_repartidor]);

        if (!repartidorBloqueado.length) {
            throw new Error("El repartidor seleccionado ya no existe");
        }

        const repartidorActual = repartidorBloqueado[0];
        const estadoRepartidor = String(
            repartidorActual.estado_repartidor_nombre
        ).trim().toUpperCase();

        // 11. Confirmar que el repartidor sigue disponible.
        if (!ESTADOS_REPARTIDOR_DISPONIBLES.includes(estadoRepartidor)) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El repartidor seleccionado ya no está disponible"
            };
        }

        if (Number(repartidorActual.estado_repartidor_permite_pedidos) !== 1) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El repartidor seleccionado no puede recibir pedidos"
            };
        }

        // 12. Volver a comprobar que el pedido continúa pendiente.
        const [pedidoActual] = await conexion.query(`
            SELECT id_pedido, id_repartidor, id_estado
            FROM pedidos
            WHERE id_pedido = ?
            FOR UPDATE
        `, [id_pedido]);

        if (!pedidoActual.length) throw new Error("El pedido ya no existe");

        if (pedidoActual[0].id_repartidor !== null) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido ya fue asignado a otro repartidor",
                id_repartidor: pedidoActual[0].id_repartidor
            };
        }

        if (Number(pedidoActual[0].id_estado) !== ESTADO_PEDIDO_PENDIENTE) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido ya no se encuentra pendiente"
            };
        }

        // 13. Última comprobación contra asignaciones duplicadas.
        const [asignacionExistente] = await conexion.query(`
            SELECT id_pedido_repartidor
            FROM pedido_repartidores
            WHERE id_pedido = ? AND id_estado = ?
            LIMIT 1
            FOR UPDATE
        `, [id_pedido, ESTADO_ASIGNACION_ACTIVA]);

        if (asignacionExistente.length) {
            await conexion.rollback();
            transaccionIniciada = false;
            return {
                asignado: false,
                motivo: "El pedido ya tiene una asignación activa"
            };
        }

        // 14. Crear la asignación.
        const [insert] = await conexion.query(`
            INSERT INTO pedido_repartidores (
                id_pedido,
                id_repartidor,
                pedido_repartidor_fecha_solicitud,
                pedido_repartidor_fecha_asignacion,
                pedido_repartidor_prioridad,
                pedido_repartidor_es_seleccion_cliente,
                pedido_repartidor_costo_seleccion,
                pedido_repartidor_orden_simultaneo,
                id_estado
            )
            VALUES (?, ?, ?, NOW(), 0, 0, 0, 1, ?)
        `, [
            id_pedido,
            repartidor.id_repartidor,
            pedido.pedido_fecha,
            ESTADO_ASIGNACION_ACTIVA
        ]);

        if (!insert.insertId) {
            throw new Error("No se pudo crear la asignación del repartidor");
        }

        // 15. Asociar el repartidor al pedido. Si falla, todo hace rollback.
        const [actualizacion] = await conexion.query(`
            UPDATE pedidos
            SET id_repartidor = ?, id_estado = ?
            WHERE id_pedido = ?
              AND id_repartidor IS NULL
              AND id_estado = ?
        `, [
            repartidor.id_repartidor,
            ESTADO_PEDIDO_ASIGNADO,
            id_pedido,
            ESTADO_PEDIDO_PENDIENTE
        ]);

        if (actualizacion.affectedRows !== 1) {
            throw new Error("No se pudo asociar el repartidor al pedido");
        }

        await conexion.commit();
        transaccionIniciada = false;

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
            pedido_total: pedidoTotal
        };
    } catch (error) {
        if (transaccionIniciada) {
            try {
                await conexion.rollback();
            } catch (rollbackError) {
                console.error("[Asignación] Error rollback:", rollbackError);
            }
        }

        console.error("[Asignación] Error:", error);
        throw error;
    } finally {
        conexion.release();
    }
};
