// src/routes/repartidorUbicaciones.routes.js

import { Router } from "express";

import {
    getRepartidorUbicaciones,
    getRepartidorUbicacionxid,
    getUbicacionesPorRepartidor,
    getUltimaUbicacionRepartidor,
    postRepartidorUbicacion,
    putRepartidorUbicacion,
    deleteRepartidorUbicacion
} from "../controladores/repartidorubicacionCtrl.js";

const router = Router();

// ===============================
// Rutas de consulta
// ===============================

// GET: Obtener todas las ubicaciones
router.get("/repartidor-ubicaciones", getRepartidorUbicaciones);

// GET: Obtener última ubicación de un repartidor
// Esta ruta debe ir antes de /:id para evitar conflictos.
router.get(
    "/repartidores/:id_repartidor/ubicacion/ultima",
    getUltimaUbicacionRepartidor
);

// GET: Obtener todas las ubicaciones de un repartidor
router.get(
    "/repartidores/:id_repartidor/ubicaciones",
    getUbicacionesPorRepartidor
);

// GET: Obtener ubicación por ID
router.get(
    "/repartidor-ubicaciones/:id",
    getRepartidorUbicacionxid
);


// ===============================
// Rutas CRUD
// ===============================

// POST: Registrar ubicación
router.post(
    "/repartidor-ubicaciones",
    postRepartidorUbicacion
);

// PUT: Actualizar ubicación
router.put(
    "/repartidor-ubicaciones/:id",
    putRepartidorUbicacion
);

// DELETE: Eliminar ubicación
router.delete(
    "/repartidor-ubicaciones/:id",
    deleteRepartidorUbicacion
);

export default router;
