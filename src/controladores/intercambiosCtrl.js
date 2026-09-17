import {
    ofrecerIntercambio,
    listarOfertasDisponibles,
    listarMisIntercambios,
    solicitarIntercambio,
    aceptarIntercambio,
    rechazarIntercambio
} from '../servicios/Intercambios.service.js';
import { obtenerIdUsuario, obtenerRepartidorDelUsuario } from './pedidosCtrl.js';

const ERRORES_HTTP = {
    NO_AUTORIZADO: 403,
    ESTADO_INVALIDO: 409,
    NO_DISPONIBLE: 409,
    RESERVA_INVALIDA: 409,
    CHOQUE_HORARIO: 409,
    INTERCAMBIO_INVALIDO: 409,
    RESERVAS_NO_ENCONTRADAS: 404,
    HORARIOS_NO_ENCONTRADOS: 404,
};

function manejarError(res, error) {
    console.error(error);
    const status = ERRORES_HTTP[error.codigo] || 500;
    res.status(status).json({ error: error.message || 'Error inesperado' });
}

async function resolverIdRepartidor(req, res) {
    if (!req.usuario) { res.status(401).json({ error: 'No autenticado' }); return null; }
    const idRepartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
    if (!idRepartidor) { res.status(403).json({ error: 'El usuario no tiene un repartidor asociado' }); return null; }
    return idRepartidor;
}

async function ofrecer(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        const { id } = req.params; // id_reserva
        const resultado = await ofrecerIntercambio(Number(id), idRepartidor);
        res.status(201).json(resultado);
    } catch (error) { manejarError(res, error); }
}

async function listarOfertas(req, res) {
    try {
        const ofertas = await listarOfertasDisponibles();
        res.json(ofertas);
    } catch (error) { manejarError(res, error); }
}

async function misIntercambios(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        const intercambios = await listarMisIntercambios(idRepartidor);
        res.json(intercambios);
    } catch (error) { manejarError(res, error); }
}

async function solicitar(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        const { id } = req.params; // id_intercambio
        const { id_reserva_propia } = req.body;
        const resultado = await solicitarIntercambio(Number(id), Number(id_reserva_propia), idRepartidor);
        res.json(resultado);
    } catch (error) { manejarError(res, error); }
}

async function aceptar(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        const { id } = req.params;
        const resultado = await aceptarIntercambio(Number(id), idRepartidor);
        res.json(resultado);
    } catch (error) { manejarError(res, error); }
}

async function rechazar(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        const { id } = req.params;
        const resultado = await rechazarIntercambio(Number(id), idRepartidor);
        res.json(resultado);
    } catch (error) { manejarError(res, error); }
}

export {
    ofrecer,
    listarOfertas,
    misIntercambios,
    solicitar,
    aceptar,
    rechazar
};
