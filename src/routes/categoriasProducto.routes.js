import { Router } from "express";
import {
    getCategoriasProducto,
    getCategoriaProductoxid,
    postCategoriaProducto,
    putCategoriaProducto,
    patchCategoriaProducto,
    deleteCategoriaProducto
} from "../controladores/categoriasProductoCtrl.js";

const router = Router();

router.get("/categorias-producto", getCategoriasProducto);          // ?estado=1 opcional
router.get("/categorias-producto/:id", getCategoriaProductoxid);
router.post("/categorias-producto", postCategoriaProducto);
router.put("/categorias-producto/:id", putCategoriaProducto);
router.patch("/categorias-producto/:id", patchCategoriaProducto);
router.delete("/categorias-producto/:id", deleteCategoriaProducto);

export default router;