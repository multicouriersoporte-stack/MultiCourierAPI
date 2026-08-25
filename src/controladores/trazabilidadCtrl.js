import { conmysql } from "../db.js";

export const getTrazabilidad = async (req, res) => {
    try {
        const [pedidosResumen] = await conmysql.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pedido_estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN pedido_estado IN ('En Proceso', 'En Recorrido') THEN 1 ELSE 0 END) AS en_recorrido,
        SUM(CASE WHEN pedido_estado = 'Entregado' THEN 1 ELSE 0 END) AS entregados,
        SUM(CASE WHEN pedido_estado = 'Terminado' THEN 1 ELSE 0 END) AS terminados,
        SUM(CASE WHEN pedido_estado = 'Cancelado' THEN 1 ELSE 0 END) AS cancelados
      FROM pedido
    `);

        const [ventas] = await conmysql.query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN DATE(pedido_fecha_registro) = CURDATE()
            THEN pedido_total
            ELSE 0
          END
        ), 0) AS ventas_hoy,

        COALESCE(SUM(
          CASE
            WHEN YEARWEEK(pedido_fecha_registro, 1) = YEARWEEK(CURDATE(), 1)
            THEN pedido_total
            ELSE 0
          END
        ), 0) AS ventas_semana,

        COALESCE(SUM(
          CASE
            WHEN YEAR(pedido_fecha_registro) = YEAR(CURDATE())
             AND MONTH(pedido_fecha_registro) = MONTH(CURDATE())
            THEN pedido_total
            ELSE 0
          END
        ), 0) AS ventas_mes

      FROM pedido
      WHERE pedido_estado <> 'Cancelado'
    `);

        const [productosVendidos] = await conmysql.query(`
      SELECT
        COALESCE(SUM(pd.pedido_detalle_cantidad), 0) AS cantidad_productos_vendidos,
        COALESCE(SUM(pd.pedido_detalle_subtotal), 0) AS total_productos_vendidos
      FROM pedido_detalle pd
      INNER JOIN pedido p
        ON pd.pedido_id = p.pedido_id
      WHERE p.pedido_estado <> 'Cancelado'
    `);

        const [stock] = await conmysql.query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN producto_categoria = 'GLP'
            THEN producto_stock
            ELSE 0
          END
        ), 0) AS stock_glp,

        COALESCE(SUM(
          CASE
            WHEN producto_categoria = 'AGUA'
            THEN producto_stock
            ELSE 0
          END
        ), 0) AS stock_agua,

        COALESCE(SUM(producto_stock), 0) AS stock_total,

        COALESCE(SUM(
          CASE
            WHEN producto_stock <= producto_stock_minimo
            THEN 1
            ELSE 0
          END
        ), 0) AS productos_stock_bajo

      FROM producto
      WHERE producto_activo = 1
    `);

        const [ultimosPedidos] = await conmysql.query(`
      SELECT
        p.pedido_id,
        p.pedido_codigo,
        p.pedido_fecha_registro,
        CONCAT(c.cliente_nombre, ' ', c.cliente_apellido) AS cliente,
        p.pedido_estado,
        p.pedido_total,
        COALESCE(SUM(pd.pedido_detalle_cantidad), 0) AS cantidad_productos
      FROM pedido p
      INNER JOIN cliente c
        ON p.cliente_id = c.cliente_id
      LEFT JOIN pedido_detalle pd
        ON p.pedido_id = pd.pedido_id
      GROUP BY
        p.pedido_id,
        p.pedido_codigo,
        p.pedido_fecha_registro,
        c.cliente_nombre,
        c.cliente_apellido,
        p.pedido_estado,
        p.pedido_total
      ORDER BY p.pedido_id DESC
      LIMIT 10
    `);

        res.json({
            pedidos: pedidosResumen[0],
            ventas: ventas[0],
            productos: productosVendidos[0],
            stock: stock[0],
            ultimosPedidos
        });
    } catch (error) {
        console.error("Error al consultar trazabilidad:", error);

        return res.status(500).json({
            message: "Error al consultar trazabilidad"
        });
    }
};