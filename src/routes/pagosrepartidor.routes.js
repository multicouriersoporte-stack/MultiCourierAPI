import { Router } from "express";

import {
    getPagosRepartidor,
    getPagoRepartidorxid,
    postPagosRepartidor,
    putPagosRepartidor,
    pathPagosRepartidor,
    deletePagosRepartidor
} from "../controladores/pagosrepartidorCtrl.js";

const router = Router();

// =====================================================
// PAGOS REPARTIDOR
// =====================================================

// Obtener todos los pagos
router.get(
    "/pagosrepartidor",
    getPagosRepartidor
);

// Obtener pago por ID
router.get(
    "/pagosrepartidor/:id",
    getPagoRepartidorxid
);

// Crear pago
router.post(
    "/pagosrepartidor",
    postPagosRepartidor
);

// Actualizar pago completo
router.put(
    "/pagosrepartidor/:id",
    putPagosRepartidor
);

// Actualizar pago parcialmente
router.patch(
    "/pagosrepartidor/:id",
    pathPagosRepartidor
);

// Eliminar pago
router.delete(
    "/pagosrepartidor/:id",
    deletePagosRepartidor
);

export default router;
