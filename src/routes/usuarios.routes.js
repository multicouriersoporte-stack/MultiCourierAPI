/* import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail,
    getUsuarioPorCodigo, getRepartidorPorUsuario, postUsuarios, putUsuarios,
    patchUsuarios, deleteUsuarios
} from "../controladores/usuariosCtrl.js";
import { registrarCliente } from "../controladores/registroCtrl.js";

const router = Router();

// Consultas
router.get("/usuarios", getUsuarios);
router.get("/usuarios/cedula/:cedula", getUsuarioPorCedula);
router.get("/usuarios/email/:email", getUsuarioPorEmail);
router.get("/usuarios/codigo/:codigo", getUsuarioPorCodigo);
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);
router.get("/usuarios/:id", getUsuarioxid); // Después de las rutas específicas.

// Registro público de cliente (crea usuario + cliente + rol en una transacción).
router.post("/usuarios/registro-cliente", registrarCliente);

// Crear y modificar (uso administrativo).
router.post("/usuarios", postUsuarios);
router.put("/usuarios/:id", putUsuarios);
router.patch("/usuarios/:id", patchUsuarios);

// Eliminar
router.delete("/usuarios/:id", deleteUsuarios);

export default router; :D
 */

import { Router } from "express";
import {
    getUsuarios, getUsuarioxid, getUsuarioPorCedula, getUsuarioPorEmail,
    getUsuarioPorCodigo, getRepartidorPorUsuario, postUsuarios, putUsuarios,
    patchUsuarios, deleteUsuarios
} from "../controladores/usuariosCtrl.js";
import { registrarCliente } from "../controladores/registroCtrl.js";

const router = Router();

// Consultas
router.get("/usuarios", getUsuarios);
router.get("/usuarios/cedula/:cedula", getUsuarioPorCedula);
router.get("/usuarios/email/:email", getUsuarioPorEmail);
router.get("/usuarios/codigo/:codigo", getUsuarioPorCodigo);
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);

router.get("/usuarios/:id", getUsuarioxid); // Despues de las rutas especificas.

// Registro publico de cliente (crea usuario + cliente + rol en una transaccion).
// La verificación de correo ahora se hace con Firebase Authentication directo desde el
// frontend (sendEmailVerification); registrarCliente solo comprueba emailVerified en Firebase.
router.post("/usuarios/registro-cliente", registrarCliente);

// Crear y modificar (uso administrativo).
router.post("/usuarios", postUsuarios);
router.put("/usuarios/:id", putUsuarios);
router.patch("/usuarios/:id", patchUsuarios);

// Eliminar
router.delete("/usuarios/:id", deleteUsuarios);

export default router;

