
import { Router } from "express";
import {
    getMisPagosLocales,
    getPagosLocales,
    getPagosLocalesxid,
    getPagosLocalesPorLocal,
    getPagosLocalesPorPedido,
    putPagosLocales,
    patchPagosLocales,
    deletePagosLocales,
    confirmarPagoLocal
} from "../controladores/pagoslocalesCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

router.get("/pagoslocales/mis-pagos", verificarToken, permitirRoles("LOCAL"), getMisPagosLocales);

// Consultas: LOCAL, ADMINISTRADOR y CENTRAL.
router.get("/pagoslocales", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocales);
router.get("/pagoslocales/:id", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocalesxid);
router.get("/pagoslocales/local/:id_local", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocalesPorLocal);
router.get("/pagoslocales/pedido/:id_pedido", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocalesPorPedido);

// Administración: ADMINISTRADOR y CENTRAL.
router.put("/pagoslocales/:id", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), putPagosLocales);
router.patch("/pagoslocales/:id", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), patchPagosLocales);

router.patch("/pagoslocales/:id/confirmar", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), confirmarPagoLocal);

// Eliminación: solamente ADMINISTRADOR.
router.delete("/pagoslocales/:id", verificarToken, permitirRoles("ADMINISTRADOR"), deletePagosLocales);

export default router;
