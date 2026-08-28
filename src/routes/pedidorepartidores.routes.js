// src/routes/pedidorepartidores.routes.js
import { Router } from "express";
import { asignarRepartidorAutomaticamente } from "../controladores/pedidorepartidoresCtrl.js";

const router = Router();

// Asigna automáticamente un repartidor solo si el pedido está EN_PREPARACION.
// El pedido conserva su estado; no pasa a ASIGNADO.
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
        return res.status(500).json({ success: false, message: "Error al asignar repartidor automáticamente" });
    }
});

export default router;
