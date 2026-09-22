// src/notifications/device.service.js
//
// Lógica de negocio para push_tokens. pushCtrl.js queda como una capa
// delgada de request/response sobre este servicio (sección 15 del prompt:
// "Refactor de pushCtrl.js").

import { conmysql } from "../db.js";

const obtenerIdUsuario = req => {
    const usuario = req.usuario || {};
    return Number(usuario.id_usuario ?? usuario.usuario_id ?? usuario.idUsuario ?? usuario.id ?? usuario.usuarioId) || null;
};

let tablaAsegurada = false;
const asegurarTablaTokens = async () => {
    if (tablaAsegurada) return;
    await conmysql.query(`
        CREATE TABLE IF NOT EXISTS push_tokens (
            id_push_token BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            token_fcm VARCHAR(512) NOT NULL,
            id_usuario BIGINT UNSIGNED NOT NULL,
            id_local BIGINT UNSIGNED NULL,
            plataforma VARCHAR(30) NOT NULL DEFAULT 'android',
            activo TINYINT(1) NOT NULL DEFAULT 1,
            fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id_push_token),
            UNIQUE KEY uq_push_tokens_token (token_fcm),
            KEY idx_push_tokens_local_activo (id_local, activo),
            KEY idx_push_tokens_usuario_activo (id_usuario, activo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tablaAsegurada = true;
};

// Registra o reactiva el token del dispositivo actual.
//
// Seguridad (sección 11 del prompt):
// - id_usuario SIEMPRE sale de req.usuario, nunca del body.
// - Si el usuario autenticado es dueño de un LOCAL, el token se asocia a
//   SU id_local automáticamente; no se confía en el id_local del body.
// - Si el usuario no es dueño de ningún local, no se le permite asociar
//   ningún id_local (evita que un CLIENTE/REPARTIDOR se registre como local).
export const registrarTokenDispositivo = async req => {
    const idUsuarioSesion = obtenerIdUsuario(req);
    if (!idUsuarioSesion) return { status: 401, body: { success: false, message: "Usuario no autenticado." } };

    const token = String(req.body?.token_fcm || "").trim();
    if (!token) return { status: 400, body: { success: false, message: "token_fcm es obligatorio." } };

    const plataforma = String(req.body?.plataforma || "android").trim().slice(0, 30) || "android";

    await asegurarTablaTokens();

    const [localesDelUsuario] = await conmysql.query(`SELECT id_local FROM locales WHERE id_usuario=? LIMIT 1`, [idUsuarioSesion]);
    const idLocal = localesDelUsuario.length ? Number(localesDelUsuario[0].id_local) : null;

    await conmysql.query(`
        INSERT INTO push_tokens (token_fcm, id_usuario, id_local, plataforma, activo)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            id_usuario=VALUES(id_usuario), id_local=VALUES(id_local), plataforma=VALUES(plataforma), activo=1,
            fecha_actualizacion=CURRENT_TIMESTAMP
    `, [token, idUsuarioSesion, idLocal, plataforma]);

    return { status: 200, body: { success: true, message: "Token FCM registrado." } };
};

// Desactiva tokens del usuario autenticado. Si el body trae token_fcm,
// desactiva solo ese dispositivo (logout de un dispositivo); si no,
// desactiva todos los del usuario (logout global).
export const desactivarTokenDispositivo = async req => {
    const idUsuario = obtenerIdUsuario(req);
    if (!idUsuario) return { status: 401, body: { success: false, message: "Usuario no autenticado." } };

    await asegurarTablaTokens();
    const token = String(req.body?.token_fcm || "").trim();

    if (token) {
        await conmysql.query(`UPDATE push_tokens SET activo=0 WHERE id_usuario=? AND token_fcm=?`, [idUsuario, token]);
    } else {
        await conmysql.query(`UPDATE push_tokens SET activo=0 WHERE id_usuario=?`, [idUsuario]);
    }
    return { status: 200, body: { success: true, message: "Token(s) FCM desactivado(s)." } };
};

export { asegurarTablaTokens };