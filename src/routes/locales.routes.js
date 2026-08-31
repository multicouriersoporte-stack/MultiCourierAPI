// src/routes/locales.routes.js

import { Router } from "express";
import {
    getLocales, getLocalxid, getLocalPorUsuario, getLocalPorCodigo, getLocalPorRuc,
    buscarLocales, postLocales, putLocales, patchLocales, deleteLocales, cambiarEstadoLocal
} from "../controladores/localesCtrl.js";

const router = Router();

// Rutas de consulta
router.get("/locales", getLocales);
router.get("/locales/buscar", buscarLocales); // Ejemplo: /locales/buscar?nombre=pizza
router.get("/locales/codigo/:codigo", getLocalPorCodigo);
router.get("/locales/ruc/:ruc", getLocalPorRuc);
router.get("/locales/usuario/:id_usuario", getLocalPorUsuario);
router.get("/locales/:id", getLocalxid); // Después de las rutas específicas

// Rutas CRUD
router.post("/locales", postLocales);
router.put("/locales/:id", putLocales);
router.patch("/locales/:id", patchLocales);

router.patch("/locales/:id/estado", patchEstadoLocal);

router.delete("/locales/:id", deleteLocales);

export default router;
