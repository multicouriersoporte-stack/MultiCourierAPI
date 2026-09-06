import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail,
    getUsuarioPorCodigo, getRepartidorPorUsuario, postUsuarios,
    putUsuarios, patchUsuarios, deleteUsuarios
} from "../controladores/usuariosCtrl.js";

const router = Router();

// Consultas de usuarios
router.get("/usuarios", getUsuarios);
router.get("/usuarios/cedula/:cedula", getUsuarioPorCedula);
router.get("/usuarios/email/:email", getUsuarioPorEmail);
router.get("/usuarios/codigo/:codigo", getUsuarioPorCodigo);
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);
router.get("/usuarios/:id", getUsuarioxid); // Debe ir después de las rutas específicas

// Crear y modificar usuarios
router.post("/usuarios", postUsuarios);
router.put("/usuarios/:id", putUsuarios);       // Actualización completa
router.patch("/usuarios/:id", patchUsuarios);   // Actualización parcial

// Eliminar usuario
router.delete("/usuarios/:id", deleteUsuarios);

export default router;
