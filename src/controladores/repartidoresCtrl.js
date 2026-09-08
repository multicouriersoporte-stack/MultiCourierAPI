/* import { conmysql } from "../db.js";

// GET: Obtener todos los repartidores.
export const getRepartidores = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT * FROM repartidores ORDER BY repartidor_posicion_ranking ASC`);
        res.json(result);
    } catch (error) {
        console.error("Error getRepartidores:", error);
        return res.status(500).json({ message: "Error al consultar repartidores", error: error.message });
    }
};

// GET: Obtener repartidor por ID.
export const getRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM repartidores WHERE id_repartidor = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_repartidor: 0, message: "Repartidor no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener repartidor por usuario.
export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM repartidores WHERE id_usuario = ?`, [id_usuario]);
        if (result.length === 0) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Buscar repartidor por código.
export const getRepartidorPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM repartidores WHERE repartidor_codigo = ?`, [codigo]);
        if (result.length === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// POST: Crear repartidor.
export const postRepartidores = async (req, res) => {
    try {
        const { id_usuario, repartidor_codigo, repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado, repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso } = req.body;
        const [result] = await conmysql.query(`INSERT INTO repartidores (id_usuario, repartidor_codigo, repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado, repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id_usuario, repartidor_codigo, repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado, repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso]);
        res.status(201).json({ id_repartidor: result.insertId, message: "Repartidor registrado con éxito" });
    } catch (error) {
        console.error("Error postRepartidores:", error);
        return res.status(500).json({ message: "Error al registrar repartidor", error: error.message });
    }
};

// PUT: Actualizar completamente un repartidor.
export const putRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_usuario, repartidor_codigo, repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado, repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso } = req.body;
        const valores = [id_usuario, repartidor_codigo, repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado, repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso, id];
        const [result] = await conmysql.query(`UPDATE repartidores SET id_usuario = ?, repartidor_codigo = ?, repartidor_placa = ?, repartidor_tipo_vehiculo = ?, repartidor_calificacion = ?, repartidor_puntos = ?, repartidor_posicion_ranking = ?, repartidor_total_pedidos = ?, repartidor_pedidos_aceptados = ?, repartidor_pedidos_rechazados = ?, repartidor_pedidos_no_entregados = ?, repartidor_porcentaje_aceptacion = ?, repartidor_horas_conectado = ?, repartidor_limite_billetera = ?, repartidor_confianza = ?, repartidor_permite_telefono = ?, repartidor_fecha_ingreso = ? WHERE id_repartidor = ?`, valores);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
        const [rows] = await conmysql.query(`SELECT * FROM repartidores WHERE id_repartidor = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error putRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

// PATCH: Actualización parcial de un repartidor.
export const patchRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["id_usuario", "repartidor_codigo", "repartidor_placa", "repartidor_tipo_vehiculo", "repartidor_calificacion", "repartidor_puntos", "repartidor_posicion_ranking", "repartidor_total_pedidos", "repartidor_pedidos_aceptados", "repartidor_pedidos_rechazados", "repartidor_pedidos_no_entregados", "repartidor_porcentaje_aceptacion", "repartidor_horas_conectado", "repartidor_limite_billetera", "repartidor_confianza", "repartidor_permite_telefono", "repartidor_fecha_ingreso"];
        const campos = [], valores = [];
        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }
        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
        valores.push(id);
        const [result] = await conmysql.query(`UPDATE repartidores SET ${campos.join(", ")} WHERE id_repartidor = ?`, valores);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
        const [rows] = await conmysql.query(`SELECT * FROM repartidores WHERE id_repartidor = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error patchRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

// DELETE: Eliminar repartidor.
export const deleteRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM repartidores WHERE id_repartidor = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleteRepartidores:", error);
        return res.status(500).json({ message: "Error al eliminar repartidor", error: error.message });
    }
};
 */
// src/controladores/repartidoresCtrl.js
import { conmysql } from "../db.js";

// Consulta auxiliar reutilizable para incluir datos del usuario y estado
const SELECT_REPARTIDOR_BASE = `
    SELECT 
        r.*,
        u.usuario_nombre,
        u.usuario_apellido,
        CONCAT(u.usuario_nombre, ' ', u.usuario_apellido) AS usuario_nombre_completo,
        u.usuario_email,
        u.usuario_telefono,
        er.estado_repartidor_nombre,
        er.estado_repartidor_descripcion,
        er.estado_repartidor_visible_front,
        er.estado_repartidor_permite_pedidos,
        er.estado_repartidor_permite_seleccion
    FROM repartidores r
    LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
    LEFT JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor
`;

// Consultas
export const getRepartidores = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999 ELSE r.repartidor_posicion_ranking END ASC,
                r.repartidor_total_pedidos ASC,
                r.repartidor_calificacion DESC
        `);
        return res.json(result);
    } catch (error) {
        console.error("Error getRepartidores:", error);
        return res.status(500).json({ message: "Error al consultar repartidores", error: error.message });
    }
};

export const getRepartidoresDisponibles = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE er.estado_repartidor_estado = 1
                AND er.estado_repartidor_permite_pedidos = 1
                AND er.estado_repartidor_permite_seleccion = 1
            ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999 ELSE r.repartidor_posicion_ranking END ASC,
                r.repartidor_total_pedidos ASC,
                r.repartidor_calificacion DESC
        `);
        return res.json(result);
    } catch (error) {
        console.error("Error getRepartidoresDisponibles:", error);
        return res.status(500).json({ message: "Error al consultar repartidores disponibles", error: error.message });
    }
};

export const getRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.id_repartidor = ?
        `, [id]);

        if (result.length === 0) return res.status(404).json({ id_repartidor: 0, message: "Repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.id_usuario = ?
        `, [id_usuario]);

        if (result.length === 0) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

export const getRepartidorPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.repartidor_codigo = ?
        `, [codigo]);

        if (result.length === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

export const postRepartidores = async (req, res) => {
    try {
        const {
            id_usuario, id_estado_repartidor, repartidor_codigo, repartidor_placa,
            repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos,
            repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados,
            repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados,
            repartidor_porcentaje_aceptacion, repartidor_horas_conectado,
            repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono,
            repartidor_fecha_ingreso
        } = req.body;

        if (!id_usuario) return res.status(400).json({ message: "id_usuario es obligatorio" });

        const estadoRepartidor = id_estado_repartidor || 5;
        const [result] = await conmysql.query(`
            INSERT INTO repartidores (
                id_usuario, id_estado_repartidor, repartidor_codigo, repartidor_placa,
                repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos,
                repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados,
                repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados,
                repartidor_porcentaje_aceptacion, repartidor_horas_conectado,
                repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono,
                repartidor_fecha_ingreso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_usuario, estadoRepartidor, repartidor_codigo || null, repartidor_placa || null,
            repartidor_tipo_vehiculo || null, repartidor_calificacion ?? 5.00,
            repartidor_puntos ?? 0, repartidor_posicion_ranking ?? null,
            repartidor_total_pedidos ?? 0, repartidor_pedidos_aceptados ?? 0,
            repartidor_pedidos_rechazados ?? 0, repartidor_pedidos_no_entregados ?? 0,
            repartidor_porcentaje_aceptacion ?? 100.00, repartidor_horas_conectado ?? 0,
            repartidor_limite_billetera ?? 25.00, repartidor_confianza ?? 0,
            repartidor_permite_telefono ?? 0, repartidor_fecha_ingreso || new Date()
        ]);

        const [repartidor] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.id_repartidor = ?
        `, [result.insertId]);

        return res.status(201).json({ message: "Repartidor registrado con éxito", repartidor: repartidor[0] });
    } catch (error) {
        console.error("Error postRepartidores:", error);
        return res.status(500).json({ message: "Error al registrar repartidor", error: error.message });
    }
};

export const cambiarEstadoRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_estado_repartidor } = req.body;

        if (!id_estado_repartidor) return res.status(400).json({ message: "id_estado_repartidor es obligatorio" });

        await conmysql.query(`
            UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?
        `, [id_estado_repartidor, id]);

        const [resultado] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.id_repartidor = ?
        `, [id]);

        return res.json({ message: "Estado del repartidor actualizado correctamente", repartidor: resultado[0] });
    } catch (error) {
        console.error("Error cambiarEstadoRepartidor:", error);
        return res.status(500).json({ message: "Error al cambiar estado del repartidor", error: error.message });
    }
};

export const putRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_usuario, id_estado_repartidor, repartidor_codigo, repartidor_placa,
            repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos,
            repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados,
            repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados,
            repartidor_porcentaje_aceptacion, repartidor_horas_conectado,
            repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono,
            repartidor_fecha_ingreso
        } = req.body;

        const [result] = await conmysql.query(`
            UPDATE repartidores SET
                id_usuario = ?, id_estado_repartidor = ?, repartidor_codigo = ?,
                repartidor_placa = ?, repartidor_tipo_vehiculo = ?, repartidor_calificacion = ?,
                repartidor_puntos = ?, repartidor_posicion_ranking = ?, repartidor_total_pedidos = ?,
                repartidor_pedidos_aceptados = ?, repartidor_pedidos_rechazados = ?,
                repartidor_pedidos_no_entregados = ?, repartidor_porcentaje_aceptacion = ?,
                repartidor_horas_conectado = ?, repartidor_limite_billetera = ?,
                repartidor_confianza = ?, repartidor_permite_telefono = ?, repartidor_fecha_ingreso = ?
            WHERE id_repartidor = ?
        `, [
            id_usuario, id_estado_repartidor, repartidor_codigo, repartidor_placa,
            repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos,
            repartidor_posicion_ranking, repartidor_total_pedidos, repartidor_pedidos_aceptados,
            repartidor_pedidos_rechazados, repartidor_pedidos_no_entregados,
            repartidor_porcentaje_aceptacion, repartidor_horas_conectado,
            repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono,
            repartidor_fecha_ingreso, id
        ]);

        if (result.affectedRows === 0) return res.status(404).json({ message: "Repartidor no encontrado" });

        const [rows] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.id_repartidor = ?
        `, [id]);

        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

export const patchRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_usuario", "id_estado_repartidor", "repartidor_codigo", "repartidor_placa",
            "repartidor_tipo_vehiculo", "repartidor_calificacion", "repartidor_puntos",
            "repartidor_posicion_ranking", "repartidor_total_pedidos", "repartidor_pedidos_aceptados",
            "repartidor_pedidos_rechazados", "repartidor_pedidos_no_entregados",
            "repartidor_porcentaje_aceptacion", "repartidor_horas_conectado",
            "repartidor_limite_billetera", "repartidor_confianza", "repartidor_permite_telefono",
            "repartidor_fecha_ingreso"
        ];

        const campos = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });

        valores.push(id);
        const [result] = await conmysql.query(`
            UPDATE repartidores SET ${campos.join(", ")} WHERE id_repartidor = ?
        `, valores);

        if (result.affectedRows === 0) return res.status(404).json({ message: "Repartidor no encontrado" });

        const [rows] = await conmysql.query(`
            ${SELECT_REPARTIDOR_BASE}
            WHERE r.id_repartidor = ?
        `, [id]);

        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

export const deleteRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`
            DELETE FROM repartidores WHERE id_repartidor = ?
        `, [id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteRepartidores:", error);
        return res.status(500).json({ message: "Error al eliminar repartidor", error: error.message });
    }
};
