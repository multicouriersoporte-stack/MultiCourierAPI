// src/routes/descuentos.routes.js

import { Router } from "express";
import {
    getDescuentosPorLocal, getDescuentoxid, getAplicadosPorLocal,
    postDescuentos, putDescuentos, patchDescuentoActivo
} from "../controladores/descuentosCtrl.js";

const router = Router();

router.get("/descuentos/local/:id_local", getDescuentosPorLocal);
router.get("/descuentos/local/:id_local/aplicados", getAplicadosPorLocal);
router.get("/descuentos/:id", getDescuentoxid);

router.post("/descuentos", postDescuentos);
router.put("/descuentos/:id", putDescuentos);
router.patch("/descuentos/:id/activo", patchDescuentoActivo);

export default router;