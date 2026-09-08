/* // src/routes/repartidores.routes.js

import { Router } from "express";
import {
    getRepartidores, getRepartidorxid, getRepartidorPorUsuario, getRepartidorPorCodigo,
    postRepartidores, putRepartidores, patchRepartidores, deleteRepartidores, cambiarEstadoRepartidor
} from "../controladores/repartidoresCtrl.js";

const router = Router();

// Rutas de consulta
router.get("/repartidores", getRepartidores);
router.get("/repartidores/codigo/:codigo", getRepartidorPorCodigo); // Ruta específica antes del ID
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);
router.get("/repartidores/:id", getRepartidorxid);

// Rutas CRUD
router.post("/repartidores", postRepartidores);
router.put("/repartidores/:id", putRepartidores);
router.patch("/repartidores/:id", patchRepartidores);
router.delete("/repartidores/:id", deleteRepartidores);

router.patch("/repartidores/:id/estado", cambiarEstadoRepartidor);

export default router;
 */

// src/rutas/repartidoresRuta.js
import { Router } from "express";

import {
    getRepartidores,
    getRepartidoresDisponibles,
    getRepartidorxid,
    getRepartidorPorUsuario,
    getRepartidorPorCodigo,
    postRepartidores,
    cambiarEstadoRepartidor,
    putRepartidores,
    patchRepartidores,
    deleteRepartidores
} from "../controladores/repartidoresCtrl.js";

const router = Router();

// GET - Obtener todos los repartidores
router.get("/", getRepartidores);

// GET - Obtener repartidores disponibles
router.get("/disponibles", getRepartidoresDisponibles);

// GET - Obtener repartidor por ID
router.get("/:id", getRepartidorxid);

// GET - Obtener repartidor por ID de usuario
router.get("/usuario/:id_usuario", getRepartidorPorUsuario);

// GET - Obtener repartidor por código
router.get("/codigo/:codigo", getRepartidorPorCodigo);

// POST - Crear repartidor
router.post("/", postRepartidores);

// PATCH - Cambiar únicamente el estado
router.patch("/:id/estado", cambiarEstadoRepartidor);

// PUT - Actualizar repartidor completo
router.put("/:id", putRepartidores);

// PATCH - Actualizar parcialmente un repartidor
router.patch("/:id", patchRepartidores);

// DELETE - Eliminar repartidor
router.delete("/:id", deleteRepartidores);

export default router;

