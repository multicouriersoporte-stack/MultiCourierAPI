import { Router } from "express";
import {
  getMiBalance, getBalanceRepartidor, postDeposito, getMisDepositos, getDepositos,
  patchConfirmarDeposito, patchRechazarDeposito, patchRevertirDeposito,
  postAjusteBalance, patchBloqueoCuenta, postRecalcularFinanzasPedido
} from "../controladores/finanzasRepartidorCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = Router();
const ADMIN = ["SOPORTE", "ADMINISTRADOR"];
const CONSULTA = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];

// Repartidor autenticado (rutas fijas antes de las paramétricas)
router.get("/balance/mio", verificarToken, permitirRoles("REPARTIDOR"), getMiBalance);
router.get("/balance/depositos/mios", verificarToken, permitirRoles("REPARTIDOR"), getMisDepositos);
router.post("/balance/depositos", verificarToken, permitirRoles("REPARTIDOR"), postDeposito);

// Administración
router.get("/balance/depositos", verificarToken, permitirRoles(...CONSULTA), getDepositos);
router.get("/balance/repartidor/:id_repartidor", verificarToken, permitirRoles(...CONSULTA), getBalanceRepartidor);
router.patch("/balance/depositos/:id/confirmar", verificarToken, permitirRoles(...ADMIN), patchConfirmarDeposito);
router.patch("/balance/depositos/:id/rechazar", verificarToken, permitirRoles(...ADMIN), patchRechazarDeposito);
router.patch("/balance/depositos/:id/revertir", verificarToken, permitirRoles(...ADMIN), patchRevertirDeposito);
router.post("/balance/ajustes", verificarToken, permitirRoles(...ADMIN), postAjusteBalance);
router.patch("/repartidores/:id/bloqueo", verificarToken, permitirRoles(...ADMIN), patchBloqueoCuenta);
router.post("/pedidos/:id/recalcular-finanzas", verificarToken, permitirRoles(...ADMIN), postRecalcularFinanzasPedido);

export default router;
// En app/index.js:  import finanzasRepartidorRoutes from "./routes/finanzasRepartidor.routes.js";  app.use("/api", finanzasRepartidorRoutes);