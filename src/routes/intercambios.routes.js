const express = require('express');
const router = express.Router();
const intercambiosController = require('../controladores/intercambiosCtrl.js');
// const auth = require('../middlewares/auth'); // Middleware real de sesión/JWT

// Intercambios: ofrecer, consultar, solicitar y gestionar solicitudes.
router.post('/reservas/:id/ofrecer-intercambio', /* auth, */ intercambiosController.ofrecer);
router.get('/intercambios/disponibles', /* auth, */ intercambiosController.listarOfertas);
router.post('/intercambios/:id/solicitar', /* auth, */ intercambiosController.solicitar);
router.patch('/intercambios/:id/aceptar', /* auth, */ intercambiosController.aceptar);
router.patch('/intercambios/:id/rechazar', /* auth, */ intercambiosController.rechazar);

module.exports = router;
