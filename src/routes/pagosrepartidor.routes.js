import { Router } from "express";
import {
  getPagosPorRepartidor,
  postPagoRepartidor,
  getPagoRepartidorPorPedido,
  getMisPagosRepartidor,
  actualizarEstadoPagoRepartidor,
  getPagosRepartidores,
  confirmarPagoRepartidor
} from "../controladores/pagosrepartidorCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

router.get("/pagosrepartidores/repartidor/:id_repartidor", verificarToken,
  permitirRoles("SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"), getPagosPorRepartidor);

// Listar todos (administrativo)
router.get("/pagosrepartidores", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"), getPagosRepartidores);

// Pagos del repartidor autenticado
router.get("/pagosrepartidores/mis-pagos", verificarToken, permitirRoles("REPARTIDOR"), getMisPagosRepartidor);

// Consultar pago de un pedido
router.get("/pagosrepartidores/pedido/:id_pedido", verificarToken, permitirRoles("REPARTIDOR", "SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"), getPagoRepartidorPorPedido);

// Crear pago manualmente
router.post("/pagosrepartidores/pedido/:id_pedido", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR"), postPagoRepartidor);

// Actualizar estado
router.patch("/pagosrepartidores/:id/estado", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR"), actualizarEstadoPagoRepartidor);

router.patch("/pagosrepartidores/:id/confirmar", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR"), confirmarPagoRepartidor);

export default router;
