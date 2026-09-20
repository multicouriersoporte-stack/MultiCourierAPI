import { Router } from "express";
import { getMisNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, eliminarNotificacion } from "../controladores/notificacionesCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/notificaciones", verificarToken, getMisNotificaciones);
router.patch("/notificaciones/:id/leida", verificarToken, marcarNotificacionLeida);
router.patch("/notificaciones/marcar-todas-leidas", verificarToken, marcarTodasLeidas);
router.delete("/notificaciones/:id", verificarToken, eliminarNotificacion);

export default router;