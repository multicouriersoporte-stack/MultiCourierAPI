// src/routes/localproductos.routes.js

import { Router } from "express";
import {
    getLocalProductos, getLocalProductoxid, getProductosPorLocal, getLocalProductosPorProducto,
    buscarLocalProductos, postLocalProductos, putLocalProductos, patchLocalProductos, deleteLocalProductos
} from "../controladores/localproductosCtrl.js";

const router = Router();

// Rutas de consulta
router.get("/localproductos", getLocalProductos);
router.get("/localproductos/buscar", buscarLocalProductos); // Ejemplo: /localproductos/buscar?nombre=hamburguesa
router.get("/localproductos/local/:id_local", getProductosPorLocal); // Productos de un local
router.get("/localproductos/producto/:id_producto", getLocalProductosPorProducto); // Locales con un producto
router.get("/localproductos/:id", getLocalProductoxid); // Por ID, después de rutas específicas

// Rutas CRUD
router.post("/localproductos", postLocalProductos);
router.put("/localproductos/:id", putLocalProductos);
router.patch("/localproductos/:id", patchLocalProductos);
router.delete("/localproductos/:id", deleteLocalProductos);

export default router;
