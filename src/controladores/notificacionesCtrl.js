import { conmysql } from "../db.js";

const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;

const obtenerIdUsuario = req => {
    const u = req.usuario || {};
    return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

// ── Helper interno reutilizable: cualquier controlador de cualquier módulo
// puede importar esto y crear notificaciones sin acoplarse a este archivo.
export const crearNotificacion = async ({
    id_usuario_destino, tipo, titulo, mensaje,
    referencia_tipo = null, referencia_id = null, conexion = null
}) => {
    if (!id_usuario_destino || !tipo || !titulo || !mensaje) return null;
    const db = conexion || conmysql;
    const [result] = await db.query(`
        INSERT INTO notificaciones (id_usuario_destino, notificacion_tipo, notificacion_titulo, notificacion_mensaje, notificacion_referencia_tipo, notificacion_referencia_id)
        VALUES (?,?,?,?,?,?)
    `, [id_usuario_destino, tipo, titulo, mensaje, referencia_tipo, referencia_id]);
    return result.insertId;
};

// Crea la misma notificación para varios usuarios de una vez (ej. cliente + repartidor + local).
export const crearNotificacionesMasivas = async (destinatarios, datosComunes, conexion = null) => {
    const resultados = [];
    for (const id_usuario_destino of destinatarios.filter(Boolean)) {
        resultados.push(await crearNotificacion({ ...datosComunes, id_usuario_destino, conexion }));
    }
    return resultados;
};

export const getMisNotificaciones = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_usuario = obtenerIdUsuario(req);
        if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });

        const { tipo, solo_no_leidas, limite } = req.query;
        const condiciones = ["id_usuario_destino = ?"];
        const valores = [id_usuario];

        if (tipo && String(tipo).trim()) { condiciones.push("UPPER(notificacion_tipo) = ?"); valores.push(String(tipo).trim().toUpperCase()); }
        if (String(solo_no_leidas).toLowerCase() === "true") condiciones.push("notificacion_leida = 0");

        let sql = `SELECT * FROM notificaciones WHERE ${condiciones.join(" AND ")} ORDER BY notificacion_fecha DESC`;
        const limiteNum = Number(limite);
        if (Number.isInteger(limiteNum) && limiteNum > 0) sql += ` LIMIT ${Math.min(limiteNum, 200)}`;

        const [notificaciones] = await conmysql.query(sql, valores);
        const [[{ total_no_leidas }]] = await conmysql.query(`SELECT COUNT(*) AS total_no_leidas FROM notificaciones WHERE id_usuario_destino=? AND notificacion_leida=0`, [id_usuario]);

        return res.json({ success: true, total: notificaciones.length, total_no_leidas, notificaciones });
    } catch (error) {
        console.error("[Notificaciones] Error getMisNotificaciones:", error);
        return res.status(500).json({ success: false, message: "Error al consultar notificaciones." });
    }
};

export const marcarNotificacionLeida = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID no es válido." });
        const id_usuario = obtenerIdUsuario(req);

        const [resultado] = await conmysql.query(
            `UPDATE notificaciones SET notificacion_leida=1, notificacion_fecha_leida=NOW() WHERE id_notificacion=? AND id_usuario_destino=?`,
            [id, id_usuario]
        );
        if (!resultado.affectedRows) return res.status(404).json({ success: false, message: "Notificación no encontrada." });
        return res.json({ success: true, message: "Notificación marcada como leída." });
    } catch (error) {
        console.error("[Notificaciones] Error marcarNotificacionLeida:", error);
        return res.status(500).json({ success: false, message: "Error al actualizar la notificación." });
    }
};

export const marcarTodasLeidas = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_usuario = obtenerIdUsuario(req);
        await conmysql.query(`UPDATE notificaciones SET notificacion_leida=1, notificacion_fecha_leida=NOW() WHERE id_usuario_destino=? AND notificacion_leida=0`, [id_usuario]);
        return res.json({ success: true, message: "Todas las notificaciones fueron marcadas como leídas." });
    } catch (error) {
        console.error("[Notificaciones] Error marcarTodasLeidas:", error);
        return res.status(500).json({ success: false, message: "Error al actualizar notificaciones." });
    }
};

export const eliminarNotificacion = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID no es válido." });
        const id_usuario = obtenerIdUsuario(req);
        const [resultado] = await conmysql.query(`DELETE FROM notificaciones WHERE id_notificacion=? AND id_usuario_destino=?`, [id, id_usuario]);
        if (!resultado.affectedRows) return res.status(404).json({ success: false, message: "Notificación no encontrada." });
        return res.status(204).send();
    } catch (error) {
        console.error("[Notificaciones] Error eliminarNotificacion:", error);
        return res.status(500).json({ success: false, message: "Error al eliminar la notificación." });
    }
};