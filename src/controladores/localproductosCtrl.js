import { conmysql } from "../db.js";

// GET: Obtener todos los productos de locales
export const getLocalProductos = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local ORDER BY lp.local_producto_nombre ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocalProductos:", error);
        return res.status(500).json({ message: "Error al consultar productos de locales", error: error.message });
    }
};

// GET: Obtener producto de local por ID
export const getLocalProductoxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local WHERE lp.id_local_producto = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_local_producto: 0, message: "Producto del local no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalProductoxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener productos por local
export const getProductosPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_latitud, l.local_longitud FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local WHERE lp.id_local = ? ORDER BY lp.local_producto_nombre ASC`, [id_local]);
        return res.json(result);
    } catch (error) {
        console.error("Error getProductosPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar productos del local", error: error.message });
    }
};

// GET: Obtener productos por ID de producto
export const getLocalProductosPorProducto = async (req, res) => {
    try {
        const { id_producto } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local WHERE lp.id_producto = ? ORDER BY lp.local_producto_nombre ASC`, [id_producto]);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocalProductosPorProducto:", error);
        return res.status(500).json({ message: "Error al consultar productos", error: error.message });
    }
};

// GET: Buscar productos por nombre
export const buscarLocalProductos = async (req, res) => {
    try {
        const { nombre } = req.query;
        if (!nombre) return res.status(400).json({ message: "Debe proporcionar un nombre para buscar" });

        const [result] = await conmysql.query(
            `SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local WHERE lp.local_producto_nombre LIKE ? ORDER BY lp.local_producto_nombre ASC`,
            [`%${nombre}%`]
        );
        return res.json(result);
    } catch (error) {
        console.error("Error buscarLocalProductos:", error);
        return res.status(500).json({ message: "Error al buscar productos", error: error.message });
    }
};

// POST: Crear producto de local
export const postLocalProductos = async (req, res) => {
    try {
        const {
            id_local, id_producto, local_producto_nombre, local_producto_precio,
            local_producto_porcentaje_adicional, local_producto_precio_app,
            local_producto_descripcion, local_producto_estado, local_producto_fecha_registro
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO local_productos (id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_estado, local_producto_fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_estado, local_producto_fecha_registro]
        );

        return res.status(201).json({ id_local_producto: result.insertId, message: "Producto del local registrado con éxito" });
    } catch (error) {
        console.error("Error postLocalProductos:", error);
        return res.status(500).json({ message: "Error al registrar producto del local", error: error.message });
    }
};

// PUT: Actualizar completamente un producto de local
export const putLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_local, id_producto, local_producto_nombre, local_producto_precio,
            local_producto_porcentaje_adicional, local_producto_precio_app,
            local_producto_descripcion, local_producto_estado, local_producto_fecha_registro
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE local_productos SET id_local = ?, id_producto = ?, local_producto_nombre = ?, local_producto_precio = ?, local_producto_porcentaje_adicional = ?, local_producto_precio_app = ?, local_producto_descripcion = ?, local_producto_estado = ?, local_producto_fecha_registro = ? WHERE id_local_producto = ?`,
            [id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_estado, local_producto_fecha_registro, id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto del local no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM local_productos WHERE id_local_producto = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putLocalProductos:", error);
        return res.status(500).json({ message: "Error al actualizar producto del local", error: error.message });
    }
};

// PATCH: Actualización parcial de producto de local
export const patchLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_local", "id_producto", "local_producto_nombre", "local_producto_precio",
            "local_producto_porcentaje_adicional", "local_producto_precio_app",
            "local_producto_descripcion", "local_producto_estado", "local_producto_fecha_registro"
        ];
        const campos = [], valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });

        valores.push(id);
        const [result] = await conmysql.query(`UPDATE local_productos SET ${campos.join(", ")} WHERE id_local_producto = ?`, valores);

        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto del local no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM local_productos WHERE id_local_producto = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchLocalProductos:", error);
        return res.status(500).json({ message: "Error al actualizar producto del local", error: error.message });
    }
};

// DELETE: Eliminar producto de local
export const deleteLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM local_productos WHERE id_local_producto = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto del local no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteLocalProductos:", error);
        return res.status(500).json({ message: "Error al eliminar producto del local", error: error.message });
    }
};
