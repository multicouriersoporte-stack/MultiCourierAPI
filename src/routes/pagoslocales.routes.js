
import { Router } from "express";
import {
    getPagosLocales,
    getPagosLocalesxid,
    getPagosLocalesPorLocal,
    getPagosLocalesPorPedido,
    putPagosLocales,
    patchPagosLocales,
    deletePagosLocales
} from "../controladores/pagoslocalesCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

// Consultas: LOCAL, ADMINISTRADOR y CENTRAL.
router.get("/pagoslocales", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocales);
router.get("/pagoslocales/:id", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocalesxid);
router.get("/pagoslocales/local/:id_local", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocalesPorLocal);
router.get("/pagoslocales/pedido/:id_pedido", verificarToken, permitirRoles("LOCAL", "ADMINISTRADOR", "CENTRAL"), getPagosLocalesPorPedido);

// Administración: ADMINISTRADOR y CENTRAL.
router.put("/pagoslocales/:id", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), putPagosLocales);
router.patch("/pagoslocales/:id", verificarToken, permitirRoles("ADMINISTRADOR", "CENTRAL"), patchPagosLocales);

// Eliminación: solamente ADMINISTRADOR.
router.delete("/pagoslocales/:id", verificarToken, permitirRoles("ADMINISTRADOR"), deletePagosLocales);

export default router;
