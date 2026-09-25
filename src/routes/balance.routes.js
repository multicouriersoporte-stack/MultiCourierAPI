// Rutas HTTP del módulo Balance / Billetera.
import { Router } from "express";
import {
    getMiBalance, getMisTransacciones, postDepositar, postRecalcularPago,
    getBalanceRepartidorAdmin, getTransaccionesRepartidorAdmin, postRegistrarPagoBalance
} from "../controladores/balanceCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();

// Repartidor: consulta balance y transacciones.
router.get("/balance/mis-balance", verificarToken, permitirRoles("REPARTIDOR"), getMiBalance);
router.get("/balance/mis-transacciones", verificarToken, permitirRoles("REPARTIDOR"), getMisTransacciones);

// Repartidor: registra depósitos de efectivo.
router.post("/balance/depositar", verificarToken, permitirRoles("REPARTIDOR"), postDepositar);

// Soporte/Administrador: sincroniza pagos históricos con la billetera.
router.post("/balance/pedido/:id/recalcular", verificarToken, permitirRoles("SOPORTE", "ADMINISTRADOR"), postRecalcularPago);

router.get("/balance/repartidor/:id_repartidor", verificarToken,
    permitirRoles("SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"), getBalanceRepartidorAdmin);

router.get("/balance/repartidor/:id_repartidor/transacciones", verificarToken,
    permitirRoles("SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"), getTransaccionesRepartidorAdmin);

router.post("/balance/repartidor/:id_repartidor/pagar", verificarToken,
    permitirRoles("SOPORTE", "ADMINISTRADOR"), postRegistrarPagoBalance);

export default router;
