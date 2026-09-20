import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { registrarToken, desactivarToken } from "../controladores/pushCtrl.js";

const router = Router();

router.post("/push/registrar-token", verificarToken, registrarToken);
router.post("/push/desactivar-token", verificarToken, desactivarToken);

export default router;
