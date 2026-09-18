import { Router } from "express";
import {
  asignarRepartidorAutomaticamente,
  getRepartidoresDisponiblesAsignacion,
  asignarRepartidorManualmente,
  asignarRepartidorForzado,
  reasignarRepartidor,
  reasignarRepartidorForzado,
  getAsignacionesPedido
} from "../controladores/pedidorepartidoresCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Asignación automática: selecciona el mejor repartidor disponible.
router.post("/pedidos/:id_pedido/asignar-repartidor", verificarToken, permitirRoles("LOCAL", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), async (req, res) => {
  try {
    const id_pedido = Number(req.params.id_pedido);
    if (!Number.isInteger(id_pedido) || id_pedido <= 0) {
      return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
    }

    const resultado = await asignarRepartidorAutomaticamente(id_pedido);
    if (resultado.asignado === true) {
      return res.status(200).json({ success: true, message: "Repartidor asignado correctamente.", ...resultado });
    }

    return res.status(409).json({ success: false, ...resultado });
  } catch (error) {
    console.error("[PedidoRepartidor] Error asignación automática:", error);
    return res.status(500).json({ success: false, message: "Error al asignar repartidor automáticamente." });
  }
});

router.get("/repartidores/disponibles-asignacion", verificarToken, getRepartidoresDisponiblesAsignacion);
router.post("/pedidos/:id_pedido/repartidores", verificarToken, asignarRepartidorManualmente);
router.post("/pedidos/:id_pedido/repartidores/forzado", verificarToken, asignarRepartidorForzado);
router.patch("/pedidos/:id_pedido/reasignar", verificarToken, reasignarRepartidor);
router.patch("/pedidos/:id_pedido/reasignar/forzado", verificarToken, reasignarRepartidorForzado);
router.get("/pedidos/:id_pedido/repartidores", verificarToken, getAsignacionesPedido);

export default router;
