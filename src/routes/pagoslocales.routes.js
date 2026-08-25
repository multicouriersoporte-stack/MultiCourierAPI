import { Router } from "express";

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


// =====================================================
// PAGOS LOCALES
// =====================================================

// Obtener todos
router.get("/pagoslocales", getPagosLocales);

// Obtener por ID
router.get("/pagoslocales/:id", getPagosLocalesxid);

// Obtener pagos de un local
router.get(
    "/pagoslocales/local/:id_local",
    getPagosLocalesPorLocal
);

// Obtener pagos de un pedido
router.get(
    "/pagoslocales/pedido/:id_pedido",
    getPagosLocalesPorPedido
);

// Crear pago local
router.post("/pagoslocales", postPagosLocales);

// Actualizar pago completo
router.put("/pagoslocales/:id", putPagosLocales);

// Actualizar parcialmente
router.patch("/pagoslocales/:id", patchPagosLocales);

// Eliminar
router.delete("/pagoslocales/:id", deletePagosLocales);


export default router;
