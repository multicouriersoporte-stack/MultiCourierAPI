import { conmysql } from "../db.js";
import { calcularEstado, abiertoPorHorario, proximaOcurrencia } from "../utils/estadoLocal.js";

// GET: Obtener todos los locales
export const getLocales = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT * FROM locales ORDER BY local_nombre_comercial ASC`
        );
        return res.json(result.map(calcularEstado));
    } catch (error) {
        console.error("Error getLocales:", error);
        return res.status(500).json({
            message: "Error al consultar locales",
            error: error.message,
        });
    }
};

// GET: Obtener local por ID
export const getLocalxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM locales WHERE id_local = ?`,
            [id]
        );
        if (result.length === 0) {
            return res.status(404).json({ id_local: 0, message: "Local no encontrado" });
        }
        return res.json(calcularEstado(result[0]));
    } catch (error) {
        console.error("Error getLocalxid:", error);
        return res.status(500).json({
            message: "Error del servidor",
            error: error.message,
        });
    }
};

// GET: Obtener local por ID de usuario
export const getLocalPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM locales WHERE id_usuario = ?`,
            [id_usuario]
        );
        if (result.length === 0) {
            return res.status(404).json({
                message: "No existe un local asociado a este usuario",
            });
        }
        return res.json(calcularEstado(result[0]));
    } catch (error) {
        console.error("Error getLocalPorUsuario:", error);
        return res.status(500).json({
            message: "Error del servidor",
            error: error.message,
        });
    }
};

// GET: Obtener local por código
export const getLocalPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM locales WHERE local_codigo = ?`,
            [codigo]
        );
        if (result.length === 0) {
            return res.status(404).json({ message: "Local no encontrado" });
        }
        return res.json(calcularEstado(result[0]));
    } catch (error) {
        console.error("Error getLocalPorCodigo:", error);
        return res.status(500).json({
            message: "Error del servidor",
            error: error.message,
        });
    }
};

// GET: Obtener local por RUC
export const getLocalPorRuc = async (req, res) => {
    try {
        const { ruc } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM locales WHERE local_ruc = ?`,
            [ruc]
        );
        if (result.length === 0) {
            return res.status(404).json({ message: "Local no encontrado" });
        }
        return res.json(calcularEstado(result[0]));
    } catch (error) {
        console.error("Error getLocalPorRuc:", error);
        return res.status(500).json({
            message: "Error del servidor",
            error: error.message,
        });
    }
};

// GET: Buscar locales por nombre
export const buscarLocales = async (req, res) => {
    try {
        const { nombre } = req.query;
        if (!nombre) {
            return res.status(400).json({
                message: "Debe proporcionar un nombre para buscar",
            });
        }
        const [result] = await conmysql.query(
            `SELECT * FROM locales
             WHERE local_nombre_comercial LIKE ?
             ORDER BY local_nombre_comercial ASC`,
            [`%${nombre}%`]
        );
        return res.json(result.map(calcularEstado));
    } catch (error) {
        console.error("Error buscarLocales:", error);
        return res.status(500).json({
            message: "Error al buscar locales",
            error: error.message,
        });
    }
};

// POST: Crear local
// Los campos de modo manual usan los DEFAULT de la tabla (AUTO, NULL, NULL)
export const postLocales = async (req, res) => {
    try {
        const {
            id_usuario,
            local_codigo,
            local_nombre_comercial,
            local_razon_social,
            local_ruc,
            local_descripcion,
            local_foto,
            local_telefono,
            local_email,
            local_categoria,
            local_filtro,
            id_provincia,
            id_canton,
            local_direccion,
            local_referencia,
            local_latitud,
            local_longitud,
            local_calificacion,
            local_comision_porcentaje,
            local_tiempo_preparacion_promedio,
            local_hora_apertura,
            local_hora_cierre,
            local_fecha_registro,
            id_estado, // estado general del registro (activo/inactivo), no el open/close
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO locales (
                id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_ruc,
                local_descripcion, local_foto, local_telefono, local_email, local_categoria,
                local_filtro, id_provincia, id_canton, local_direccion, local_referencia,
                local_latitud, local_longitud, local_calificacion, local_comision_porcentaje,
                local_tiempo_preparacion_promedio, local_hora_apertura, local_hora_cierre,
                local_fecha_registro, id_estado
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_usuario,
                local_codigo,
                local_nombre_comercial,
                local_razon_social,
                local_ruc,
                local_descripcion,
                local_foto,
                local_telefono,
                local_email,
                local_categoria,
                local_filtro,
                id_provincia,
                id_canton,
                local_direccion,
                local_referencia,
                local_latitud,
                local_longitud,
                local_calificacion,
                local_comision_porcentaje,
                local_tiempo_preparacion_promedio,
                local_hora_apertura,
                local_hora_cierre,
                local_fecha_registro,
                id_estado,
            ]
        );

        // Devolvemos el local recién creado con el estado calculado
        const [rows] = await conmysql.query(
            `SELECT * FROM locales WHERE id_local = ?`,
            [result.insertId]
        );

        return res.status(201).json({
            message: "Local registrado con éxito",
            local: calcularEstado(rows[0]),
        });
    } catch (error) {
        console.error("Error postLocales:", error);
        return res.status(500).json({
            message: "Error al registrar local",
            error: error.message,
        });
    }
};

// PUT: Actualización completa
// NO se actualizan: id_estado, local_modo_manual, local_manual_desde, local_manual_hasta
export const putLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_usuario,
            local_codigo,
            local_nombre_comercial,
            local_razon_social,
            local_ruc,
            local_descripcion,
            local_foto,
            local_telefono,
            local_email,
            local_categoria,
            local_filtro,
            id_provincia,
            id_canton,
            local_direccion,
            local_referencia,
            local_latitud,
            local_longitud,
            local_calificacion,
            local_comision_porcentaje,
            local_tiempo_preparacion_promedio,
            local_hora_apertura,
            local_hora_cierre,
            local_fecha_registro,
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE locales SET
                id_usuario = ?,
                local_codigo = ?,
                local_nombre_comercial = ?,
                local_razon_social = ?,
                local_ruc = ?,
                local_descripcion = ?,
                local_foto = ?,
                local_telefono = ?,
                local_email = ?,
                local_categoria = ?,
                local_filtro = ?,
                id_provincia = ?,
                id_canton = ?,
                local_direccion = ?,
                local_referencia = ?,
                local_latitud = ?,
                local_longitud = ?,
                local_calificacion = ?,
                local_comision_porcentaje = ?,
                local_tiempo_preparacion_promedio = ?,
                local_hora_apertura = ?,
                local_hora_cierre = ?,
                local_fecha_registro = ?
             WHERE id_local = ?`,
            [
                id_usuario,
                local_codigo,
                local_nombre_comercial,
                local_razon_social,
                local_ruc,
                local_descripcion,
                local_foto,
                local_telefono,
                local_email,
                local_categoria,
                local_filtro,
                id_provincia,
                id_canton,
                local_direccion,
                local_referencia,
                local_latitud,
                local_longitud,
                local_calificacion,
                local_comision_porcentaje,
                local_tiempo_preparacion_promedio,
                local_hora_apertura,
                local_hora_cierre,
                local_fecha_registro,
                id,
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Local no encontrado" });
        }

        const [rows] = await conmysql.query(
            `SELECT * FROM locales WHERE id_local = ?`,
            [id]
        );
        return res.json(calcularEstado(rows[0]));
    } catch (error) {
        console.error("Error putLocales:", error);
        return res.status(500).json({
            message: "Error al actualizar local",
            error: error.message,
        });
    }
};

// PATCH: Actualización parcial
// NO se permiten: id_estado, local_modo_manual, local_manual_desde, local_manual_hasta
export const patchLocales = async (req, res) => {
    try {
        const { id } = req.params;

        const camposPermitidos = [
            "local_nombre_comercial",
            "local_razon_social",
            "local_ruc",
            "local_descripcion",
            "local_foto",
            "local_telefono",
            "local_email",
            "local_categoria",
            "local_filtro",
            "id_provincia",
            "id_canton",
            "local_direccion",
            "local_referencia",
            "local_latitud",
            "local_longitud",
            "local_calificacion",
            "local_comision_porcentaje",
            "local_tiempo_preparacion_promedio",
            "local_hora_apertura",
            "local_hora_cierre",
            // Si necesitas permitir id_usuario u otros, agrégalos aquí
        ];

        const campos = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (campos.length === 0) {
            return res.status(400).json({
                message: "No se proporcionaron campos válidos para actualizar",
            });
        }

        valores.push(Number(id));

        const sql = `UPDATE locales SET ${campos.join(", ")} WHERE id_local = ?`;
        console.log("📝 SQL PATCH:", sql);
        console.log("📦 Valores:", valores);

        const [result] = await conmysql.query(sql, valores);

        if (result.affectedRows === 0) {
            const [existe] = await conmysql.query(
                `SELECT id_local FROM locales WHERE id_local = ?`,
                [Number(id)]
            );
            if (existe.length === 0) {
                return res.status(404).json({ message: "Local no encontrado" });
            }
        }

        const [rows] = await conmysql.query(
            `SELECT * FROM locales WHERE id_local = ?`,
            [Number(id)]
        );

        return res.json({
            message: "Local actualizado correctamente",
            local: calcularEstado(rows[0]),
        });
    } catch (error) {
        console.error("❌ Error patchLocales:", error);
        return res.status(500).json({
            message: "Error al actualizar local",
            error: error.message,
        });
    }
};

// PATCH: Abrir/cerrar manualmente (único endpoint que toca los campos de modo manual)
export const cambiarEstadoLocal = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_estado } = req.body;

        const estado = Number(id_estado);
        if (![1, 2].includes(estado)) {
            return res.status(400).json({
                message: "El estado debe ser 1 (ABIERTO) o 2 (CERRADO)",
            });
        }

        const [rows] = await conmysql.query(
            "SELECT * FROM locales WHERE id_local = ?",
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "Local no encontrado" });
        }

        const local = rows[0];
        const quiereAbrir = estado === 1;
        const auto = abiertoPorHorario(
            local.local_hora_apertura,
            local.local_hora_cierre
        );

        let modo;
        let desde = null;
        let hasta = null;

        if (quiereAbrir === auto) {
            // Coincide con el horario → vuelve a modo automático
            modo = "AUTO";
        } else {
            modo = quiereAbrir ? "ABIERTO" : "CERRADO";
            desde = Date.now();
            // Abierto manual → hasta el cierre automático
            // Cerrado manual → hasta la apertura automática
            hasta = proximaOcurrencia(
                quiereAbrir ? local.local_hora_cierre : local.local_hora_apertura
            );
        }

        await conmysql.query(
            `UPDATE locales
             SET local_modo_manual = ?, local_manual_desde = ?, local_manual_hasta = ?
             WHERE id_local = ?`,
            [modo, desde, hasta, id]
        );

        const [nuevo] = await conmysql.query(
            "SELECT * FROM locales WHERE id_local = ?",
            [id]
        );
        const localCalc = calcularEstado(nuevo[0]);

        return res.json({
            message: localCalc.local_abierto
                ? "Local abierto correctamente"
                : "Local cerrado correctamente",
            local: localCalc,
        });
    } catch (error) {
        console.error("Error cambiarEstadoLocal:", error);
        return res.status(500).json({
            message: "Error al cambiar el estado del local",
            error: error.message,
        });
    }
};

// DELETE: Eliminar local
export const deleteLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `DELETE FROM locales WHERE id_local = ?`,
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Local no encontrado" });
        }
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteLocales:", error);
        return res.status(500).json({
            message: "Error al eliminar local",
            error: error.message,
        });
    }
};
