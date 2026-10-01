// src/routes/ventas.routes.js
import { Router } from "express";
import { getMisVentas, getMiRendimiento } from "../controladores/ventasCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

// Solo el LOCAL autenticado: el id_local se obtiene del token, nunca de la URL.
router.get("/ventas/mis-ventas", verificarToken, permitirRoles("LOCAL"), getMisVentas);
router.get("/ventas/mi-rendimiento", verificarToken, permitirRoles("LOCAL"), getMiRendimiento);

export default router;