import {
    solicitarReserva as solicitarReservaService,
    consultarSolicitud as consultarSolicitudService,
    soltarHoras as soltarHorasService
} from '../servicios/Reservas.service.js';

const ERRORES_HTTP = {
    NO_EXISTE: 404,
    NO_DISPONIBLE: 409,
    CHOQUE_HORARIO: 409,
    NO_AUTORIZADO: 403,
    ESTADO_INVALIDO: 409,
    TURNO_EN_CURSO: 409,
    TURNO_MUY_PRONTO: 409,
};

function manejarError(res, error) {
    console.error(error);
    const status = ERRORES_HTTP[error.codigo] || 500;
    res.status(status).json({
        error: error.message || 'Error inesperado',
        codigo: error.codigo
    });
}

async function solicitarReserva(req, res) {
    try {
        const idRepartidor = req.usuario?.id_repartidor;
        if (!idRepartidor) {
            return res.status(401).json({ error: 'No autenticado como repartidor' });
        }

        const { id } = req.params;
        const resultado = await solicitarReservaService(Number(id), idRepartidor);
        res.status(202).json(resultado);
    } catch (error) {
        manejarError(res, error);
    }
}

async function soltarHoras(req, res) {
    try {
        const idRepartidor = req.usuario?.id_repartidor;
        if (!idRepartidor) {
            return res.status(401).json({ error: 'No autenticado como repartidor' });
        }

        const { id } = req.params;
        const resultado = await soltarHorasService(Number(id), idRepartidor);
        res.json(resultado);
    } catch (error) {
        manejarError(res, error);
    }
}

async function consultarSolicitud(req, res) {
    try {
        const { idSolicitud } = req.params;
        const solicitud = await consultarSolicitudService(Number(idSolicitud));

        if (!solicitud) {
            return res.status(404).json({
                error: 'Solicitud no encontrada'
            });
        }

        res.json(solicitud);
    } catch (error) {
        manejarError(res, error);
    }
}

export {
    solicitarReserva,
    consultarSolicitud,
    soltarHoras
};
