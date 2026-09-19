import { conmysql } from "../db.js";
import { calcularEstadoConexion, conectarRepartidor, sincronizarListoARepartiendo } from "../servicios/EstadoConexion.service.js";
import { obtenerIdUsuario, obtenerRepartidorDelUsuario } from "./pedidosCtrl.js";

const ERRORES_HTTP = { NO_EXISTE: 404, ESTADO_INVALIDO: 409, SIN_HORARIO: 409, FUERA_DE_VENTANA: 409 };

async function resolverIdRepartidor(req, res) {
    if (!req.usuario) { res.status(401).json({ success: false, message: "Usuario no autenticado." }); return null; }
    const idRepartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
    if (!idRepartidor) { res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." }); return null; }
    return idRepartidor;
}

export const getEstadoConexion = async (req, res) => {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        await sincronizarListoARepartiendo(idRepartidor);
        const info = await calcularEstadoConexion(idRepartidor);
        const [[repartidor]] = await conmysql.query(`SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor=? LIMIT 1`, [idRepartidor]);
        res.json({ success: true, ...info, id_estado_repartidor: repartidor?.id_estado_repartidor ?? null });
    } catch (error) {
        console.error("[EstadoConexion] Error consultando estado:", error);
        res.status(500).json({ success: false, message: "Error al consultar el estado de conexión." });
    }
};

export const postConectar = async (req, res) => {
    try {
        const idRepartidor = await resolverIdRepartidor(req, res);
        if (!idRepartidor) return;
        const resultado = await conectarRepartidor(idRepartidor);
        res.json({ success: true, ...resultado });
    } catch (error) {
        const status = ERRORES_HTTP[error.codigo] || 500;
        console.error("[EstadoConexion] Error conectando repartidor:", error);
        res.status(status).json({ success: false, message: error.message || "Error al conectar", codigo: error.codigo });
    }
};
