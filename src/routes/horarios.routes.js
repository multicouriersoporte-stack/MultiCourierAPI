import express from "express";
import { listarDisponibles, listarMisReservasActivas, listarMisHoras, listarHistorial } from "../controladores/horariosCtrl.js";
import { solicitarReserva, consultarSolicitud, soltarHoras } from "../controladores/reservasCtrl.js";
import { ofrecer, listarOfertas, misIntercambios, solicitar, aceptar, rechazar, cancelar } from "../controladores/intercambiosCtrl.js";
import { getEstadoConexion, postConectar } from "../controladores/estadoConexionCtrl.js";
import { getEstadoConexion, postConectar } from "../controladores/conexionCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

const SOLO_REPARTIDOR = permitirRoles("REPARTIDOR");

// Consultas
router.get("/horarios/disponibles", verificarToken, SOLO_REPARTIDOR, listarDisponibles);
router.get("/horarios/mis-reservas-activas", verificarToken, SOLO_REPARTIDOR, listarMisReservasActivas);
router.get("/horarios/mis-horas", verificarToken, SOLO_REPARTIDOR, listarMisHoras);
router.get("/horarios/historial", verificarToken, SOLO_REPARTIDOR, listarHistorial);

router.get("/repartidores/estado-conexion", verificarToken, SOLO_REPARTIDOR, getEstadoConexion);
router.post("/repartidores/conectar", verificarToken, SOLO_REPARTIDOR, postConectar);
router.get("/horarios/estado-conexion", verificarToken, SOLO_REPARTIDOR, getEstadoConexion);

// Reservas
router.post("/horarios/:id/solicitar", verificarToken, SOLO_REPARTIDOR, solicitarReserva);
router.get("/horarios/solicitudes/:idSolicitud", verificarToken, SOLO_REPARTIDOR, consultarSolicitud);
router.post("/reservas/:id/soltar", verificarToken, SOLO_REPARTIDOR, soltarHoras);

// Intercambios
router.post("/reservas/:id/ofrecer-intercambio", verificarToken, SOLO_REPARTIDOR, ofrecer);
router.get("/intercambios/disponibles", verificarToken, SOLO_REPARTIDOR, listarOfertas);
router.get("/intercambios/mis-intercambios", verificarToken, SOLO_REPARTIDOR, misIntercambios);
router.post("/intercambios/:id/solicitar", verificarToken, SOLO_REPARTIDOR, solicitar);
router.patch("/intercambios/:id/aceptar", verificarToken, SOLO_REPARTIDOR, aceptar);
router.patch("/intercambios/:id/rechazar", verificarToken, SOLO_REPARTIDOR, rechazar);
router.patch("/intercambios/:id/cancelar", verificarToken, SOLO_REPARTIDOR, cancelar);

export default router;
