// src/servicios/buscarPedidos.js

import { conmysql } from "../db.js";

const ESTADO_PEDIDO_EN_PREPARACION = "EN_PREPARACION";
const RADIOS_BUSQUEDA = [3, 6, 10, 16];
const MAX_ANTIGUEDAD_UBICACION_MINUTOS = 3;

/**
 * Obtiene pedidos disponibles para un repartidor con ubicación reciente.
 */
export const buscarPedidosDisponibles = async id_repartidor => {
    const conexion = await conmysql.getConnection();

    try {
        // Validar repartidor, estado y ubicación reciente.
        const [repartidores] = await conexion.query(`
            SELECT r.id_repartidor, r.repartidor_codigo, r.id_estado_repartidor,
                   er.estado_repartidor_nombre, er.estado_repartidor_permite_pedidos,
                   ru.repartidor_ubicacion_latitud, ru.repartidor_ubicacion_longitud,
                   ru.repartidor_ubicacion_fecha
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
            WHERE r.id_repartidor = ?
              AND er.estado_repartidor_estado = 1
              AND UPPER(TRIM(er.estado_repartidor_nombre)) IN ('LISTO', 'REPARTIENDO')
              AND er.estado_repartidor_permite_pedidos = 1
              AND ru.repartidor_ubicacion_fecha >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
            LIMIT 1
        `, [id_repartidor, MAX_ANTIGUEDAD_UBICACION_MINUTOS]);

        if (!repartidores.length) {
            return {
                disponible: false,
                pedidos: [],
                motivo: "El repartidor no está disponible o no tiene una ubicación reciente"
            };
        }

        const repartidor = repartidores[0];

        // Buscar pedidos en preparación, sin repartidor y dentro del radio máximo.
        const [pedidos] = await conexion.query(`
            SELECT p.id_pedido, p.pedido_codigo, p.id_cliente, p.id_local, p.id_estado,
                   p.pedido_fecha, p.pedido_total, p.pedido_carrera,
                   p.pedido_local_latitud, p.pedido_local_longitud,
                   p.pedido_cliente_latitud, p.pedido_cliente_longitud, e.estado_nombre,
                   (6371 * ACOS(LEAST(1, GREATEST(-1,
                       COS(RADIANS(?)) * COS(RADIANS(p.pedido_local_latitud)) *
                       COS(RADIANS(p.pedido_local_longitud) - RADIANS(?)) +
                       SIN(RADIANS(?)) * SIN(RADIANS(p.pedido_local_latitud))
                   )))) AS distancia_km
            FROM pedidos p
            LEFT JOIN estados e ON p.id_estado = e.id_estado
            WHERE UPPER(TRIM(e.estado_nombre)) = ?
              AND p.id_repartidor IS NULL
              AND p.pedido_local_latitud IS NOT NULL
              AND p.pedido_local_longitud IS NOT NULL
            HAVING distancia_km <= ?
            ORDER BY distancia_km ASC, p.pedido_fecha ASC, p.id_pedido ASC
        `, [
            repartidor.repartidor_ubicacion_latitud,
            repartidor.repartidor_ubicacion_longitud,
            repartidor.repartidor_ubicacion_latitud,
            ESTADO_PEDIDO_EN_PREPARACION,
            Math.max(...RADIOS_BUSQUEDA)
        ]);

        // Usar el primer radio que encuentre pedidos.
        let pedidosEncontrados = [];
        let radioSeleccionado = null;

        for (const radio of RADIOS_BUSQUEDA) {
            const pedidosDentroDelRadio = pedidos.filter(pedido => Number(pedido.distancia_km) <= radio);
            if (pedidosDentroDelRadio.length) {
                pedidosEncontrados = pedidosDentroDelRadio;
                radioSeleccionado = radio;
                break;
            }
        }

        return {
            disponible: true,
            id_repartidor: repartidor.id_repartidor,
            repartidor_codigo: repartidor.repartidor_codigo,
            ubicacion: {
                latitud: Number(repartidor.repartidor_ubicacion_latitud),
                longitud: Number(repartidor.repartidor_ubicacion_longitud),
                fecha: repartidor.repartidor_ubicacion_fecha
            },
            radio_busqueda_km: radioSeleccionado,
            cantidad_pedidos: pedidosEncontrados.length,
            pedidos: pedidosEncontrados.map(pedido => ({
                id_pedido: pedido.id_pedido,
                pedido_codigo: pedido.pedido_codigo,
                id_local: pedido.id_local,
                id_cliente: pedido.id_cliente,
                estado: pedido.estado_nombre,
                fecha: pedido.pedido_fecha,
                total: Number(pedido.pedido_total || 0),
                carrera: Number(pedido.pedido_carrera || 0),
                local: {
                    latitud: Number(pedido.pedido_local_latitud),
                    longitud: Number(pedido.pedido_local_longitud)
                },
                cliente: {
                    latitud: Number(pedido.pedido_cliente_latitud),
                    longitud: Number(pedido.pedido_cliente_longitud)
                },
                distancia_km: Number(Number(pedido.distancia_km).toFixed(3))
            }))
        };
    } catch (error) {
        console.error("[BuscarPedidos] Error buscando pedidos:", error);
        throw error;
    } finally {
        conexion.release();
    }
};
