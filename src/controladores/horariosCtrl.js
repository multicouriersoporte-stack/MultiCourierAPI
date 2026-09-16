const consultaService = require('../servicios/Horarios.consulta.service');

async function listarDisponibles(req, res) {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ error: 'Falta el parámetro fecha' });
        const disponibles = await consultaService.obtenerDisponiblesPorFecha(fecha);
        res.json(disponibles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar horarios disponibles' });
    }
}

async function listarMisHoras(req, res) {
    try {
        const { fecha } = req.query;
        const idRepartidor = req.usuario.id_repartidor; // TODO: ajustar al middleware de auth real
        if (!fecha) return res.status(400).json({ error: 'Falta el parámetro fecha' });
        const misHoras = await consultaService.obtenerMisHorasPorFecha(idRepartidor, fecha);
        res.json(misHoras);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar mis horas' });
    }
}

async function listarHistorial(req, res) {
    try {
        const idRepartidor = req.usuario.id_repartidor;
        const { desde, hasta } = req.query;
        const historial = await consultaService.obtenerHistorial(idRepartidor, { desde, hasta });
        res.json(historial);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar historial' });
    }
}

module.exports = { listarDisponibles, listarMisHoras, listarHistorial };