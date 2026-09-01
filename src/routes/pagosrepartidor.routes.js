import { Router } from "express";
import {
    getPagosRepartidor,
    getPagoRepartidorxid,
    getPagosRepartidorPorRepartidor,
    getPagosRepartidorPorPedido,
    postPagosRepartidor,
    putPagosRepartidor,
    patchPagosRepartidor,
    deletePagosRepartidor
} from "../controladores/pagosrepartidorCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

// Consultas: REPARTIDOR, ADMINISTRADOR y CENTRAL.
router.get("/pagosrepartidor", verificarToken, permitirRoles("REPARTIDOR", "ADMINISTRADOR", "CENTRAL"), getPagosRepartidor);
router.get("/pagosrepartidor/repartidor/:id_repartidor", verificarToken, permitirRoles("REPARTIDOR", "ADMINISTRADOR", "CENTRAL"), getPagosRepartidorPorRepartidor);
router.get("/pagosrepartidor/pedido/:id_pedido", verificarToken, permitirRoles("REPARTIDOR", "ADMINISTRADOR", "CENTRAL"), getPagosRepartidorPorPedido);
router.get("/pagosrepartidor/:id", verificarToken, permitirRoles("REPARTIDOR", "ADMINISTRADOR", "CENTRAL"), getPagoRepartidorxid);

// Administración: ADMINISTRADOR y CENTRAL.
router.post("/pagosrepartidor", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), postPagosRepartidor);
router.put("/pagosrepartidor/:id", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), putPagosRepartidor);
router.patch("/pagosrepartidor/:id", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), patchPagosRepartidor);

// Eliminación: únicamente ADMINISTRADOR.
router.delete("/pagosrepartidor/:id", verificarToken, permitirRoles("ADMINISTRADOR"), deletePagosRepartidor);

export default router;
