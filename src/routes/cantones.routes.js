// src/routes/cantones.routes.js

import { Router } from "express";
import { getCantones, getCantonxid } from "../controladores/cantonesCtrl.js";

const router = Router();

// Rutas de cantones
router.get("/cantones", getCantones);
router.get("/cantones/:id", getCantonxid);

export default router;
