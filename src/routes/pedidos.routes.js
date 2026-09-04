// src/routes/pedidos.routes.js
import express from "express";
import {
  getPedidos, getPedidoPorId, getPedidosPorCliente, getPedidosPorLocal,
  getPedidoPorCodigo, getPedidosPorEstado, postPedido, putPedido,
  patchPedido, entregarPedidoConPin, confirmarPagoPedido, deletePedido
} from "../controladores/pedidosCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// GET: consultas según rol. Administrativos pueden consultar todos.
const ROLES_GET = ["CLIENTE", "LOCAL", "REPARTIDOR", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_ADMIN = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];

router.get("/pedidos", verificarToken, permitirRoles(...ROLES_GET), getPedidos);
router.get("/pedidos/admin", verificarToken, permitirRoles(...ROLES_ADMIN), getPedidos);
router.get("/pedidos/codigo/:codigo", verificarToken, permitirRoles(...ROLES_GET), getPedidoPorCodigo);
router.get("/pedidos/estado/:id_estado", verificarToken, permitirRoles(...ROLES_GET), getPedidosPorEstado);
router.get("/pedidos/cliente/:id_cliente", verificarToken, permitirRoles(...ROLES_ADMIN), getPedidosPorCliente);
router.get("/clientes/:id_cliente/pedidos", verificarToken, permitirRoles(...ROLES_ADMIN), getPedidosPorCliente);
router.get("/pedidos/local/:id_local", verificarToken, permitirRoles("LOCAL", ...ROLES_ADMIN), getPedidosPorLocal);
router.get("/pedidos/:id", verificarToken, permitirRoles(...ROLES_GET), getPedidoPorId);

// POST: únicamente CLIENTE puede crear pedidos.
router.post("/pedidos", verificarToken, permitirRoles("CLIENTE"), postPedido);

// PUT/PATCH: CLIENTE, LOCAL, REPARTIDOR, SOPORTE y ADMINISTRADOR.
// Las transiciones y campos permitidos se validan en pedidosCtrl.js.
const ROLES_MODIFICAR = ["CLIENTE", "LOCAL", "REPARTIDOR", "SOPORTE", "ADMINISTRADOR"];
router.put("/pedidos/:id", verificarToken, permitirRoles(...ROLES_MODIFICAR), putPedido);
router.patch("/pedidos/:id", verificarToken, permitirRoles(...ROLES_MODIFICAR), patchPedido);
router.patch("/pedidos/:id/entregar", verificarToken, permitirRoles("REPARTIDOR"), entregarPedidoConPin);
router.patch("/pedidos/:id/confirmar-pago", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR"), confirmarPagoPedido);

// DELETE: únicamente SOPORTE y ADMINISTRADOR.
router.delete("/pedidos/:id", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR"), deletePedido);

export default router;
