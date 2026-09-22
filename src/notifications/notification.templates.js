// src/notifications/notification.templates.js
//
// Un solo lugar para todos los textos de push. Nunca incluir pedido_pin,
// datos de pago ni información sensible (sección 8 del prompt).

import { NOTIFICATION_EVENTS } from "./notification.types.js";

const codigo = pedido => pedido?.pedido_codigo || `#${pedido?.id_pedido ?? ""}`;

// Cada evento puede tener una plantilla distinta por rol destinatario.
const PLANTILLAS = {
    [NOTIFICATION_EVENTS.ORDER_CREATED]: {
        LOCAL: pedido => ({ titulo: "🛵 ¡Nuevo pedido!", mensaje: `Tienes un nuevo pedido ${codigo(pedido)} pendiente.` }),
    },
    [NOTIFICATION_EVENTS.ORDER_ACCEPTED]: {
        CLIENTE: pedido => ({ titulo: "Pedido aceptado", mensaje: `El local ya está preparando tu pedido ${codigo(pedido)}.` }),
    },
    [NOTIFICATION_EVENTS.ORDER_READY]: {
        REPARTIDOR: pedido => ({ titulo: "Pedido listo", mensaje: `El pedido ${codigo(pedido)} está listo para recoger.` }),
        CLIENTE: pedido => ({ titulo: "Pedido listo", mensaje: `Tu pedido ${codigo(pedido)} ya está listo.` }),
    },
    [NOTIFICATION_EVENTS.DRIVER_ASSIGNED]: {
        REPARTIDOR: pedido => ({ titulo: "🚚 Pedido asignado", mensaje: `Se te asignó el pedido ${codigo(pedido)}.` }),
        CLIENTE: pedido => ({ titulo: "Repartidor asignado", mensaje: `Un repartidor va en camino a recoger tu pedido ${codigo(pedido)}.` }),
    },
    [NOTIFICATION_EVENTS.ORDER_PICKED_UP]: {
        CLIENTE: pedido => ({ titulo: "Pedido en camino", mensaje: `Tu pedido ${codigo(pedido)} va en camino.` }),
        LOCAL: pedido => ({ titulo: "Pedido en camino", mensaje: `El pedido ${codigo(pedido)} salió con el repartidor.` }),
    },
    [NOTIFICATION_EVENTS.ORDER_DELIVERED]: {
        CLIENTE: pedido => ({ titulo: "✅ Pedido entregado", mensaje: `Tu pedido ${codigo(pedido)} fue entregado. ¡Buen provecho!` }),
        LOCAL: pedido => ({ titulo: "✅ Pedido entregado", mensaje: `El pedido ${codigo(pedido)} fue entregado con éxito.` }),
    },
    [NOTIFICATION_EVENTS.ORDER_NOT_DELIVERED]: {
        CLIENTE: pedido => ({ titulo: "Pedido no entregado", mensaje: `Tu pedido ${codigo(pedido)} no pudo ser entregado.` }),
        LOCAL: pedido => ({ titulo: "Pedido no entregado", mensaje: `El pedido ${codigo(pedido)} no pudo ser entregado.` }),
    },
    [NOTIFICATION_EVENTS.ORDER_CANCELLED]: {
        CLIENTE: (pedido, extra) => ({ titulo: "Pedido cancelado", mensaje: `Tu pedido ${codigo(pedido)} fue cancelado${extra?.motivo ? `: ${extra.motivo}` : "."}` }),
        LOCAL: (pedido, extra) => ({ titulo: "Pedido cancelado", mensaje: `El pedido ${codigo(pedido)} fue cancelado${extra?.motivo ? `: ${extra.motivo}` : "."}` }),
        REPARTIDOR: (pedido, extra) => ({ titulo: "Pedido cancelado", mensaje: `El pedido ${codigo(pedido)} fue cancelado${extra?.motivo ? `: ${extra.motivo}` : "."}` }),
    },
    [NOTIFICATION_EVENTS.PAYMENT_CONFIRMED]: {
        CLIENTE: pedido => ({ titulo: "Pago confirmado", mensaje: `Tu pago del pedido ${codigo(pedido)} fue confirmado. Tu pedido continúa en proceso.` }),
        LOCAL: pedido => ({ titulo: "Pago confirmado", mensaje: `El pago del pedido ${codigo(pedido)} fue confirmado.` }),
    },
    [NOTIFICATION_EVENTS.DRIVER_NEARBY]: {
        CLIENTE: pedido => ({ titulo: "Tu repartidor está cerca", mensaje: `El repartidor de tu pedido ${codigo(pedido)} está a punto de llegar.` }),
    },
};

// Devuelve { titulo, mensaje } para un evento + rol. Si no existe plantilla
// específica para ese rol, cae a un mensaje genérico (nunca deja al
// destinatario sin notificación por falta de plantilla).
export const construirMensaje = (event, rol, pedido, extra = {}) => {
    const plantilla = PLANTILLAS[event]?.[rol];
    if (plantilla) return plantilla(pedido, extra);
    return { titulo: "MultiCourier", mensaje: `Actualización del pedido ${codigo(pedido)}.` };
};