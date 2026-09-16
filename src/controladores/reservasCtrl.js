//const reservasService = require('../servicios/Reservas.service');
import {
    solicitarReserva,
    consultarSolicitud,
    soltarHoras
} from '../servicios/Reservas.service.js';

const ERRORES_HTTP = {
    NO_EXISTE: 404,
    NO_DISPONIBLE: 409,
    CHOQUE_HORARIO: 409,
    NO_AUTORIZADO: 403,
    ESTADO_INVALIDO: 409,
    TURNO_EN_CURSO: 409,
};

function manejarError(res, error) {
    console.error(error);
    const status = ERRORES_HTTP[error.codigo] || 500;
    res.status(status).json({ error: error.message || 'Error inesperado' });
}

async function solicitarReserva(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor; // TODO: ajustar al middleware de auth real
        const { id } = req.params; // id_horario_disponible
        const resultado = await reservasService.solicitarReserva(Number(id), idRepartidor);
        res.status(202).json(resultado); // 202: aceptada, se resuelve en breve (ver /solicitudes/:id)
    } catch (error) {
        manejarError(res, error);
    }
}

async function consultarSolicitud(req, res) {
    try {
        const { idSolicitud } = req.params;
        const solicitud = await reservasService.consultarSolicitud(Number(idSolicitud));
        if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
        res.json(solicitud);
    } catch (error) {
        manejarError(res, error);
    }
}

async function soltarHoras(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor;
        const { id } = req.params; // id_reserva
        const resultado = await reservasService.soltarHoras(Number(id), idRepartidor);
        res.json(resultado);
    } catch (error) {
        manejarError(res, error);
    }
}

module.exports = { solicitarReserva, consultarSolicitud, soltarHoras };
