import express from "express";
import {
    getBilleteraCliente,
    getBilleterasClientes,
    getBilleteraClientePorUsuario,
    crearBilleteraCliente,
    actualizarSaldoBilletera
} from "../controladores/billeteraclienteCtrl.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

const ROLES_GET = ["CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"]; // Lectura propia
const ROLES_ADMIN = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];         // Lectura de todas
const ROLES_SOLO_ADMIN = ["ADMINISTRADOR"];                                        // Solo modificar / eliminar

router.get("/billeteracliente", permitirRoles(ROLES_GET), getBilleteraCliente);
router.get("/billeteracliente/todas", permitirRoles(ROLES_ADMIN), getBilleterasClientes);
router.get("/billeteracliente/usuario/:id_usuario", permitirRoles(ROLES_ADMIN), getBilleteraClientePorUsuario);

// Solo ADMINISTRADOR puede crear y modificar saldo
router.post("/billeteracliente", permitirRoles(ROLES_SOLO_ADMIN), crearBilleteraCliente);
router.put("/billeteracliente/usuario/:id_usuario/saldo", permitirRoles(ROLES_SOLO_ADMIN), actualizarSaldoBilletera);

export default router;