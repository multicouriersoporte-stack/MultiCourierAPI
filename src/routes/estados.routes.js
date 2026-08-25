// src/routes/estados.routes.js

import { Router } from "express";
import { getEstados, getEstadoxid } from "../controladores/estadosCtrl.js";

const router = Router();

// Rutas de estados
router.get("/estados", getEstados);
router.get("/estados/:id", getEstadoxid);

export default router;
