// src/routes/provincias.routes.js

import { Router } from "express";
import { getProvincias, getProvinciaxid } from "../controladores/provinciasCtrl.js";

const router = Router();

// Rutas de provincias
router.get("/provincias", getProvincias);
router.get("/provincias/:id", getProvinciaxid);

export default router;
