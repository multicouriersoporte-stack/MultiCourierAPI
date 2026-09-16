const express = require('express');
const router = express.Router();

const horariosController = require('../controladores/horariosCtrl.js');
const reservasController = require('../controladores/reservasCtrl.js');
const intercambiosController = require('../controladores/intercambiosCtrl.js');
// const auth = require('../middlewares/auth'); // TODO: descomenta y usa tu middleware real de sesión/JWT

// Consultas
router.get('/horarios/disponibles', /* auth, */ horariosController.listarDisponibles);
router.get('/horarios/mis-horas', /* auth, */ horariosController.listarMisHoras);
router.get('/horarios/historial', /* auth, */ horariosController.listarHistorial);

// Reservas
router.post('/horarios/:id/solicitar', /* auth, */ reservasController.solicitarReserva);
router.get('/horarios/solicitudes/:idSolicitud', /* auth, */ reservasController.consultarSolicitud);
router.post('/reservas/:id/soltar', /* auth, */ reservasController.soltarHoras);

// Intercambios
router.post('/reservas/:id/ofrecer-intercambio', /* auth, */ intercambiosController.ofrecer);
router.get('/intercambios/disponibles', /* auth, */ intercambiosController.listarOfertas);
router.post('/intercambios/:id/solicitar', /* auth, */ intercambiosController.solicitar);
router.patch('/intercambios/:id/aceptar', /* auth, */ intercambiosController.aceptar);
router.patch('/intercambios/:id/rechazar', /* auth, */ intercambiosController.rechazar);

module.exports = router;