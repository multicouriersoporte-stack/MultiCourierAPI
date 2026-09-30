// src/routes/cupones.routes.js

import { Router } from "express";
import {
    getCuponesPorLocal, getCuponxid, getCanjesPorLocal, getCanjesPorCupon,
    postCupones, putCupones, patchCuponActivo
} from "../controladores/cuponesCtrl.js";

const router = Router();

// Las rutas /local/... van antes que /:id
router.get("/cupones/local/:id_local", getCuponesPorLocal);
router.get("/cupones/local/:id_local/canjes", getCanjesPorLocal);
router.get("/cupones/:id", getCuponxid);
router.get("/cupones/:id/canjes", getCanjesPorCupon);

router.post("/cupones", postCupones);
router.put("/cupones/:id", putCupones);
router.patch("/cupones/:id/activo", patchCuponActivo);

export default router;