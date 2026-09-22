// src/notifications/notification.repository.js
//
// Única capa que toca las tablas `notificaciones` y `push_tokens`. Reutiliza
// crearNotificacion / crearNotificacionesMasivas ya existentes en
// notificacionesCtrl.js en vez de duplicar SQL de inserción de historial.

import { conmysql } from "../db.js";
import { crearNotificacion, crearNotificacionesMasivas } from "../controladores/notificacionesCtrl.js";

// Guarda el historial para uno o varios destinatarios con el mismo
// título/mensaje. `destinatarios` es un array de id_usuario.
export const guardarHistorial = async (destinatarios, { tipo, titulo, mensaje, referencia_tipo, referencia_id }) => {
    const lista = [...new Set((destinatarios || []).filter(Boolean))];
    if (!lista.length) return null;

    if (lista.length === 1) {
        return crearNotificacion({
            id_usuario_destino: lista[0],
            tipo,
            titulo,
            mensaje,
            referencia_tipo,
            referencia_id,
        });
    }
    return crearNotificacionesMasivas(lista, { tipo, titulo, mensaje, referencia_tipo, referencia_id });
};

// Tokens activos de una lista de usuarios y, opcionalmente, de un local
// (cubre dispositivos registrados solo con id_local, p. ej. una tablet
// compartida del local).
export const obtenerTokensActivos = async (idsUsuario = [], idLocal = null) => {
    const ids = [...new Set((idsUsuario || []).filter(Boolean).map(Number))];
    if (!ids.length && !idLocal) return [];

    const condiciones = [];
    const valores = [];
    if (ids.length) {
        condiciones.push(`pt.id_usuario IN (${ids.map(() => "?").join(",")})`);
        valores.push(...ids);
    }
    if (idLocal) {
        condiciones.push(`pt.id_local = ?`);
        valores.push(idLocal);
    }
    if (!condiciones.length) return [];

    const [filas] = await conmysql.query(
        `SELECT DISTINCT pt.token_fcm FROM push_tokens pt WHERE pt.activo = 1 AND (${condiciones.join(" OR ")})`,
        valores
    );
    return filas.map(f => f.token_fcm).filter(Boolean);
};

// Marca como inactivos (activo = 0) los tokens que Firebase reportó
// inválidos o no registrados. Nunca se eliminan físicamente (auditoría).
export const desactivarTokens = async (tokens = []) => {
    const lista = [...new Set((tokens || []).filter(Boolean))];
    if (!lista.length) return;
    await conmysql.query(`UPDATE push_tokens SET activo = 0 WHERE token_fcm IN (?)`, [lista]);
};
