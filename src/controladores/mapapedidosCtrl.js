import { conmysql } from "../db.js";

// Obtener pedidos para el mapa general
export const getMapaPedidos = async (req, res) => {
    try {

        const [result] = await conmysql.query(`
            SELECT
                p.pedido_id,
                p.pedido_codigo,

                p.cliente_id,

                c.cliente_nombre,
                c.cliente_apellido,
                CONCAT(
                    c.cliente_nombre,
                    ' ',
                    c.cliente_apellido
                ) AS nombre_cliente,

                c.cliente_cedula,
                c.cliente_telefono,
                c.cliente_correo,
                c.cliente_direccion,

                c.cliente_latitud,
                c.cliente_longitud,

                p.ruta_id,
                p.pedido_estado,
                p.pedido_total,
                p.pedido_observacion,

                p.pedido_fecha_registro,
                p.pedido_fecha_asignacion,
                p.pedido_fecha_inicio,
                p.pedido_fecha_entrega,
                p.pedido_fecha_cancelacion

            FROM pedido p

            INNER JOIN cliente c
                ON p.cliente_id = c.cliente_id

            WHERE c.cliente_latitud IS NOT NULL
              AND c.cliente_longitud IS NOT NULL

            ORDER BY p.pedido_id DESC
        `);

        res.json(result);

    } catch (error) {

        console.error(
            "Error al consultar pedidos para el mapa:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar pedidos para el mapa"
        });
    }
};