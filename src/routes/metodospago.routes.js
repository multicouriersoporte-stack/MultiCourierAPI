// src/routes/metodospago.routes.js

import { Router } from "express";
import { getMetodosPago, getMetodoPagoxid } from "../controladores/metodospagoCtrl.js";

const router = Router();

// Rutas de métodos de pago
router.get("/metodos-pago", getMetodosPago);
router.get("/metodos-pago/:id", getMetodoPagoxid);

export default router;
