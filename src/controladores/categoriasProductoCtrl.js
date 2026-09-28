import { conmysql } from "../db.js";

class ErrorNegocio extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

const limpiar = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
const aEntero = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };

// categoria_producto_estado es tinyint(1): 1 = activa, 0 = inactiva.
// Acepta 1/0, true/false, "1"/"0", "Activo"/"Inactivo", "DISPONIBLE"/"NO DISPONIBLE".
const normalizarEstado = (v) => {
    if (v === true || v === 1 || v === "1") return 1;
    if (v === false || v === 0 || v === "0") return 0;
    const e = limpiar(v).toUpperCase();
    if (["ACTIVO", "DISPONIBLE"].includes(e)) return 1;
    if (["INACTIVO", "NO DISPONIBLE"].includes(e)) return 0;
    return null;
};

const SQL_CATEGORIA = `SELECT id_categoria_producto, categoria_producto_nombre,
    categoria_producto_descripcion, categoria_producto_estado
    FROM categorias_producto WHERE id_categoria_producto = ?`;

const responderError = (res, error, etiqueta, mensaje) => {
    if (error instanceof ErrorNegocio) return res.status(error.status).json({ message: error.message });
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe una categoría con ese nombre" });
    if (error.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ message: "La categoría tiene productos asociados; márcala como inactiva en lugar de eliminarla" });
    console.error(`Error ${etiqueta}:`, error);
    return res.status(500).json({ message: mensaje, error: error.message });
};

// Listar (opcional: ?estado=1|0 para filtrar)
export const getCategoriasProducto = async (req, res) => {
    try {
        const params = [];
        let where = "";
        if (req.query.estado !== undefined && req.query.estado !== "") {
            const estado = normalizarEstado(req.query.estado);
            if (estado === null) throw new ErrorNegocio(400, "Estado inválido");
            where = "WHERE categoria_producto_estado = ?";
            params.push(estado);
        }
        const [result] = await conmysql.query(
            `SELECT id_categoria_producto, categoria_producto_nombre, categoria_producto_descripcion, categoria_producto_estado
             FROM categorias_producto ${where} ORDER BY categoria_producto_nombre ASC`, params);
        return res.json(result);
    } catch (error) {
        return responderError(res, error, "getCategoriasProducto", "Error al consultar categorías de producto");
    }
};

// Obtener por ID
export const getCategoriaProductoxid = async (req, res) => {
    try {
        const id = aEntero(req.params.id);
        if (!id) throw new ErrorNegocio(400, "ID de categoría inválido");
        const [result] = await conmysql.query(SQL_CATEGORIA, [id]);
        if (result.length === 0) return res.status(404).json({ id_categoria_producto: 0, message: "Categoría no encontrada" });
        return res.json(result[0]);
    } catch (error) {
        return responderError(res, error, "getCategoriaProductoxid", "Error del servidor");
    }
};

// Crear
export const postCategoriaProducto = async (req, res) => {
    try {
        const b = req.body ?? {};
        const nombre = limpiar(b.categoria_producto_nombre);
        const descripcion = limpiar(b.categoria_producto_descripcion);
        const estado = b.categoria_producto_estado === undefined || b.categoria_producto_estado === ""
            ? 1 : normalizarEstado(b.categoria_producto_estado);

        if (!nombre || nombre.length > 100) throw new ErrorNegocio(400, "El nombre es obligatorio (máximo 100 caracteres)");
        if (descripcion.length > 255) throw new ErrorNegocio(400, "La descripción no puede superar 255 caracteres");
        if (estado === null) throw new ErrorNegocio(400, "Estado inválido");

        const [ins] = await conmysql.query(
            `INSERT INTO categorias_producto (categoria_producto_nombre, categoria_producto_descripcion, categoria_producto_estado)
             VALUES (?, ?, ?)`, [nombre, descripcion || null, estado]);

        const [rows] = await conmysql.query(SQL_CATEGORIA, [ins.insertId]);
        return res.status(201).json({ ...rows[0], message: "Categoría registrada con éxito" });
    } catch (error) {
        return responderError(res, error, "postCategoriaProducto", "Error al registrar la categoría");
    }
};

// Actualizar (PUT = completo, PATCH = parcial)
const actualizarCategoria = async (req, res, parcial) => {
    try {
        const id = aEntero(req.params.id);
        const b = req.body ?? {};
        if (!id) throw new ErrorNegocio(400, "ID de categoría inválido");
        if (!parcial && b.categoria_producto_nombre === undefined) {
            throw new ErrorNegocio(400, "Para PUT se requiere categoria_producto_nombre (usa PATCH para cambios parciales)");
        }

        const cambios = {};
        if (b.categoria_producto_nombre !== undefined) {
            const nombre = limpiar(b.categoria_producto_nombre);
            if (!nombre || nombre.length > 100) throw new ErrorNegocio(400, "El nombre es obligatorio (máximo 100 caracteres)");
            cambios.categoria_producto_nombre = nombre;
        }
        if (b.categoria_producto_descripcion !== undefined) {
            const descripcion = limpiar(b.categoria_producto_descripcion);
            if (descripcion.length > 255) throw new ErrorNegocio(400, "La descripción no puede superar 255 caracteres");
            cambios.categoria_producto_descripcion = descripcion || null;
        }
        if (b.categoria_producto_estado !== undefined) {
            const estado = normalizarEstado(b.categoria_producto_estado);
            if (estado === null) throw new ErrorNegocio(400, "Estado inválido");
            cambios.categoria_producto_estado = estado;
        }

        const columnas = Object.keys(cambios); // solo columnas definidas arriba
        if (columnas.length === 0) throw new ErrorNegocio(400, "No se proporcionaron campos para actualizar");

        const [result] = await conmysql.query(
            `UPDATE categorias_producto SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_categoria_producto = ?`,
            [...columnas.map((c) => cambios[c]), id]);
        if (result.affectedRows === 0) throw new ErrorNegocio(404, "Categoría no encontrada");

        const [rows] = await conmysql.query(SQL_CATEGORIA, [id]);
        return res.json(rows[0]);
    } catch (error) {
        return responderError(res, error, parcial ? "patchCategoriaProducto" : "putCategoriaProducto", "Error al actualizar la categoría");
    }
};

export const putCategoriaProducto = (req, res) => actualizarCategoria(req, res, false);
export const patchCategoriaProducto = (req, res) => actualizarCategoria(req, res, true);

// Eliminar (falla con 409 si hay productos que la usan)
export const deleteCategoriaProducto = async (req, res) => {
    try {
        const id = aEntero(req.params.id);
        if (!id) throw new ErrorNegocio(400, "ID de categoría inválido");
        const [result] = await conmysql.query("DELETE FROM categorias_producto WHERE id_categoria_producto = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Categoría no encontrada" });
        return res.status(204).send();
    } catch (error) {
        return responderError(res, error, "deleteCategoriaProducto", "Error al eliminar la categoría");
    }
};