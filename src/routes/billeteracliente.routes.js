import express from "express";
import {
    getBilleteraCliente,
    getBilleterasClientes,
    getBilleteraClientePorUsuario,
    crearBilleteraCliente,
    actualizarSaldoBilletera
} from "../controladores/billeteraclienteCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

const ROLES_GET = ["CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_ADMIN = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_SOLO_ADMIN = ["ADMINISTRADOR"];

router.get("/billeteracliente", verificarToken, permitirRoles(ROLES_GET), getBilleteraCliente);
router.get("/billeteracliente/todas", verificarToken, permitirRoles(ROLES_ADMIN), getBilleterasClientes);
router.get("/billeteracliente/usuario/:id_usuario", verificarToken, permitirRoles(ROLES_ADMIN), getBilleteraClientePorUsuario);

// Solo ADMINISTRADOR puede crear y modificar saldo
router.post("/billeteracliente", verificarToken, permitirRoles(ROLES_SOLO_ADMIN), crearBilleteraCliente);
router.put("/billeteracliente/usuario/:id_usuario/saldo", verificarToken, permitirRoles(ROLES_SOLO_ADMIN), actualizarSaldoBilletera);

export default router;
