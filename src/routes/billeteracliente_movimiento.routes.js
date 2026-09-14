import express from "express";
import {
  getMovimientosBilleteraCliente,
  getTodosMovimientosBilletera,
  getMovimientosPorBilletera,
  getMovimientosPorUsuario,
  crearMovimientoBilletera
} from "../controladores/billeteracliente_movimientoCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

const ROLES_GET = ["CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_ADMIN = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_SOLO_ADMIN = ["ADMINISTRADOR"];

router.get("/billeteracliente_movimiento", verificarToken, permitirRoles(...ROLES_GET), getMovimientosBilleteraCliente);
router.get("/billeteracliente_movimiento/todas", verificarToken, permitirRoles(...ROLES_ADMIN), getTodosMovimientosBilletera);
router.get("/billeteracliente_movimiento/billetera/:id_billeteracliente", verificarToken, permitirRoles(...ROLES_ADMIN), getMovimientosPorBilletera);
router.get("/billeteracliente_movimiento/usuario/:id_usuario", verificarToken, permitirRoles(...ROLES_ADMIN), getMovimientosPorUsuario);

// Solo ADMINISTRADOR puede crear movimientos
router.post("/billeteracliente_movimiento", verificarToken, permitirRoles(...ROLES_SOLO_ADMIN), crearMovimientoBilletera);

export default router;
