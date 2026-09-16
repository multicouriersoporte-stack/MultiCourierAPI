import express from "express";
import { listarDisponibles, listarMisHoras, listarHistorial } from "../controladores/horariosCtrl.js";
import { solicitarReserva, consultarSolicitud, soltarHoras } from "../controladores/reservasCtrl.js";
import { ofrecer, listarOfertas, solicitar, aceptar, rechazar } from "../controladores/intercambiosCtrl.js";
// import { verificarToken } from "../middlewares/auth.middleware.js";
// import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// Consultas
router.get("/horarios/disponibles", /* verificarToken, */ listarDisponibles);
router.get("/horarios/mis-horas", /* verificarToken, */ listarMisHoras);
router.get("/horarios/historial", /* verificarToken, */ listarHistorial);

// Reservas
router.post("/horarios/:id/solicitar", /* verificarToken, */ solicitarReserva);
router.get("/horarios/solicitudes/:idSolicitud", /* verificarToken, */ consultarSolicitud);
router.post("/reservas/:id/soltar", /* verificarToken, */ soltarHoras);

// Intercambios
router.post("/reservas/:id/ofrecer-intercambio", /* verificarToken, */ ofrecer);
router.get("/intercambios/disponibles", /* verificarToken, */ listarOfertas);
router.post("/intercambios/:id/solicitar", /* verificarToken, */ solicitar);
router.patch("/intercambios/:id/aceptar", /* verificarToken, */ aceptar);
router.patch("/intercambios/:id/rechazar", /* verificarToken, */ rechazar);

export default router;
