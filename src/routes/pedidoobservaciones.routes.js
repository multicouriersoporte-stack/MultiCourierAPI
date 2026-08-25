import { Router } from "express";

import {
    getPedidoObservaciones,
    getPedidoObservacionPorId,
    getObservacionesPorPedido,
    getObservacionesPorEmisor,
    getObservacionesPorReceptor,
    getObservacionesPorTipo,
    postPedidoObservacion,
    putPedidoObservacion,
    patchPedidoObservacion,
    deletePedidoObservacion
} from "../controladores/pedidoobservacionesCtrl.js";

const router = Router();


// =====================================================
// PEDIDO OBSERVACIONES
// =====================================================

// Obtener todas las observaciones
router.get(
    "/pedido-observaciones",
    getPedidoObservaciones
);


// Obtener observación por ID
router.get(
    "/pedido-observaciones/:id",
    getPedidoObservacionPorId
);


// Obtener observaciones de un pedido
router.get(
    "/pedidos/:id_pedido/observaciones",
    getObservacionesPorPedido
);


// Obtener observaciones enviadas por usuario
router.get(
    "/usuarios/:id_usuario_emisor/observaciones-enviadas",
    getObservacionesPorEmisor
);


// Obtener observaciones recibidas por usuario
router.get(
    "/usuarios/:id_usuario_receptor/observaciones-recibidas",
    getObservacionesPorReceptor
);


// Obtener observaciones por tipo
router.get(
    "/pedido-observaciones/tipo/:id_tipo_observacion",
    getObservacionesPorTipo
);


// Crear observación
router.post(
    "/pedido-observaciones",
    postPedidoObservacion
);


// Actualizar observación completa
router.put(
    "/pedido-observaciones/:id",
    putPedidoObservacion
);


// Actualizar parcialmente
router.patch(
    "/pedido-observaciones/:id",
    patchPedidoObservacion
);


// Eliminar observación
router.delete(
    "/pedido-observaciones/:id",
    deletePedidoObservacion
);


export default router;
