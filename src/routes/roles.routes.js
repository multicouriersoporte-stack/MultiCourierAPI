// src/routes/roles.routes.js

import { Router } from "express";
import { getRoles, getRolxid } from "../controladores/rolesCtrl.js";

const router = Router();

// Rutas de roles
router.get("/roles", getRoles);
router.get("/roles/:id", getRolxid);

export default router;
