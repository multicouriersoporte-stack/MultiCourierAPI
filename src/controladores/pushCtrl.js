/* import { conmysql } from "../db.js";
import { enviarPushMultiple } from "../ws/FCMPush.js";

const obtenerIdUsuario = req => {
    const usuario = req.usuario || {};
    return Number(usuario.id_usuario ?? usuario.usuario_id ?? usuario.idUsuario ?? usuario.id ?? usuario.usuarioId) || null;
};

const normalizarId = valor => Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;

const asegurarTablaTokens = async () => {
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
};

export const registrarToken = async (req, res) => {
    try {
        const idUsuarioSesion = obtenerIdUsuario(req);
        const token = String(req.body?.token_fcm || "").trim();
        const idUsuario = normalizarId(req.body?.id_usuario) || idUsuarioSesion;
        let idLocal = normalizarId(req.body?.id_local);
        const plataforma = String(req.body?.plataforma || "android").trim().slice(0, 30) || "android";

        if (!idUsuarioSesion || !idUsuario || idUsuario !== idUsuarioSesion) {
            return res.status(403).json({ success: false, message: "El token no pertenece al usuario autenticado." });
        }
        if (!token) return res.status(400).json({ success: false, message: "token_fcm es obligatorio." });

        if (!idLocal) {
            const [locales] = await conmysql.query(
                `SELECT id_local FROM locales WHERE id_usuario=? LIMIT 1`,
                [idUsuario]
            );
            idLocal = locales[0]?.id_local ? Number(locales[0].id_local) : null;
        }

        if (!idLocal) {
            return res.status(400).json({ success: false, message: "No se encontró un local asociado al usuario." });
        }

        await asegurarTablaTokens();
        await conmysql.query(`
            INSERT INTO push_tokens (token_fcm, id_usuario, id_local, plataforma, activo)
            VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                id_usuario=VALUES(id_usuario), id_local=VALUES(id_local), plataforma=VALUES(plataforma), activo=1,
                fecha_actualizacion=CURRENT_TIMESTAMP
        `, [token, idUsuario, idLocal, plataforma]);

        return res.json({ success: true, message: "Token FCM registrado." });
    } catch (error) {
        console.error("[Push] Error registrando token:", error);
        return res.status(500).json({ success: false, message: "No se pudo registrar el token FCM." });
    }
};

export const desactivarToken = async (req, res) => {
    try {
        const idUsuario = obtenerIdUsuario(req);
        if (!idUsuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        await asegurarTablaTokens();
        await conmysql.query(`UPDATE push_tokens SET activo=0 WHERE id_usuario=?`, [idUsuario]);
        return res.json({ success: true, message: "Tokens FCM desactivados." });
    } catch (error) {
        console.error("[Push] Error desactivando tokens:", error);
        return res.status(500).json({ success: false, message: "No se pudieron desactivar los tokens FCM." });
    }
};

export const enviarPushAlLocal = async (idLocal, { tipo, titulo, mensaje, pedidoId, codigoPedido } = {}) => {
    const local = normalizarId(idLocal);
    if (!local) return { success: false, enviados: 0, error: "LOCAL_INVALIDO" };

    try {
        await asegurarTablaTokens();
        const [filas] = await conmysql.query(
            `SELECT DISTINCT pt.token_fcm
             FROM push_tokens pt
             LEFT JOIN locales l ON l.id_usuario=pt.id_usuario
             WHERE pt.activo=1 AND (pt.id_local=? OR l.id_local=?)`,
            [local, local]
        );
        const tokens = filas.map(fila => fila.token_fcm).filter(Boolean);
        if (!tokens.length) return { success: false, enviados: 0, error: "SIN_TOKENS" };

        const resultado = await enviarPushMultiple(tokens, {
            titulo,
            mensaje,
            sonido: "default",
            datos: {
                tipo,
                pedido_id: pedidoId,
                codigo_pedido: codigoPedido,
                id_local: local
            }
        });

        if (resultado.tokensInvalidos?.length) {
            await conmysql.query(
                `UPDATE push_tokens SET activo=0 WHERE token_fcm IN (?)`,
                [resultado.tokensInvalidos]
            );
        }
        return resultado;
    } catch (error) {
        console.error("[Push] Error enviando push al local:", error);
        return { success: false, enviados: 0, error: error?.message || "ERROR_PUSH_LOCAL" };
    }
};

export const notificarNuevoPedidoAlLocal = (pedido, tipo = "nuevo_pedido") => enviarPushAlLocal(pedido?.id_local, {
    tipo,
    titulo: tipo === "pedido_cancelado" ? "Pedido cancelado" : tipo === "pedido_actualizado" ? "Pedido actualizado" : "Nuevo pedido",
    mensaje: tipo === "pedido_cancelado"
        ? `El pedido ${pedido?.pedido_codigo || pedido?.id_pedido || ""} fue cancelado.`
        : tipo === "pedido_actualizado"
            ? `El pedido ${pedido?.pedido_codigo || pedido?.id_pedido || ""} fue actualizado.`
            : `Recibiste el pedido ${pedido?.pedido_codigo || pedido?.id_pedido || ""}.`,
    pedidoId: pedido?.id_pedido,
    codigoPedido: pedido?.pedido_codigo
});
 */


// src/ws/FCMPush.js
//
// Capa de bajo nivel: solo sabe hablar con FCM. No conoce pedidos, roles ni
// la BD — eso vive en notification.service.js. Se mantiene la misma API
// pública (enviarPush, enviarPushMultiple, etc.) para no romper imports
// existentes; internamente ahora usa la inicialización centralizada de
// src/config/firebase-admin.js en vez de crear su propia instancia de admin.

import { getFCMMessaging } from "../config/firebase-admin.js";

const CANAL_NOTIFICACIONES = "orders";

// Envía un Push a un único dispositivo.
export const enviarPush = async (token, { titulo = "MultiCourier", mensaje = "", datos = {}, sonido = "default" } = {}) => {
    if (!token || typeof token !== "string") {
        console.warn("⚠️ No se puede enviar Push: token FCM inválido.");
        return { success: false, enviado: false, error: "TOKEN_FCM_INVALIDO" };
    }

    try {
        const messaging = getFCMMessaging();
        const data = normalizarData(datos);
        const message = crearMensaje({ titulo, mensaje, data, sonido, token });
        const messageId = await messaging.send(message);

        console.log("📲 Push enviado correctamente:", {
            messageId,
            token: token.substring(0, 12) + "...",
            titulo,
        });

        return { success: true, enviado: true, messageId };
    } catch (error) {
        console.error("❌ Error enviando Push:", { code: error?.code, message: error?.message });

        if (esTokenInvalido(error)) {
            console.warn("🗑️ Token FCM inválido o expirado. Debe eliminarse de la BD.");
            return { success: false, enviado: false, tokenInvalido: true, error: error?.code || "TOKEN_INVALIDO" };
        }

        return { success: false, enviado: false, tokenInvalido: false, error: error?.code || error?.message || "ERROR_FCM" };
    }
};

// Envía el mismo Push a varios dispositivos. FCM permite máximo 500 tokens por lote.
export const enviarPushMultiple = async (tokens, { titulo = "MultiCourier", mensaje = "", datos = {}, sonido = "default" } = {}) => {
    const tokensValidos = [...new Set((tokens || []).filter(token => typeof token === "string").map(token => token.trim()).filter(Boolean))];

    if (!tokensValidos.length) {
        console.warn("⚠️ No existen tokens FCM para enviar.");
        return { success: false, enviados: 0, fallidos: 0, tokensInvalidos: [] };
    }

    try {
        const messaging = getFCMMessaging();
        const data = normalizarData(datos);
        const resultados = [];

        for (let i = 0; i < tokensValidos.length; i += 500) {
            const lote = tokensValidos.slice(i, i + 500);
            const respuesta = await messaging.sendEachForMulticast({
                ...crearMensaje({ titulo, mensaje, data, sonido }),
                tokens: lote,
            });
            resultados.push({ lote, respuesta });
        }

        let enviados = 0;
        let fallidos = 0;
        const tokensInvalidos = [];

        for (const resultado of resultados) {
            enviados += resultado.respuesta.successCount;
            fallidos += resultado.respuesta.failureCount;

            resultado.respuesta.responses.forEach((respuesta, index) => {
                if (respuesta.success) return;

                const error = respuesta.error;
                const token = resultado.lote[index];

                if (esTokenInvalido(error)) tokensInvalidos.push(token);

                console.warn("⚠️ Error enviando Push:", {
                    token: token.substring(0, 12) + "...",
                    code: error?.code,
                    message: error?.message,
                });
            });
        }

        console.log("📲 Push multicast procesado:", {
            total: tokensValidos.length,
            enviados,
            fallidos,
            tokensInvalidos: tokensInvalidos.length,
        });

        return { success: enviados > 0, enviados, fallidos, tokensInvalidos };
    } catch (error) {
        console.error("❌ Error general enviando Push multicast:", error?.message || error);
        return {
            success: false,
            enviados: 0,
            fallidos: tokensValidos.length,
            tokensInvalidos: [],
            error: error?.code || error?.message || "ERROR_FCM",
        };
    }
};

// FCM exige que todos los valores de data sean strings.
const normalizarData = (datos = {}) => {
    const resultado = {};
    Object.entries(datos).forEach(([clave, valor]) => {
        if (valor === undefined || valor === null) return;
        resultado[clave] = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
    });
    return resultado;
};

// Construye el mensaje común para Android e iOS. Canal único "orders" de
// alta prioridad (decisión tomada en el prompt, sección "Decisiones que
// puedes tomar sin preguntar").
const crearMensaje = ({ titulo, mensaje, data, sonido, token }) => ({
    ...(token && { token }),
    notification: { title: String(titulo), body: String(mensaje) },
    data,
    android: {
        priority: "high",
        notification: {
            channelId: CANAL_NOTIFICACIONES,
            sound: sonido,
            icon: "ic_launcher",
            defaultVibrateTimings: true,
            priority: "max",
            visibility: "public",
        },
    },
    apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: sonido, badge: 1 } },
    },
});

// Detecta tokens FCM que Firebase ya no reconoce.
const esTokenInvalido = error =>
    ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error?.code);

const FCMPush = { enviar: enviarPush, enviarMultiple: enviarPushMultiple };
export default FCMPush;
