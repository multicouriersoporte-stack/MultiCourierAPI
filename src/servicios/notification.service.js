// src/notifications/notification.service.js
//
// Servicio central de notificaciones. Los controladores de negocio
// (pedidosCtrl.js) NO deben conocer FCM, tokens ni la tabla `notificaciones`:
// solo llaman a notificationService.notifyXxx(pedido) y este módulo resuelve
// destinatarios, guarda historial, envía push y limpia tokens inválidos.
//
// Nunca lanza (throw): cualquier error queda logueado y se devuelve
// { success:false, error }, para que el envío sea "fire-and-forget" desde
// los controladores (sección 9 del prompt: no debe bloquear la respuesta HTTP).

import { NOTIFICATION_EVENTS, NOTIFICATION_META } from "./notification.types.js";
import { construirMensaje } from "./notification.templates.js";
import { guardarHistorial, obtenerTokensActivos, desactivarTokens } from "./notification.repository.js";
import { enviarPushMultiple } from "../ws/FCMPush.js";

// Roles que deben recibir cada evento (además de las reglas de "nunca
// notificar al actor", aplicadas más abajo). Ver sección 5 del prompt.
const DESTINATARIOS_POR_EVENTO = {
    [NOTIFICATION_EVENTS.ORDER_CREATED]: ["LOCAL"],
    [NOTIFICATION_EVENTS.ORDER_ACCEPTED]: ["CLIENTE"],
    [NOTIFICATION_EVENTS.ORDER_READY]: ["REPARTIDOR", "CLIENTE"],
    [NOTIFICATION_EVENTS.DRIVER_ASSIGNED]: ["REPARTIDOR", "CLIENTE"],
    [NOTIFICATION_EVENTS.ORDER_PICKED_UP]: ["CLIENTE", "LOCAL"],
    [NOTIFICATION_EVENTS.ORDER_DELIVERED]: ["CLIENTE", "LOCAL"],
    [NOTIFICATION_EVENTS.ORDER_NOT_DELIVERED]: ["CLIENTE", "LOCAL"],
    [NOTIFICATION_EVENTS.ORDER_CANCELLED]: ["CLIENTE", "LOCAL", "REPARTIDOR"],
    [NOTIFICATION_EVENTS.PAYMENT_CONFIRMED]: ["CLIENTE", "LOCAL"],
    [NOTIFICATION_EVENTS.DRIVER_NEARBY]: ["CLIENTE"],
};

// Requiere que obtenerPedidoPorIdInterno incluya cliente_id_usuario,
// local_id_usuario y repartidor_id_usuario (ver PATCH_pedidosCtrl.md).
const idUsuarioPorRol = (pedido, rol) => {
    switch (rol) {
        case "CLIENTE": return pedido?.cliente_id_usuario ?? null;
        case "LOCAL": return pedido?.local_id_usuario ?? null;
        case "REPARTIDOR": return pedido?.repartidor_id_usuario ?? null;
        default: return null;
    }
};

// Resuelve { id_usuario, rol }[] para un evento, sin duplicados y sin
// incluir al actor que provocó la acción.
const resolverDestinatarios = (event, pedido, actorUserId) => {
    const roles = DESTINATARIOS_POR_EVENTO[event] || [];
    const vistos = new Set();
    const destinatarios = [];

    for (const rol of roles) {
        const idUsuario = Number(idUsuarioPorRol(pedido, rol));
        if (!idUsuario) continue; // ej. pedido sin repartidor asignado aún
        if (actorUserId && Number(actorUserId) === idUsuario) continue;
        if (vistos.has(idUsuario)) continue;
        vistos.add(idUsuario);
        destinatarios.push({ id_usuario: idUsuario, rol });
    }
    return destinatarios;
};

const notify = async ({ event, pedido, actorUserId = null, extra = {} }) => {
    try {
        if (!Object.values(NOTIFICATION_EVENTS).includes(event)) {
            console.warn("[NotificationService] Evento desconocido:", event);
            return { success: false, error: "EVENTO_DESCONOCIDO" };
        }
        if (!pedido?.id_pedido) {
            console.warn("[NotificationService] notify() llamado sin pedido válido para el evento", event);
            return { success: false, error: "PEDIDO_INVALIDO" };
        }

        const meta = NOTIFICATION_META[event] || { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO" };
        const destinatarios = resolverDestinatarios(event, pedido, actorUserId);
        if (!destinatarios.length) return { success: true, enviados: 0, destinatarios: 0 };

        // 1) Historial en `notificaciones` — se guarda por destinatario porque
        //    el texto puede variar según el rol (ej. cliente vs. local).
        await Promise.all(destinatarios.map(({ id_usuario, rol }) => {
            const { titulo, mensaje } = construirMensaje(event, rol, pedido, extra);
            return guardarHistorial([id_usuario], {
                tipo: meta.notificacion_tipo,
                titulo,
                mensaje,
                referencia_tipo: meta.referencia_tipo,
                referencia_id: pedido.id_pedido,
            }).catch(error => console.error("[NotificationService] Error guardando historial:", error));
        }));

        // 2) Tokens activos. Para destinatarios LOCAL se incluyen también los
        //    tokens registrados solo con id_local (dispositivo compartido).
        const idsUsuario = destinatarios.map(d => d.id_usuario);
        const incluyeLocal = destinatarios.some(d => d.rol === "LOCAL");
        const tokens = await obtenerTokensActivos(idsUsuario, incluyeLocal ? pedido.id_local : null);
        if (!tokens.length) return { success: true, enviados: 0, destinatarios: destinatarios.length, sinTokens: true };

        // 3) Envío FCM. El título/mensaje del multicast usa la plantilla del
        //    primer destinatario; el detalle por rol ya quedó en el historial
        //    individual de cada usuario (paso 1).
        const { titulo, mensaje } = construirMensaje(event, destinatarios[0].rol, pedido, extra);
        const resultado = await enviarPushMultiple(tokens, {
            titulo,
            mensaje,
            sonido: "default",
            datos: {
                type: event,
                orderId: String(pedido.id_pedido),
                pedido_codigo: pedido.pedido_codigo || "",
                screen: meta.screen || "order-detail",
            },
        });

        // 4) Limpieza de tokens inválidos reportados por FCM.
        if (resultado.tokensInvalidos?.length) {
            await desactivarTokens(resultado.tokensInvalidos).catch(error =>
                console.error("[NotificationService] Error desactivando tokens inválidos:", error)
            );
        }

        console.log(
            `[NotificationService] ${event} pedido=${pedido.id_pedido} destinatarios=${destinatarios.length} enviados=${resultado.enviados ?? 0}`
        );
        return { success: true, destinatarios: destinatarios.length, ...resultado };
    } catch (error) {
        console.error("[NotificationService] Error en notify():", error);
        return { success: false, error: error?.message || "ERROR_NOTIFICATION_SERVICE" };
    }
};

// --- Métodos de conveniencia (los que llaman los controladores) --------

const notifyOrderCreated = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.ORDER_CREATED, pedido, actorUserId });
const notifyOrderAccepted = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.ORDER_ACCEPTED, pedido, actorUserId });
const notifyOrderReady = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.ORDER_READY, pedido, actorUserId });
const notifyDriverAssigned = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.DRIVER_ASSIGNED, pedido, actorUserId });
const notifyOrderPickedUp = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.ORDER_PICKED_UP, pedido, actorUserId });
const notifyOrderDelivered = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.ORDER_DELIVERED, pedido, actorUserId });
const notifyOrderNotDelivered = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.ORDER_NOT_DELIVERED, pedido, actorUserId });
const notifyOrderCancelled = (pedido, motivo = null, actorUserId = null) =>
    notify({ event: NOTIFICATION_EVENTS.ORDER_CANCELLED, pedido, actorUserId, extra: { motivo } });
const notifyPaymentConfirmed = (pedido, actorUserId = null) => notify({ event: NOTIFICATION_EVENTS.PAYMENT_CONFIRMED, pedido, actorUserId });

// Traduce un cambio de estado (nombre del nuevo estado) al evento correcto,
// para usar con un solo llamado desde putPedido.
const notifyOrderStatusChanged = async (pedido, estadoNuevoNombre, actorUserId = null) => {
    const nuevo = String(estadoNuevoNombre || "").trim().toUpperCase();
    if (nuevo === "EN_PREPARACION") return notifyOrderAccepted(pedido, actorUserId);
    if (nuevo === "LISTO") return notifyOrderReady(pedido, actorUserId);
    if (nuevo === "EN_CAMINO") return notifyOrderPickedUp(pedido, actorUserId);
    if (nuevo === "ENTREGADO") return notifyOrderDelivered(pedido, actorUserId);
    if (nuevo === "NO_ENTREGADO") return notifyOrderNotDelivered(pedido, actorUserId);
    return { success: true, enviados: 0, omitted: true };
};

export const notificationService = {
    notify,
    notifyOrderCreated,
    notifyOrderAccepted,
    notifyOrderReady,
    notifyDriverAssigned,
    notifyOrderPickedUp,
    notifyOrderDelivered,
    notifyOrderNotDelivered,
    notifyOrderCancelled,
    notifyPaymentConfirmed,
    notifyOrderStatusChanged,
};

export default notificationService;