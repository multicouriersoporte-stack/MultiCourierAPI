import { obtenerEstadoConexion, conectarRepartidor } from "../servicios/ConexionRepartidor.service.js";
import { obtenerIdUsuario, obtenerRepartidorDelUsuario } from "./pedidosCtrl.js";

const ERRORES_HTTP = { NO_EXISTE: 404, ESTADO_INVALIDO: 409, SIN_HORARIO: 409, MUY_PRONTO: 409 };

function manejarError(res, error) {
    console.error(error);
    const status = ERRORES_HTTP[error.codigo] || 500;
    res.status(status).json({ error: error.message || "Error inesperado", codigo: error.codigo });
}

async function resolverIdRepartidor(req, res) {
    if (!req.usuario) { res.status(401).json({ error: "No autenticado" }); return null; }
    const idRepartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
    if (!idRepartidor) { res.status(403).json({ error: "El usuario no tiene un repartidor asociado" }); return null; }
    return idRepartidor;
}

export async function getEstadoConexion(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        res.json(await obtenerEstadoConexion(idRepartidor));
    } catch (error) { manejarError(res, error); }
}

export async function postConectar(req, res) {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        res.json(await conectarRepartidor(idRepartidor));
    } catch (error) { manejarError(res, error); }
}