import { conmysql } from "../db.js";

// GET: Obtener todos los detalles de pedidos
export const getPedidosDetalles = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT pd.*, p.pedido_codigo, p.id_cliente, p.id_local, lp.id_producto, l.local_nombre_comercial, pr.producto_codigo, pr.producto_nombre, pr.producto_estado
            FROM pedido_detalles pd
            LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
            LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
            LEFT JOIN locales l ON lp.id_local = l.id_local
            LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
            ORDER BY pd.id_pedido_detalle DESC
        `);
        return res.json(result);
    } catch (error) {
        console.error("Error getPedidosDetalles:", error);
        return res.status(500).json({ message: "Error al consultar los detalles de pedidos", error: error.message });
    }
};

// GET: Obtener detalle por ID
export const getPedidoDetallePorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`
            SELECT pd.*, p.pedido_codigo, p.id_cliente, p.id_local, lp.id_producto, l.local_nombre_comercial, pr.producto_codigo, pr.producto_nombre, pr.producto_estado
            FROM pedido_detalles pd
            LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
            LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
            LEFT JOIN locales l ON lp.id_local = l.id_local
            LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
            WHERE pd.id_pedido_detalle = ?
        `, [id]);
        if (result.length === 0) return res.status(404).json({ id_pedido_detalle: 0, message: "Detalle de pedido no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getPedidoDetallePorId:", error);
        return res.status(500).json({ message: "Error al consultar el detalle del pedido", error: error.message });
    }
};

// GET: Obtener detalles por pedido
export const getDetallesPorPedido = async (req, res) => {
    try {
        const { id_pedido } = req.params;
        const [result] = await conmysql.query(`
            SELECT pd.*, p.pedido_codigo, p.id_cliente, p.id_local, lp.id_producto, l.local_nombre_comercial, pr.producto_codigo, pr.producto_nombre, pr.producto_estado
            FROM pedido_detalles pd
            LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
            LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
            LEFT JOIN locales l ON lp.id_local = l.id_local
            LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
            WHERE pd.id_pedido = ?
            ORDER BY pd.id_pedido_detalle ASC
        `, [id_pedido]);
        return res.json(result);
    } catch (error) {
        console.error("Error getDetallesPorPedido:", error);
        return res.status(500).json({ message: "Error al consultar los detalles del pedido", error: error.message });
    }
};

// GET: Obtener detalles por producto del local
export const getDetallesPorLocalProducto = async (req, res) => {
    try {
        const { id_local_producto } = req.params;
        const [result] = await conmysql.query(`
            SELECT pd.*, p.pedido_codigo, p.id_cliente, p.id_local, p.id_estado, lp.id_producto, pr.producto_codigo, pr.producto_nombre, pr.producto_estado
            FROM pedido_detalles pd
            LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
            LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
            LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
            WHERE pd.id_local_producto = ?
            ORDER BY pd.id_pedido_detalle DESC
        `, [id_local_producto]);
        return res.json(result);
    } catch (error) {
        console.error("Error getDetallesPorLocalProducto:", error);
        return res.status(500).json({ message: "Error al consultar los detalles", error: error.message });
    }
};

// POST: Crear detalle de pedido
export const postPedidoDetalle = async (req, res) => {
    try {
        const { id_pedido, id_local_producto, pedido_detalle_cantidad, pedido_detalle_precio_local, pedido_detalle_precio_app, pedido_detalle_subtotal_local, pedido_detalle_subtotal_app, pedido_detalle_observacion } = req.body;

        // Validar datos básicos.
        if (!id_pedido) return res.status(400).json({ message: "El pedido es obligatorio" });
        if (!id_local_producto) return res.status(400).json({ message: "El producto del local es obligatorio" });

        const cantidad = Number(pedido_detalle_cantidad);
        if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ message: "La cantidad debe ser un entero mayor que 0" });

        // Verificar pedido.
        const [pedidos] = await conmysql.query(`SELECT id_pedido, id_local FROM pedidos WHERE id_pedido = ?`, [id_pedido]);
        if (pedidos.length === 0) return res.status(404).json({ message: "El pedido no existe" });

        // Verificar producto y pertenencia al local.
        const [productos] = await conmysql.query(`
            SELECT lp.id_local_producto, lp.id_local, lp.id_producto, pr.producto_codigo, pr.producto_nombre, pr.producto_estado
            FROM local_productos lp
            INNER JOIN productos pr ON lp.id_producto = pr.id_producto
            WHERE lp.id_local_producto = ?
        `, [id_local_producto]);
        if (productos.length === 0) return res.status(404).json({ message: "El producto del local no existe" });

        const producto = productos[0];
        if (Number(producto.id_local) !== Number(pedidos[0].id_local)) return res.status(400).json({ message: "El producto del local no pertenece al local del pedido" });
        if (producto.producto_estado === null || producto.producto_estado === undefined || String(producto.producto_estado).trim().toUpperCase() !== "ACTIVO") {
            return res.status(400).json({ message: `El producto "${producto.producto_nombre}" no está disponible para comprar` });
        }

        // Validar precios y calcular subtotales.
        const precioLocal = Number(pedido_detalle_precio_local ?? 0);
        const precioApp = Number(pedido_detalle_precio_app ?? 0);
        if (!Number.isFinite(precioLocal) || precioLocal < 0) return res.status(400).json({ message: "El precio local no es válido" });
        if (!Number.isFinite(precioApp) || precioApp < 0) return res.status(400).json({ message: "El precio app no es válido" });

        const subtotalLocal = Number(pedido_detalle_subtotal_local ?? precioLocal * cantidad);
        const subtotalApp = Number(pedido_detalle_subtotal_app ?? precioApp * cantidad);
        if (!Number.isFinite(subtotalLocal) || subtotalLocal < 0) return res.status(400).json({ message: "El subtotal local no es válido" });
        if (!Number.isFinite(subtotalApp) || subtotalApp < 0) return res.status(400).json({ message: "El subtotal app no es válido" });

        // Insertar detalle.
        const [result] = await conmysql.query(`
            INSERT INTO pedido_detalles (id_pedido, id_local_producto, pedido_detalle_cantidad, pedido_detalle_precio_local, pedido_detalle_precio_app, pedido_detalle_subtotal_local, pedido_detalle_subtotal_app, pedido_detalle_observacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id_pedido, id_local_producto, cantidad, precioLocal, precioApp, subtotalLocal, subtotalApp, pedido_detalle_observacion ?? null]);

        const [rows] = await conmysql.query(`
            SELECT pd.*, p.pedido_codigo, p.id_cliente, p.id_local, lp.id_producto, l.local_nombre_comercial, pr.producto_codigo, pr.producto_nombre
            FROM pedido_detalles pd
            LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
            LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
            LEFT JOIN locales l ON lp.id_local = l.id_local
            LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
            WHERE pd.id_pedido_detalle = ?
        `, [result.insertId]);

        return res.status(201).json({ id_pedido_detalle: result.insertId, message: "Detalle de pedido registrado con éxito", detalle: rows[0] });
    } catch (error) {
        console.error("Error postPedidoDetalle:", error);
        return res.status(500).json({ message: "Error al registrar detalle de pedido", error: error.message });
    }
};

// PUT: Actualizar completamente un detalle
export const putPedidoDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_pedido, id_local_producto, pedido_detalle_cantidad, pedido_detalle_precio_local, pedido_detalle_precio_app, pedido_detalle_subtotal_local, pedido_detalle_subtotal_app, pedido_detalle_observacion } = req.body;

        if (!id_pedido || !id_local_producto) return res.status(400).json({ message: "El pedido y el producto del local son obligatorios" });

        const cantidad = Number(pedido_detalle_cantidad);
        if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ message: "La cantidad debe ser un entero mayor que 0" });

        const precioLocal = Number(pedido_detalle_precio_local ?? 0);
        const precioApp = Number(pedido_detalle_precio_app ?? 0);
        const subtotalLocal = Number(pedido_detalle_subtotal_local ?? precioLocal * cantidad);
        const subtotalApp = Number(pedido_detalle_subtotal_app ?? precioApp * cantidad);

        // Validar precios y subtotales.
        if (!Number.isFinite(precioLocal) || precioLocal < 0 || !Number.isFinite(precioApp) || precioApp < 0) return res.status(400).json({ message: "Los precios proporcionados no son válidos" });
        if (!Number.isFinite(subtotalLocal) || subtotalLocal < 0 || !Number.isFinite(subtotalApp) || subtotalApp < 0) return res.status(400).json({ message: "Los subtotales proporcionados no son válidos" });

        // Verificar pedido y producto.
        const [pedidos] = await conmysql.query(`SELECT id_pedido, id_local FROM pedidos WHERE id_pedido = ?`, [id_pedido]);
        if (pedidos.length === 0) return res.status(404).json({ message: "El pedido no existe" });

        const [productos] = await conmysql.query(`
            SELECT lp.id_local_producto, lp.id_local, lp.id_producto, pr.producto_nombre, pr.producto_estado
            FROM local_productos lp
            INNER JOIN productos pr ON lp.id_producto = pr.id_producto
            WHERE lp.id_local_producto = ?
        `, [id_local_producto]);
        if (productos.length === 0) return res.status(404).json({ message: "El producto del local no existe" });
        if (Number(productos[0].id_local) !== Number(pedidos[0].id_local)) return res.status(400).json({ message: "El producto del local no pertenece al local del pedido" });

        // Actualizar detalle.
        const [result] = await conmysql.query(`
            UPDATE pedido_detalles SET id_pedido = ?, id_local_producto = ?, pedido_detalle_cantidad = ?, pedido_detalle_precio_local = ?, pedido_detalle_precio_app = ?, pedido_detalle_subtotal_local = ?, pedido_detalle_subtotal_app = ?, pedido_detalle_observacion = ?
            WHERE id_pedido_detalle = ?
        `, [id_pedido, id_local_producto, cantidad, precioLocal, precioApp, subtotalLocal, subtotalApp, pedido_detalle_observacion ?? null, id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: "Detalle de pedido no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM pedido_detalles WHERE id_pedido_detalle = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putPedidoDetalle:", error);
        return res.status(500).json({ message: "Error al actualizar detalle de pedido", error: error.message });
    }
};

// PATCH: Actualización parcial de detalle
export const patchPedidoDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["id_pedido", "id_local_producto", "pedido_detalle_cantidad", "pedido_detalle_precio_local", "pedido_detalle_precio_app", "pedido_detalle_subtotal_local", "pedido_detalle_subtotal_app", "pedido_detalle_observacion"];
        const campos = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });

        // Validar cantidad y precios recibidos.
        if (req.body.pedido_detalle_cantidad !== undefined) {
            const cantidad = Number(req.body.pedido_detalle_cantidad);
            if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ message: "La cantidad debe ser un entero mayor que 0" });
        }
        if (req.body.pedido_detalle_precio_local !== undefined) {
            const precio = Number(req.body.pedido_detalle_precio_local);
            if (!Number.isFinite(precio) || precio < 0) return res.status(400).json({ message: "El precio local no es válido" });
        }
        if (req.body.pedido_detalle_precio_app !== undefined) {
            const precio = Number(req.body.pedido_detalle_precio_app);
            if (!Number.isFinite(precio) || precio < 0) return res.status(400).json({ message: "El precio app no es válido" });
        }

        valores.push(id);
        const [result] = await conmysql.query(`UPDATE pedido_detalles SET ${campos.join(", ")} WHERE id_pedido_detalle = ?`, valores);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Detalle de pedido no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM pedido_detalles WHERE id_pedido_detalle = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchPedidoDetalle:", error);
        return res.status(500).json({ message: "Error al actualizar detalle de pedido", error: error.message });
    }
};

// DELETE: Eliminar detalle
export const deletePedidoDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM pedido_detalles WHERE id_pedido_detalle = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ id_pedido_detalle: 0, message: "Detalle de pedido no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deletePedidoDetalle:", error);
        return res.status(500).json({ message: "Error al eliminar detalle de pedido", error: error.message });
    }
};
