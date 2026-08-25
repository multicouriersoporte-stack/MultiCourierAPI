// src/routes/productos.routes.js

import { Router } from "express";
import {
    getProductos, getProductosxid, getProductoPorCodigo,
    postProductos, putProductos, patchProductos, deleteProductos
} from "../controladores/productosCtrl.js";

const router = Router();

// Rutas de productos
router.get("/productos", getProductos);
router.get("/productos/codigo/:codigo", getProductoPorCodigo); // Ruta específica antes del ID
router.get("/productos/:id", getProductosxid);
router.post("/productos", postProductos);
router.put("/productos/:id", putProductos);
router.patch("/productos/:id", patchProductos);
router.delete("/productos/:id", deleteProductos);

export default router;
