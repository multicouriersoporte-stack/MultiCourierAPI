import { conmysql } from "../db.js";

// GET: Obtener todos los productos
export const getProductos = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT * FROM productos ORDER BY producto_nombre ASC`);
        res.json(result);
    } catch (error) {
        console.error("Error getProductos:", error);
        return res.status(500).json({ message: "Error al consultar productos", error: error.message });
    }
};

// GET: Obtener producto por ID
export const getProductosxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM productos WHERE id_producto = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_producto: 0, message: "Producto no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getProductosxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener producto por código
export const getProductoPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM productos WHERE producto_codigo = ?`, [codigo]);
        if (result.length === 0) return res.status(404).json({ message: "Producto no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getProductoPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// POST: Crear producto
export const postProductos = async (req, res) => {
    try {
        const { producto_codigo, id_categoria_producto, producto_nombre, producto_descripcion, producto_tipo, producto_estado, producto_fecha_registro } = req.body;
        const [result] = await conmysql.query(
            `INSERT INTO productos (producto_codigo, id_categoria_producto, producto_nombre, producto_descripcion, producto_tipo, producto_estado, producto_fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [producto_codigo, id_categoria_producto, producto_nombre, producto_descripcion, producto_tipo, producto_estado, producto_fecha_registro]
        );
        res.status(201).json({ id_producto: result.insertId, message: "Producto registrado con éxito" });
    } catch (error) {
        console.error("Error postProductos:", error);
        return res.status(500).json({ message: "Error al registrar producto", error: error.message });
    }
};

// PUT: Actualizar completamente un producto
export const putProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const { producto_codigo, id_categoria_producto, producto_nombre, producto_descripcion, producto_tipo, producto_estado, producto_fecha_registro } = req.body;
        const [result] = await conmysql.query(
            `UPDATE productos SET producto_codigo = ?, id_categoria_producto = ?, producto_nombre = ?, producto_descripcion = ?, producto_tipo = ?, producto_estado = ?, producto_fecha_registro = ? WHERE id_producto = ?`,
            [producto_codigo, id_categoria_producto, producto_nombre, producto_descripcion, producto_tipo, producto_estado, producto_fecha_registro, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto no encontrado" });
        const [rows] = await conmysql.query(`SELECT * FROM productos WHERE id_producto = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error putProductos:", error);
        return res.status(500).json({ message: "Error al actualizar producto", error: error.message });
    }
};

// PATCH: Actualización parcial de producto
export const patchProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["producto_codigo", "id_categoria_producto", "producto_nombre", "producto_descripcion", "producto_tipo", "producto_estado", "producto_fecha_registro"];
        const campos = [], valores = [];
        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }
        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
        valores.push(id);
        const [result] = await conmysql.query(`UPDATE productos SET ${campos.join(", ")} WHERE id_producto = ?`, valores);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto no encontrado" });
        const [rows] = await conmysql.query(`SELECT * FROM productos WHERE id_producto = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error patchProductos:", error);
        return res.status(500).json({ message: "Error al actualizar producto", error: error.message });
    }
};

// DELETE: Eliminar producto
export const deleteProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM productos WHERE id_producto = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ id_producto: 0, message: "Producto no encontrado" });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleteProductos:", error);
        return res.status(500).json({ message: "Error al eliminar producto", error: error.message });
    }
};
