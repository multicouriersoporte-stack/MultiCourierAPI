import { Router } from "express";

import { getRutas, getRutasxid, postRutas, putRutas, pathRutas, deleteRutas, asignarPedidosRuta } from "../controladores/rutaCtrl.js";

const router = Router();

router.get("/ruta", getRutas); //SELECT
router.get("/ruta/:id", getRutasxid); //SELECT x ID
router.post("/ruta", postRutas); //INSERT
router.put("/ruta/:id", putRutas); //UPDATE
router.patch("/ruta/:id", pathRutas); //UPDATE
router.delete("/ruta/:id", deleteRutas); //DELETE
router.patch("/ruta/:id/pedidos", asignarPedidosRuta);

export default router;
