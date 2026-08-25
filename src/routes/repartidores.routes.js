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

import express from "express";

import {
    getRepartidores,
    getRepartidorxid,
    getRepartidorPorUsuario,
    getRepartidorPorCodigo,
    //getRepartidoresDisponibles,
    //getSiguienteRepartidor,
    postRepartidores,
    cambiarEstadoRepartidor,
    putRepartidores,
    patchRepartidores,
    deleteRepartidores
} from "../controladores/repartidoresCtrl.js";

import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// ---------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------

router.get(
    "/repartidores",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    getRepartidores
);

/* router.get(
    "/repartidores/disponibles",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    getRepartidoresDisponibles
);
 */
/* router.get(
    "/repartidores/siguiente",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    getSiguienteRepartidor
);
 */
router.get(
    "/repartidores/:id",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    getRepartidorxid
);

router.get(
    "/repartidores/usuario/:id_usuario",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    getRepartidorPorUsuario
);

router.get(
    "/repartidores/codigo/:codigo",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    getRepartidorPorCodigo
);

// ---------------------------------------------------------
// CREAR
// ---------------------------------------------------------

router.post(
    "/repartidores",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    postRepartidores
);

// ---------------------------------------------------------
// ESTADO
// ---------------------------------------------------------

router.patch(
    "/repartidores/:id/estado",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    cambiarEstadoRepartidor
);

// ---------------------------------------------------------
// ACTUALIZAR
// ---------------------------------------------------------

router.put(
    "/repartidores/:id",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    putRepartidores
);

router.patch(
    "/repartidores/:id",
    verificarToken,
    permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"),
    patchRepartidores
);

// ---------------------------------------------------------
// ELIMINAR
// ---------------------------------------------------------

router.delete(
    "/repartidores/:id",
    verificarToken,
    permitirRoles("SUPERVISOR", "SOPORTE"),
    deleteRepartidores
);

export default router;
