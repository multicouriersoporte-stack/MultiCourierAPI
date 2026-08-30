/* import { Router } from "express";
import {
    getPagosLocales,
    getPagosLocalesxid,
    getPagosLocalesPorLocal,
    getPagosLocalesPorPedido,
    postPagosLocales,
    putPagosLocales,
    patchPagosLocales,
    deletePagosLocales
} from "../controladores/pagoslocalesCtrl.js";

const router = Router();

// PAGOS LOCALES
router.get("/pagoslocales", getPagosLocales); // Obtener todos
router.get("/pagoslocales/:id", getPagosLocalesxid); // Obtener por ID
router.get("/pagoslocales/local/:id_local", getPagosLocalesPorLocal); // Obtener por local
router.get("/pagoslocales/pedido/:id_pedido", getPagosLocalesPorPedido); // Obtener por pedido
router.post("/pagoslocales", postPagosLocales); // Crear
router.put("/pagoslocales/:id", putPagosLocales); // Actualizar completo
router.patch("/pagoslocales/:id", patchPagosLocales); // Actualizar parcial
router.delete("/pagoslocales/:id", deletePagosLocales); // Eliminar

export default router; */


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
import { verificarToken, permitirRoles } from "../middlewares/authMiddleware.js";

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
