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

// PAGOS LOCALES
router.get("/pagoslocales", getPagosLocales); // Obtener todos
router.get("/pagoslocales/:id", getPagosLocalesxid); // Obtener por ID
router.get("/pagoslocales/local/:id_local", getPagosLocalesPorLocal); // Obtener por local
router.get("/pagoslocales/pedido/:id_pedido", getPagosLocalesPorPedido); // Obtener por pedido
router.post("/pagoslocales", postPagosLocales); // Crear
router.put("/pagoslocales/:id", putPagosLocales); // Actualizar completo
router.patch("/pagoslocales/:id", patchPagosLocales); // Actualizar parcial
router.delete("/pagoslocales/:id", deletePagosLocales); // Eliminar

export default router;
