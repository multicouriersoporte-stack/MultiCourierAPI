// src/routes/usuarios.routes.js

import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail, getUsuarioPorCodigo,
    getRepartidorPorUsuario, postUsuarios, putUsuarios, patchUsuarios, deleteUsuarios
} from "../controladores/usuariosCtrl.js";

const router = Router();

// Rutas de consulta
router.get("/usuarios", getUsuarios);
router.get("/usuarios/cedula/:cedula", getUsuarioPorCedula);
router.get("/usuarios/email/:email", getUsuarioPorEmail);
router.get("/usuarios/codigo/:codigo", getUsuarioPorCodigo);
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);
router.get("/usuarios/:id", getUsuarioxid); // Ruta genérica después de las específicas

// Rutas CRUD
router.post("/usuarios", postUsuarios);
router.put("/usuarios/:id", putUsuarios);
router.patch("/usuarios/:id", patchUsuarios);
router.delete("/usuarios/:id", deleteUsuarios);

export default router;
