//const intercambiosService = require('../servicios/Intercambios.service');
import {
    ofrecerIntercambio,
    listarOfertasDisponibles,
    solicitarIntercambio,
    aceptarIntercambio,
    rechazarIntercambio
} from '../servicios/Intercambios.service.js';

const ERRORES_HTTP = {
    NO_AUTORIZADO: 403,
    ESTADO_INVALIDO: 409,
    NO_DISPONIBLE: 409,
    RESERVA_INVALIDA: 409,
    CHOQUE_HORARIO: 409,
};

function manejarError(res, error) {
    console.error(error);
    const status = ERRORES_HTTP[error.codigo] || 500;
    res.status(status).json({ error: error.message || 'Error inesperado' });
}

async function ofrecer(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor; // TODO: ajustar al middleware de auth real
        const { id } = req.params; // id_reserva
        //const resultado = await intercambiosService.ofrecerIntercambio(Number(id), idRepartidor);
        const resultado = await ofrecerIntercambio(Number(id), idRepartidor);
        res.status(201).json(resultado);
    } catch (error) { manejarError(res, error); }
}

async function listarOfertas(req, res) {
    try {
        const ofertas = await intercambiosService.listarOfertasDisponibles();
        res.json(ofertas);
    } catch (error) { manejarError(res, error); }
}

async function solicitar(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor;
        const { id } = req.params; // id_intercambio
        const { id_reserva_propia } = req.body;
        const resultado = await intercambiosService.solicitarIntercambio(Number(id), Number(id_reserva_propia), idRepartidor);
        res.json(resultado);
    } catch (error) { manejarError(res, error); }
}

async function aceptar(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor;
        const { id } = req.params;
        const resultado = await intercambiosService.aceptarIntercambio(Number(id), idRepartidor);
        res.json(resultado);
    } catch (error) { manejarError(res, error); }
}

async function rechazar(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor;
        const { id } = req.params;
        const resultado = await intercambiosService.rechazarIntercambio(Number(id), idRepartidor);
        res.json(resultado);
    } catch (error) { manejarError(res, error); }
}

//module.exports = { ofrecer, listarOfertas, solicitar, aceptar, rechazar };
export {
    ofrecer,
    listarOfertas,
    solicitar,
    aceptar,
    rechazar
};
