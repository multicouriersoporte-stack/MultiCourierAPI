// src/routes/pedidodetalles.routes.js

import { Router } from "express";
import {
    getPedidosDetalles, getPedidoDetallePorId, getDetallesPorPedido, getDetallesPorLocalProducto,
    postPedidoDetalle, putPedidoDetalle, patchPedidoDetalle, deletePedidoDetalle
} from "../controladores/pedidodetallesCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

// Rutas de consulta
router.get("/pedidos-detalles", getPedidosDetalles);
router.get("/pedidos-detalles/:id", getPedidoDetallePorId);
//router.get("/pedidos/:id_pedido/detalles", getDetallesPorPedido);
router.get("/pedidos/:id/detalles", verificarToken, permitirRoles(...ROLES_GET), getPedidoDetalles);
router.get("/local-productos/:id_local_producto/pedidos-detalles", getDetallesPorLocalProducto);

// Rutas CRUD
router.post("/pedidos-detalles", postPedidoDetalle);
router.put("/pedidos-detalles/:id", putPedidoDetalle);
router.patch("/pedidos-detalles/:id", patchPedidoDetalle);
router.delete("/pedidos-detalles/:id", deletePedidoDetalle);

export default router;
