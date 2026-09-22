// src/notifications/notification.types.js

export const NOTIFICATION_EVENTS = {
    ORDER_CREATED: "ORDER_CREATED",
    ORDER_ACCEPTED: "ORDER_ACCEPTED",           // PENDIENTE → EN_PREPARACION
    ORDER_READY: "ORDER_READY",                 // LISTO
    DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
    ORDER_PICKED_UP: "ORDER_PICKED_UP",         // EN_CAMINO
    ORDER_DELIVERED: "ORDER_DELIVERED",
    ORDER_NOT_DELIVERED: "ORDER_NOT_DELIVERED",
    ORDER_CANCELLED: "ORDER_CANCELLED",
    PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
    // futuros (fase 2)
    DRIVER_NEARBY: "DRIVER_NEARBY",
    PROMO: "PROMO",
    SYSTEM_ALERT: "SYSTEM_ALERT",
};

// Metadatos que se persisten en la tabla `notificaciones` existente, y la
// pantalla de navegación (`screen`) que la app abre al tocar el push.
export const NOTIFICATION_META = {
    [NOTIFICATION_EVENTS.ORDER_CREATED]:       { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.ORDER_ACCEPTED]:      { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.ORDER_READY]:         { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.DRIVER_ASSIGNED]:     { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.ORDER_PICKED_UP]:     { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.ORDER_DELIVERED]:     { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.ORDER_NOT_DELIVERED]: { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.ORDER_CANCELLED]:     { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.PAYMENT_CONFIRMED]:   { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.DRIVER_NEARBY]:       { notificacion_tipo: "PEDIDO", referencia_tipo: "PEDIDO", screen: "order-detail" },
    [NOTIFICATION_EVENTS.PROMO]:               { notificacion_tipo: "PROMO", referencia_tipo: null, screen: "home" },
    [NOTIFICATION_EVENTS.SYSTEM_ALERT]:        { notificacion_tipo: "SISTEMA", referencia_tipo: null, screen: "home" },
};

// Ruta de navegación por rol dentro de la app Ionic (sección 12 del prompt).
export const RUTA_POR_ROL = {
    CLIENTE: id => `/orders/${id}`,
    REPARTIDOR: id => `/driver/orders/${id}`,
    LOCAL: id => `/store/orders/${id}`,
    SOPORTE: id => `/admin/orders/${id}`,
    ADMINISTRADOR: id => `/admin/orders/${id}`,
    CENTRAL: id => `/admin/orders/${id}`,
    SUPERVISOR: id => `/admin/orders/${id}`,
};