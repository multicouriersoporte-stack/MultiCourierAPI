// src/ws/FOMPush.js

import admin from "firebase-admin";

// Firebase Admin se inicializa una sola vez. FCM y Socket.IO funcionan de forma independiente.
let firebaseInicializado = false;

const inicializarFirebase = () => {
    if (firebaseInicializado) return admin;
    try {
        if (admin.apps.length > 0) {
            firebaseInicializado = true;
            console.log("🔥 Firebase Admin ya estaba inicializado.");
            return admin;
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Faltan variables de entorno de Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, "\n"),
            }),
        });

        firebaseInicializado = true;
        console.log("🔥 Firebase Admin inicializado correctamente.");
        return admin;
    } catch (error) {
        console.error("❌ Error inicializando Firebase Admin:", error?.message || error);
        throw error;
    }
};

const getFirebaseAdmin = () => inicializarFirebase();
const getMessaging = () => getFirebaseAdmin().messaging();

// Envía un Push a un único dispositivo.
export const enviarPush = async (token, { titulo = "MultiCourier", mensaje = "", datos = {}, sonido = "default" } = {}) => {
    if (!token || typeof token !== "string") {
        console.warn("⚠️ No se puede enviar Push: token FCM inválido.");
        return { success: false, enviado: false, error: "TOKEN_FCM_INVALIDO" };
    }

    try {
        const messaging = getMessaging();
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
        const messaging = getMessaging();
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

// Notificación específica para un nuevo pedido.
export const enviarPushNuevoPedido = async ({ token, pedidoId, codigoPedido = "", nombreLocal = "" }) =>
    enviarPush(token, {
        titulo: "🛵 ¡Nuevo pedido!",
        mensaje: codigoPedido ? `Tienes un nuevo pedido ${codigoPedido} pendiente.` : "Tienes un nuevo pedido pendiente.",
        datos: { tipo: "nuevo_pedido", pedido_id: pedidoId, codigo_pedido: codigoPedido, local_nombre: nombreLocal },
        sonido: "default",
    });

// Envía la notificación de nuevo pedido a todos los dispositivos del local.
export const enviarPushNuevoPedidoMultiple = async ({ tokens, pedidoId, codigoPedido = "", nombreLocal = "" }) =>
    enviarPushMultiple(tokens, {
        titulo: "🛵 ¡Nuevo pedido!",
        mensaje: codigoPedido ? `Tienes un nuevo pedido ${codigoPedido} pendiente.` : "Tienes un nuevo pedido pendiente.",
        datos: { tipo: "nuevo_pedido", pedido_id: pedidoId, codigo_pedido: codigoPedido, local_nombre: nombreLocal },
        sonido: "default",
    });

// FCM exige que todos los valores de data sean strings.
const normalizarData = (datos = {}) => {
    const resultado = {};

    Object.entries(datos).forEach(([clave, valor]) => {
        if (valor === undefined || valor === null) return;
        resultado[clave] = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
    });

    return resultado;
};

// Construye el mensaje común para Android e iOS.
const crearMensaje = ({ titulo, mensaje, data, sonido, token }) => ({
    ...(token && { token }),
    notification: { title: String(titulo), body: String(mensaje) },
    data,
    android: {
        priority: "high",
        notification: {
            channelId: "multicourier_pedidos",
            sound: sonido,
            defaultSound: false,
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

// Permite inicializar Firebase explícitamente si se desea.
export const inicializarFOMPush = () => inicializarFirebase();

const FOMPush = {
    inicializar: inicializarFOMPush,
    enviar: enviarPush,
    enviarMultiple: enviarPushMultiple,
    nuevoPedido: enviarPushNuevoPedido,
    nuevoPedidoMultiple: enviarPushNuevoPedidoMultiple,
};

export default FOMPush;
