const express = require('express');
const router = express.Router();
const reservasController = require('../controladores/reservasCtrl.js');
// const auth = require('../middlewares/auth'); // Middleware real de sesión/JWT

// Reservas: solicitar, consultar y liberar horas.
router.post('/horarios/:id/solicitar', /* auth, */ reservasController.solicitarReserva); // Solicitar reserva
router.get('/horarios/solicitudes/:idSolicitud', /* auth, */ reservasController.consultarSolicitud); // Consultar solicitud
router.post('/reservas/:id/soltar', /* auth, */ reservasController.soltarHoras); // Liberar horas

module.exports = router;
