import { Router } from "express";
import { buscarPedidosDisponibles } from "../servicios/buscarPedidos.js";

const router = Router();

// Buscar pedidos disponibles para un repartidor.
router.get("/repartidores/:id_repartidor/buscar-pedidos", async (req, res) => {
    try {
        const id_repartidor = Number(req.params.id_repartidor);

        // Validar ID del repartidor.
        if (!Number.isInteger(id_repartidor) || id_repartidor <= 0) {
            return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." });
        }

        const resultado = await buscarPedidosDisponibles(id_repartidor);
        return res.status(200).json({ success: true, ...resultado });
    } catch (error) {
        console.error("[BuscarPedidos] Error en endpoint:", error);
        return res.status(500).json({ success: false, message: "Error al buscar pedidos disponibles" });
    }
});

export default router;
