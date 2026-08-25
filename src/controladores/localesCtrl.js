import { conmysql } from "../db.js";

// GET: Obtener todos los locales
export const getLocales = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT * FROM locales ORDER BY local_nombre_comercial ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getLocales:", error);
        return res.status(500).json({ message: "Error al consultar locales", error: error.message });
    }
};

// GET: Obtener local por ID
export const getLocalxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM locales WHERE id_local = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_local: 0, message: "Local no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener local por ID de usuario
export const getLocalPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM locales WHERE id_usuario = ?`, [id_usuario]);
        if (result.length === 0) return res.status(404).json({ message: "No existe un local asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener local por código
export const getLocalPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM locales WHERE local_codigo = ?`, [codigo]);
        if (result.length === 0) return res.status(404).json({ message: "Local no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener local por RUC
export const getLocalPorRuc = async (req, res) => {
    try {
        const { ruc } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM locales WHERE local_ruc = ?`, [ruc]);
        if (result.length === 0) return res.status(404).json({ message: "Local no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getLocalPorRuc:", error);
        return res.status(500).json({ message: "Local no encontrado", error: error.message });
    }
};

// GET: Buscar locales por nombre
export const buscarLocales = async (req, res) => {
    try {
        const { nombre } = req.query;
        if (!nombre) return res.status(400).json({ message: "Debe proporcionar un nombre para buscar" });

        const [result] = await conmysql.query(
            `SELECT * FROM locales WHERE local_nombre_comercial LIKE ? ORDER BY local_nombre_comercial ASC`,
            [`%${nombre}%`]
        );
        return res.json(result);
    } catch (error) {
        console.error("Error buscarLocales:", error);
        return res.status(500).json({ message: "Error al buscar locales", error: error.message });
    }
};

// POST: Crear local
export const postLocales = async (req, res) => {
    try {
        const {
            id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_ruc,
            local_descripcion, local_foto, local_telefono, local_email, local_categoria,
            local_filtro, id_provincia, id_canton, local_direccion, local_referencia,
            local_latitud, local_longitud, local_calificacion, local_comision_porcentaje,
            local_tiempo_preparacion_promedio, local_hora_apertura, local_hora_cierre,
            local_fecha_registro, id_estado
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO locales (id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_ruc, local_descripcion, local_foto, local_telefono, local_email, local_categoria, local_filtro, id_provincia, id_canton, local_direccion, local_referencia, local_latitud, local_longitud, local_calificacion, local_comision_porcentaje, local_tiempo_preparacion_promedio, local_hora_apertura, local_hora_cierre, local_fecha_registro, id_estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_ruc,
                local_descripcion, local_foto, local_telefono, local_email, local_categoria,
                local_filtro, id_provincia, id_canton, local_direccion, local_referencia,
                local_latitud, local_longitud, local_calificacion, local_comision_porcentaje,
                local_tiempo_preparacion_promedio, local_hora_apertura, local_hora_cierre,
                local_fecha_registro, id_estado
            ]
        );

        return res.status(201).json({ id_local: result.insertId, message: "Local registrado con éxito" });
    } catch (error) {
        console.error("Error postLocales:", error);
        return res.status(500).json({ message: "Error al registrar local", error: error.message });
    }
};

// PUT: Actualizar completamente un local
export const putLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_ruc,
            local_descripcion, local_foto, local_telefono, local_email, local_categoria,
            local_filtro, id_provincia, id_canton, local_direccion, local_referencia,
            local_latitud, local_longitud, local_calificacion, local_comision_porcentaje,
            local_tiempo_preparacion_promedio, local_hora_apertura, local_hora_cierre,
            local_fecha_registro, id_estado
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE locales SET id_usuario = ?, local_codigo = ?, local_nombre_comercial = ?, local_razon_social = ?, local_ruc = ?, local_descripcion = ?, local_foto = ?, local_telefono = ?, local_email = ?, local_categoria = ?, local_filtro = ?, id_provincia = ?, id_canton = ?, local_direccion = ?, local_referencia = ?, local_latitud = ?, local_longitud = ?, local_calificacion = ?, local_comision_porcentaje = ?, local_tiempo_preparacion_promedio = ?, local_hora_apertura = ?, local_hora_cierre = ?, local_fecha_registro = ?, id_estado = ? WHERE id_local = ?`,
            [
                id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_ruc,
                local_descripcion, local_foto, local_telefono, local_email, local_categoria,
                local_filtro, id_provincia, id_canton, local_direccion, local_referencia,
                local_latitud, local_longitud, local_calificacion, local_comision_porcentaje,
                local_tiempo_preparacion_promedio, local_hora_apertura, local_hora_cierre,
                local_fecha_registro, id_estado, id
            ]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: "Local no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM locales WHERE id_local = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putLocales:", error);
        return res.status(500).json({ message: "Error al actualizar local", error: error.message });
    }
};

// PATCH: Actualización parcial de local
export const patchLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_usuario", "local_codigo", "local_nombre_comercial", "local_razon_social", "local_ruc",
            "local_descripcion", "local_foto", "local_telefono", "local_email", "local_categoria",
            "local_filtro", "id_provincia", "id_canton", "local_direccion", "local_referencia",
            "local_latitud", "local_longitud", "local_calificacion", "local_comision_porcentaje",
            "local_tiempo_preparacion_promedio", "local_hora_apertura", "local_hora_cierre",
            "local_fecha_registro", "id_estado"
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
        const [result] = await conmysql.query(
            `UPDATE locales SET ${campos.join(", ")} WHERE id_local = ?`,
            valores
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: "Local no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM locales WHERE id_local = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchLocales:", error);
        return res.status(500).json({ message: "Error al actualizar local", error: error.message });
    }
};

// DELETE: Eliminar local
export const deleteLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM locales WHERE id_local = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Local no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteLocales:", error);
        return res.status(500).json({ message: "Error al eliminar local", error: error.message });
    }
};
