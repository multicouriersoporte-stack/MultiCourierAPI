import { Router } from "express";

import {
    getBilleteras,
    getBilleteraxid,
    postBilleteras,
    putBilleteras,
    pathBilleteras,
    deleteBilleteras
} from "../controladores/billeterasCtrl.js";

const router = Router();

// =====================================================
// BILLETERAS
// =====================================================

// Obtener todas
router.get(
    "/billeteras",
    getBilleteras
);

// Obtener por ID
router.get(
    "/billeteras/:id",
    getBilleteraxid
);

// Crear
router.post(
    "/billeteras",
    postBilleteras
);

// Actualizar completo
router.put(
    "/billeteras/:id",
    putBilleteras
);

// Actualizar parcialmente
router.patch(
    "/billeteras/:id",
    pathBilleteras
);

// Eliminar
router.delete(
    "/billeteras/:id",
    deleteBilleteras
);

export default router;
