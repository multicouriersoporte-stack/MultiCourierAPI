// src/routes/usuarioroles.routes.js

import { Router } from "express";
import { getUsuarioRoles, getUsuarioRolxid } from "../controladores/usuariorolesCtrl.js";

const router = Router();

// Rutas de relaciones usuario-rol
router.get("/usuario-roles", getUsuarioRoles);
router.get("/usuario-roles/:id", getUsuarioRolxid);

export default router;
