import { Router } from "express";
import {
  asignarRepartidorAutomaticamente,
  asignarRepartidorManualmente,
  reasignarRepartidor,
  getRepartidoresDisponiblesAsignacion,
  getAsignacionesPedido
} from "../controladores/pedidorepartidoresCtrl.js";

const router = Router();

// Asignación automática: selecciona el mejor repartidor disponible.
router.post("/pedidos/:id_pedido/asignar-repartidor", async (req, res) => {
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

// Lista repartidores disponibles para asignación manual.
router.get("/repartidores/disponibles-asignacion", getRepartidoresDisponiblesAsignacion);

// Asignación manual mediante id_repartidor.
router.post("/pedidos/:id_pedido/asignar-repartidor-manual", asignarRepartidorManualmente);

// Reasignación de repartidor; requiere permisos de SOPORTE o ADMINISTRADOR.
router.post("/pedidos/:id_pedido/reasignar-repartidor", reasignarRepartidor);

// Historial de asignaciones del pedido.
router.get("/pedidos/:id_pedido/asignaciones-repartidor", getAsignacionesPedido);

export default router;
