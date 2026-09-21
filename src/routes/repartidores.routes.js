// src/rutas/repartidoresRuta.js

/* import express from "express";
import {
  getRepartidores,
  getMiRepartidor,
  getRepartidorxid,
  getRepartidorPorUsuario,
  getRepartidorPorCodigo,
  postRepartidores,
  cambiarEstadoRepartidor,
  putRepartidores,
  patchRepartidores,
  deleteRepartidores
} from "../controladores/repartidoresCtrl.js";
import { getRepartidoresDisponiblesAsignacion } from "../controladores/pedidorepartidoresCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// Consultas
router.get("/repartidores", verificarToken, permitirRoles("CLIENTE", "LOCAL", "REPARTIDOR", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidores);
router.get("/repartidores/mio", verificarToken, permitirRoles("REPARTIDOR"), getMiRepartidor);
//router.get("/repartidores/disponibles-asignacion", verificarToken, getRepartidoresDisponiblesAsignacion);
router.get("/repartidores/usuario/:id_usuario", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidorPorUsuario);
router.get("/repartidores/codigo/:codigo", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidorPorCodigo);
router.get("/repartidores/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidorxid);

// Crear
router.post("/repartidores", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), postRepartidores);

// Cambiar estado
router.patch("/repartidores/:id/estado", verificarToken, permitirRoles("REPARTIDOR", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), cambiarEstadoRepartidor);

// Actualizar
router.put("/repartidores/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), putRepartidores);
router.patch("/repartidores/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), patchRepartidores);

// Eliminar
router.delete("/repartidores/:id", verificarToken, permitirRoles("SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), deleteRepartidores);

export default router; */

import express from "express";
import {
  getRepartidores,
  getMiRepartidor,
  getRepartidorxid,
  getRepartidorPorUsuario,
  getRepartidorPorCodigo,
  postRepartidores,
  cambiarEstadoRepartidor,
  putRepartidores,
  patchRepartidores,
  deleteRepartidores
} from "../controladores/repartidoresCtrl.js";
import { getRepartidoresDisponiblesAsignacion } from "../controladores/pedidorepartidoresCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// Consultas fijas ANTES de /:id
router.get("/repartidores", verificarToken, permitirRoles("CLIENTE", "LOCAL", "REPARTIDOR", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidores);
router.get("/repartidores/mio", verificarToken, permitirRoles("REPARTIDOR"), getMiRepartidor);

// ✅ Ruta específica ANTES de /:id
router.get("/repartidores/disponibles-asignacion", verificarToken, getRepartidoresDisponiblesAsignacion);

router.get("/repartidores/usuario/:id_usuario", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidorPorUsuario);
router.get("/repartidores/codigo/:codigo", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidorPorCodigo);

// Paramétrica al final
router.get("/repartidores/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), getRepartidorxid);

// Crear / estado / actualizar / eliminar...
router.post("/repartidores", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), postRepartidores);
router.patch("/repartidores/:id/estado", verificarToken, permitirRoles("REPARTIDOR", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), cambiarEstadoRepartidor);
router.put("/repartidores/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), putRepartidores);
router.patch("/repartidores/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), patchRepartidores);
router.delete("/repartidores/:id", verificarToken, permitirRoles("SUPERVISOR", "SOPORTE", "ADMINISTRADOR"), deleteRepartidores);

export default router;
