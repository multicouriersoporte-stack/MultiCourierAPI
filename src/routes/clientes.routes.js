// src/routes/clientes.routes.js

import { Router } from "express";
import {
    getClientes, getClientexid, getClientePorUsuario, getClientePorCodigo,
    postClientes, putClientes, patchClientes, deleteClientes
} from "../controladores/clientesCtrl.js";

const router = Router();

// Rutas de consulta
router.get("/clientes", getClientes);
router.get("/clientes/usuario/:id_usuario", getClientePorUsuario);
router.get("/clientes/codigo/:codigo", getClientePorCodigo);
router.get("/clientes/:id", getClientexid); // Debe ir después de las rutas específicas

// Rutas CRUD
router.post("/clientes", postClientes);
router.put("/clientes/:id", putClientes);
router.patch("/clientes/:id", patchClientes);
router.delete("/clientes/:id", deleteClientes);

export default router;
