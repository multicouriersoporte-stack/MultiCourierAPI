import express from "express";
import {
  getMovimientosBilleteraCliente,
  getTodosMovimientosBilletera,
  getMovimientosPorBilletera,
  getMovimientosPorUsuario,
  crearMovimientoBilletera
} from "../controladores/billeteracliente_movimientoCtrl.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

const ROLES_GET = ["CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_ADMIN = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_SOLO_ADMIN = ["ADMINISTRADOR"];

router.get("/billeteracliente_movimiento", permitirRoles(ROLES_GET), getMovimientosBilleteraCliente);
router.get("/billeteracliente_movimiento/todas", permitirRoles(ROLES_ADMIN), getTodosMovimientosBilletera);
router.get("/billeteracliente_movimiento/billetera/:id_billeteracliente", permitirRoles(ROLES_ADMIN), getMovimientosPorBilletera);
router.get("/billeteracliente_movimiento/usuario/:id_usuario", permitirRoles(ROLES_ADMIN), getMovimientosPorUsuario);

// Solo ADMINISTRADOR puede crear movimientos (porque modifican el saldo)
router.post("/billeteracliente_movimiento", permitirRoles(ROLES_SOLO_ADMIN), crearMovimientoBilletera);

export default router;