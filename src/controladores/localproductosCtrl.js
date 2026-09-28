/* import { conmysql } from "../db.js";

// Obtener todos los productos de locales
export const getLocalProductos = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local
            ORDER BY lp.local_producto_nombre ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocalProductos:", error);
        return res.status(500).json({ message: "Error al consultar productos de locales", error: error.message });
    }
};

// Obtener producto por ID
export const getLocalProductoxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local WHERE lp.id_local_producto = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_local_producto: 0, message: "Producto del local no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalProductoxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener productos por local
export const getProductosPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;
        console.log("ID LOCAL RECIBIDO:", id_local);
        const [result] = await conmysql.query(`SELECT lp.*, l.local_latitud, l.local_longitud, p.id_categoria_producto, cp.categoria_producto_nombre
            FROM local_productos lp
            INNER JOIN locales l ON l.id_local = lp.id_local
            INNER JOIN productos p ON p.id_producto = lp.id_producto
            LEFT JOIN categorias_producto cp ON cp.id_categoria_producto = p.id_categoria_producto
            WHERE lp.id_local = ?
            ORDER BY cp.categoria_producto_nombre ASC, lp.local_producto_nombre ASC`, [id_local]);
        console.log("PRODUCTOS ENCONTRADOS:", result);
        return res.json(result);
    } catch (error) {
        console.error("ERROR REAL getProductosPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar productos del local", error: error.message, sqlMessage: error.sqlMessage, code: error.code });
    }
};

// Obtener productos por ID de producto
export const getLocalProductosPorProducto = async (req, res) => {
    try {
        const { id_producto } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local
            WHERE lp.id_producto = ? ORDER BY lp.local_producto_nombre ASC`, [id_producto]);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocalProductosPorProducto:", error);
        return res.status(500).json({ message: "Error al consultar productos", error: error.message });
    }
};

// Buscar productos por nombre
export const buscarLocalProductos = async (req, res) => {
    try {
        const { nombre } = req.query;
        if (!nombre) return res.status(400).json({ message: "Debe proporcionar un nombre para buscar" });
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local
            WHERE lp.local_producto_nombre LIKE ? ORDER BY lp.local_producto_nombre ASC`, [`%${nombre}%`]);
        return res.json(result);
    } catch (error) {
        console.error("Error buscarLocalProductos:", error);
        return res.status(500).json({ message: "Error al buscar productos", error: error.message });
    }
};

// Crear producto de local
export const postLocalProductos = async (req, res) => {
    try {
        const { id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_foto, local_producto_estado } = req.body;
        const [result] = await conmysql.query(`INSERT INTO local_productos (id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_foto, local_producto_estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_foto, local_producto_estado]);
        return res.status(201).json({ id_local_producto: result.insertId, message: "Producto del local registrado con éxito" });
    } catch (error) {
        console.error("Error postLocalProductos:", error);
        return res.status(500).json({ message: "Error al registrar producto del local", error: error.message });
    }
};

// Actualizar completamente un producto
export const putLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_foto, local_producto_estado } = req.body;
        const [result] = await conmysql.query(`UPDATE local_productos SET id_local = ?, id_producto = ?, local_producto_nombre = ?, local_producto_precio = ?, local_producto_porcentaje_adicional = ?, local_producto_precio_app = ?, local_producto_descripcion = ?, local_producto_foto = ?, local_producto_estado = ?
            WHERE id_local_producto = ?`, [id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional, local_producto_precio_app, local_producto_descripcion, local_producto_foto, local_producto_estado, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto del local no encontrado" });
        const [rows] = await conmysql.query("SELECT * FROM local_productos WHERE id_local_producto = ?", [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putLocalProductos:", error);
        return res.status(500).json({ message: "Error al actualizar producto del local", error: error.message });
    }
};

// Actualizar parcialmente un producto
export const patchLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["id_local", "id_producto", "local_producto_nombre", "local_producto_precio", "local_producto_porcentaje_adicional", "local_producto_precio_app", "local_producto_descripcion", "local_producto_foto", "local_producto_estado"];
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
        const [rows] = await conmysql.query("SELECT * FROM local_productos WHERE id_local_producto = ?", [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchLocalProductos:", error);
        return res.status(500).json({ message: "Error al actualizar producto del local", error: error.message });
    }
};

// Eliminar producto de local
export const deleteLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query("DELETE FROM local_productos WHERE id_local_producto = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto del local no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteLocalProductos:", error);
        return res.status(500).json({ message: "Error al eliminar producto del local", error: error.message });
    }
};
 */


import { createHash } from "crypto";
import { conmysql } from "../db.js";
import { calcularPrecioApp } from "../utils/precios.js";

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

// Error de validación/negocio con código HTTP.
class ErrorNegocio extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

const limpiar = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

// La base usa DISPONIBLE (todos los registros actuales); la app enviaba "Activo"/"Inactivo".
const normalizarEstado = (v) => {
    const e = limpiar(v).toUpperCase();
    if (["ACTIVO", "DISPONIBLE"].includes(e)) return "DISPONIBLE";
    if (["INACTIVO", "NO DISPONIBLE"].includes(e)) return "NO DISPONIBLE";
    return null;
};
const aEntero = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const aPrecio = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= 99999999.99 ? Math.round(n * 100) / 100 : 0; };

// SELECT usado por las respuestas (mismo formato que getLocalProductoxid).
const SQL_LOCAL_PRODUCTO = `SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud,
    p.id_categoria_producto, cp.categoria_producto_nombre, p.producto_descripcion AS producto_variante
    FROM local_productos lp
    INNER JOIN locales l ON l.id_local = lp.id_local
    INNER JOIN productos p ON p.id_producto = lp.id_producto
    LEFT JOIN categorias_producto cp ON cp.id_categoria_producto = p.id_categoria_producto
    WHERE lp.id_local_producto = ?`;

// Traduce errores conocidos a respuestas HTTP.
const responderError = (res, error, etiqueta, mensaje) => {
    if (error instanceof ErrorNegocio) return res.status(error.status).json({ message: error.message });
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Este producto ya está registrado en el local" });
    if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "El local o la categoría indicada no existe" });
    if (error.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ message: "El producto tiene pedidos asociados; márcalo como no disponible en lugar de eliminarlo" });
    console.error(`Error ${etiqueta}:`, error);
    return res.status(500).json({ message: mensaje, error: error.message });
};

// Ejecuta fn dentro de una transacción. Los locks de nombre se liberan DESPUÉS del commit/rollback.
const enTransaccion = async (fn) => {
    const cx = await conmysql.getConnection();
    const locks = [];
    try {
        await cx.beginTransaction();
        const resultado = await fn(cx, locks);
        await cx.commit();
        return resultado;
    } catch (error) {
        await cx.rollback().catch(() => { });
        throw error;
    } finally {
        for (const lock of locks) await cx.query("SELECT RELEASE_LOCK(?)", [lock]).catch(() => { });
        cx.release();
    }
};

// Busca el producto maestro o lo crea. Identidad del maestro: (categoría, nombre, variante).
// La variante (p. ej. "1 litro", "750 ml") vive en productos.producto_descripcion.
// Si llega id_producto, solo se valida que exista (compatibilidad con el frontend anterior).
const resolverMaestro = async (cx, locks, { id_producto, id_categoria_producto, nombre, variante }) => {
    const idProducto = aEntero(id_producto);
    if (idProducto) {
        const [r] = await cx.query("SELECT id_producto FROM productos WHERE id_producto = ?", [idProducto]);
        if (r.length === 0) throw new ErrorNegocio(400, "El producto maestro indicado no existe");
        return { id_producto: idProducto, creado: false };
    }

    const categoria = aEntero(id_categoria_producto), nom = limpiar(nombre), vari = limpiar(variante);
    if (!categoria) throw new ErrorNegocio(400, "Selecciona la categoría del producto");
    if (!nom) throw new ErrorNegocio(400, "Ingresa el nombre del producto");

    // Evita que dos peticiones simultáneas creen el mismo maestro (no hay índice único sobre productos).
    const lock = "prod_" + createHash("md5").update(`${categoria}|${nom.toLowerCase()}|${vari.toLowerCase()}`).digest("hex");
    const [[obtenido]] = await cx.query("SELECT GET_LOCK(?, 5) AS ok", [lock]);
    if (obtenido.ok !== 1) throw new ErrorNegocio(503, "El sistema está ocupado, intenta nuevamente");
    locks.push(lock);

    // La collation utf8mb4_unicode_ci ya ignora mayúsculas/acentos y espacios finales.
    const [existentes] = await cx.query(
        `SELECT id_producto FROM productos
         WHERE id_categoria_producto = ? AND producto_nombre = ? AND COALESCE(producto_descripcion, '') = ?
         ORDER BY id_producto ASC LIMIT 1`, [categoria, nom, vari]);
    if (existentes.length > 0) return { id_producto: existentes[0].id_producto, creado: false };

    const [ins] = await cx.query(
        `INSERT INTO productos (id_categoria_producto, producto_nombre, producto_descripcion, producto_estado) VALUES (?, ?, ?, 'ACTIVO')`,
        [categoria, nom, vari]);
    return { id_producto: ins.insertId, creado: true };
};

// ---------------------------------------------------------------
// Consultas (sin cambios)
// ---------------------------------------------------------------

// Obtener todos los productos de locales
export const getLocalProductos = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local
            ORDER BY lp.local_producto_nombre ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocalProductos:", error);
        return res.status(500).json({ message: "Error al consultar productos de locales", error: error.message });
    }
};

// Obtener producto por ID
export const getLocalProductoxid = async (req, res) => {
    try {
        const { id } = req.params;
        // Incluye id_categoria_producto, categoria_producto_nombre y producto_variante (necesarios para editar).
        const [result] = await conmysql.query(SQL_LOCAL_PRODUCTO, [id]);
        if (result.length === 0) return res.status(404).json({ id_local_producto: 0, message: "Producto del local no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalProductoxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener productos por local
export const getProductosPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_latitud, l.local_longitud, p.id_categoria_producto, cp.categoria_producto_nombre
            FROM local_productos lp
            INNER JOIN locales l ON l.id_local = lp.id_local
            INNER JOIN productos p ON p.id_producto = lp.id_producto
            LEFT JOIN categorias_producto cp ON cp.id_categoria_producto = p.id_categoria_producto
            WHERE lp.id_local = ?
            ORDER BY cp.categoria_producto_nombre ASC, lp.local_producto_nombre ASC`, [id_local]);
        return res.json(result);
    } catch (error) {
        console.error("ERROR REAL getProductosPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar productos del local", error: error.message, sqlMessage: error.sqlMessage, code: error.code });
    }
};

// Obtener productos por ID de producto
export const getLocalProductosPorProducto = async (req, res) => {
    try {
        const { id_producto } = req.params;
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local
            WHERE lp.id_producto = ? ORDER BY lp.local_producto_nombre ASC`, [id_producto]);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocalProductosPorProducto:", error);
        return res.status(500).json({ message: "Error al consultar productos", error: error.message });
    }
};

// Buscar productos por nombre
export const buscarLocalProductos = async (req, res) => {
    try {
        const { nombre } = req.query;
        if (!nombre) return res.status(400).json({ message: "Debe proporcionar un nombre para buscar" });
        const [result] = await conmysql.query(`SELECT lp.*, l.local_nombre_comercial, l.local_categoria, l.local_latitud, l.local_longitud
            FROM local_productos lp INNER JOIN locales l ON l.id_local = lp.id_local
            WHERE lp.local_producto_nombre LIKE ? ORDER BY lp.local_producto_nombre ASC`, [`%${nombre}%`]);
        return res.json(result);
    } catch (error) {
        console.error("Error buscarLocalProductos:", error);
        return res.status(500).json({ message: "Error al buscar productos", error: error.message });
    }
};

// ---------------------------------------------------------------
// Crear: un solo paso (maestro + relación con el local)
// ---------------------------------------------------------------
// Body nuevo:      { id_local, id_categoria_producto, local_producto_nombre, local_producto_precio,
//                    [local_producto_descripcion, local_producto_foto, local_producto_estado, producto_variante] }
// Body antiguo:    también se acepta { id_local, id_producto, ... } (usa ese maestro).
// local_producto_precio_app se IGNORA si viene en el body: siempre se calcula aquí.
export const postLocalProductos = async (req, res) => {
    try {
        const b = req.body ?? {};
        const idLocal = aEntero(b.id_local);
        const nombre = limpiar(b.local_producto_nombre);
        const precio = aPrecio(b.local_producto_precio);
        const descripcion = limpiar(b.local_producto_descripcion);
        const porcentaje = Number(b.local_producto_porcentaje_adicional ?? 0);
        const estado = b.local_producto_estado === undefined || b.local_producto_estado === "" ? "DISPONIBLE" : normalizarEstado(b.local_producto_estado);
        if (!estado) throw new ErrorNegocio(400, "Estado inválido");

        if (!idLocal) throw new ErrorNegocio(400, "Debe indicar el local");
        if (!nombre || nombre.length > 200) throw new ErrorNegocio(400, "El nombre es obligatorio (máximo 200 caracteres)");
        if (!precio) throw new ErrorNegocio(400, "Ingresa un precio mayor a 0");
        if (descripcion.length > 500) throw new ErrorNegocio(400, "La descripción no puede superar 500 caracteres");
        if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) throw new ErrorNegocio(400, "El porcentaje adicional debe estar entre 0 y 100");

        const resultado = await enTransaccion(async (cx, locks) => {
            const [local] = await cx.query("SELECT id_local FROM locales WHERE id_local = ?", [idLocal]);
            if (local.length === 0) throw new ErrorNegocio(404, "Local no encontrado");

            const maestro = await resolverMaestro(cx, locks, {
                id_producto: b.id_producto, id_categoria_producto: b.id_categoria_producto, nombre, variante: b.producto_variante
            });

            const precioApp = calcularPrecioApp(precio);
            const [ins] = await cx.query(
                `INSERT INTO local_productos (id_local, id_producto, local_producto_nombre, local_producto_precio, local_producto_porcentaje_adicional,
                    local_producto_precio_app, local_producto_descripcion, local_producto_foto, local_producto_estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [idLocal, maestro.id_producto, nombre, precio, porcentaje, precioApp, descripcion || null,
                    b.local_producto_foto || null, estado]);

            return { id_local_producto: ins.insertId, id_producto: maestro.id_producto, producto_maestro_creado: maestro.creado, local_producto_precio_app: precioApp };
        });

        return res.status(201).json({ ...resultado, message: "Producto registrado con éxito" });
    } catch (error) {
        return responderError(res, error, "postLocalProductos", "Error al registrar producto del local");
    }
};

// ---------------------------------------------------------------
// Editar: solo datos específicos del local. Nunca modifica el maestro compartido.
// ---------------------------------------------------------------
// Campos editables: nombre, precio, descripción, foto, estado, porcentaje adicional.
// id_local e id_producto NO se pueden cambiar desde el body; local_producto_precio_app se recalcula si cambia el precio.
// Si llega id_categoria_producto distinta a la del maestro actual, el producto se REAPUNTA a otro maestro
// (buscado o creado) sin tocar el maestro anterior, que puede seguir usándose en otros locales.
const actualizarLocalProducto = async (req, res, parcial) => {
    try {
        const id = aEntero(req.params.id);
        const b = req.body ?? {};
        if (!id) throw new ErrorNegocio(400, "ID de producto inválido");
        if (!parcial && (b.local_producto_nombre === undefined || b.local_producto_precio === undefined)) {
            throw new ErrorNegocio(400, "Para PUT se requieren local_producto_nombre y local_producto_precio (usa PATCH para cambios parciales)");
        }

        const cambios = {};
        if (b.local_producto_nombre !== undefined) {
            const nombre = limpiar(b.local_producto_nombre);
            if (!nombre || nombre.length > 200) throw new ErrorNegocio(400, "El nombre es obligatorio (máximo 200 caracteres)");
            cambios.local_producto_nombre = nombre;
        }
        if (b.local_producto_precio !== undefined) {
            const precio = aPrecio(b.local_producto_precio);
            if (!precio) throw new ErrorNegocio(400, "Ingresa un precio mayor a 0");
            cambios.local_producto_precio = precio;
            cambios.local_producto_precio_app = calcularPrecioApp(precio);
        }
        if (b.local_producto_descripcion !== undefined) {
            const descripcion = limpiar(b.local_producto_descripcion);
            if (descripcion.length > 500) throw new ErrorNegocio(400, "La descripción no puede superar 500 caracteres");
            cambios.local_producto_descripcion = descripcion || null;
        }
        if (b.local_producto_foto !== undefined) cambios.local_producto_foto = b.local_producto_foto || null;
        if (b.local_producto_estado !== undefined) {
            const estado = normalizarEstado(b.local_producto_estado);
            if (!estado) throw new ErrorNegocio(400, "Estado inválido");
            cambios.local_producto_estado = estado;
        }
        if (b.local_producto_porcentaje_adicional !== undefined) {
            const porcentaje = Number(b.local_producto_porcentaje_adicional);
            if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) throw new ErrorNegocio(400, "El porcentaje adicional debe estar entre 0 y 100");
            cambios.local_producto_porcentaje_adicional = porcentaje;
        }

        const filaActualizada = await enTransaccion(async (cx, locks) => {
            const [filas] = await cx.query("SELECT * FROM local_productos WHERE id_local_producto = ? FOR UPDATE", [id]);
            if (filas.length === 0) throw new ErrorNegocio(404, "Producto del local no encontrado");
            const actual = filas[0];

            // Cambio de categoría => otro maestro solo para ESTE local.
            const nuevaCategoria = aEntero(b.id_categoria_producto);
            if (nuevaCategoria) {
                const [[maestro]] = await cx.query("SELECT id_categoria_producto, producto_descripcion FROM productos WHERE id_producto = ?", [actual.id_producto]);
                if (nuevaCategoria !== Number(maestro.id_categoria_producto)) {
                    const nuevo = await resolverMaestro(cx, locks, {
                        id_categoria_producto: nuevaCategoria,
                        nombre: cambios.local_producto_nombre ?? actual.local_producto_nombre,
                        variante: b.producto_variante ?? maestro.producto_descripcion
                    });
                    cambios.id_producto = nuevo.id_producto;
                }
            }

            const columnas = Object.keys(cambios); // solo nombres de columnas definidos arriba
            if (columnas.length === 0) throw new ErrorNegocio(400, "No se proporcionaron campos para actualizar");
            await cx.query(
                `UPDATE local_productos SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_local_producto = ?`,
                [...columnas.map((c) => cambios[c]), id]);

            const [rows] = await cx.query(SQL_LOCAL_PRODUCTO, [id]);
            return rows[0];
        });

        return res.json(filaActualizada);
    } catch (error) {
        return responderError(res, error, parcial ? "patchLocalProductos" : "putLocalProductos", "Error al actualizar producto del local");
    }
};

// Actualizar completamente un producto del local
export const putLocalProductos = (req, res) => actualizarLocalProducto(req, res, false);

// Actualizar parcialmente un producto del local
export const patchLocalProductos = (req, res) => actualizarLocalProducto(req, res, true);

// ---------------------------------------------------------------
// Eliminar (solo la relación con el local; el maestro no se toca)
// ---------------------------------------------------------------
export const deleteLocalProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query("DELETE FROM local_productos WHERE id_local_producto = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Producto del local no encontrado" });
        return res.status(204).send();
    } catch (error) {
        return responderError(res, error, "deleteLocalProductos", "Error al eliminar producto del local");
    }
};
