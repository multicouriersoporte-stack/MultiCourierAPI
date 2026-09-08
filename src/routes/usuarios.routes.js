/* import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail,
    getUsuarioPorCodigo, getRepartidorPorUsuario, postUsuarios, putUsuarios,
    patchUsuarios, deleteUsuarios
} from "../controladores/usuariosCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { soloAdminCentral } from "../middlewares/auth.middleware.js";

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
 */

import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail,
    getUsuarioPorCodigo, getRepartidorPorUsuario, postUsuarios, putUsuarios,
    patchUsuarios, deleteUsuarios
} from "../controladores/usuariosCtrl.js";

const router = Router();

// Consultas
router.get("/usuarios", getUsuarios);
router.get("/usuarios/cedula/:cedula", getUsuarioPorCedula);
router.get("/usuarios/email/:email", getUsuarioPorEmail);
router.get("/usuarios/codigo/:codigo", getUsuarioPorCodigo);
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);
router.get("/usuarios/:id", getUsuarioxid); // Después de las rutas específicas.

// Crear y modificar
router.post("/usuarios", postUsuarios);
router.put("/usuarios/:id", putUsuarios);
router.patch("/usuarios/:id", patchUsuarios);

// Eliminar
router.delete("/usuarios/:id", deleteUsuarios);

export default router;
