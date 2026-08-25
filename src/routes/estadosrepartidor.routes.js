// src/routes/estadosRepartidor.routes.js
import { Router } from "express";
import { getEstadosRepartidor, getEstadoRepartidorxid } from "../controladores/estadosrepartidorCtrl.js";

const router = Router();

// Rutas de estados de repartidor
router.get("/estadosrepartidor", getEstadosRepartidor);
router.get("/estadosrepartidor/:id", getEstadoRepartidorxid);

export default router;
