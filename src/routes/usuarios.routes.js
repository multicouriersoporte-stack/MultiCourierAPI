import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail,
    getUsuarioPorCodigo, getRepartidorPorUsuario, postUsuarios, putUsuarios,
    patchUsuarios, deleteUsuarios
} from "../controllers/usuarios.controller.js";
import { verificarToken } from "../middleware/auth.js";
import { soloAdminCentral } from "../middleware/soloAdminCentral.js";

const router = Router();

// GET: cualquier usuario autenticado.
router.get("/", verificarToken, getUsuarios);
router.get("/id/:id", verificarToken, getUsuarioxid);
router.get("/cedula/:cedula", verificarToken, getUsuarioPorCedula);
router.get("/email/:email", verificarToken, getUsuarioPorEmail);
router.get("/codigo/:codigo", verificarToken, getUsuarioPorCodigo);
router.get("/:id/repartidor", verificarToken, getRepartidorPorUsuario);

// POST, PUT, PATCH y DELETE: solo CENTRAL y ADMINISTRADOR.
router.post("/", verificarToken, soloAdminCentral, postUsuarios);
router.put("/:id", verificarToken, soloAdminCentral, putUsuarios);
router.patch("/:id", verificarToken, soloAdminCentral, patchUsuarios);
router.delete("/:id", verificarToken, soloAdminCentral, deleteUsuarios);

export default router;
