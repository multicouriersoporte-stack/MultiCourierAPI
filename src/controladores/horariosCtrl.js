import * as consultaService from "../servicios/Horarios.consulta.service.js";

export const listarDisponibles = async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ error: "Falta el parámetro fecha" });
        const disponibles = await consultaService.obtenerDisponiblesPorFecha(fecha);
        res.json(disponibles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al listar horarios disponibles" });
    }
};

export const listarMisReservasActivas = async (req, res) => {
    try {
        const idRepartidor = req.usuario?.id_repartidor;
        if (!idRepartidor) return res.status(401).json({ error: "No autenticado como repartidor" });
        const reservas = await consultaService.obtenerMisReservasActivas(idRepartidor);
        res.json(reservas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al listar tus reservas activas" });
    }
};

export const listarMisHoras = async (req, res) => {
    try {
        const { fecha } = req.query;
        // Ajusta según tu middleware de auth (ej. req.usuario.id_repartidor)
        const idRepartidor = req.usuario?.id_repartidor;
        if (!fecha) return res.status(400).json({ error: "Falta el parámetro fecha" });
        if (!idRepartidor) return res.status(401).json({ error: "No autenticado como repartidor" });
        const misHoras = await consultaService.obtenerMisHorasPorFecha(idRepartidor, fecha);
        res.json(misHoras);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al listar mis horas" });
    }
};

export const listarHistorial = async (req, res) => {
    try {
        const idRepartidor = req.usuario?.id_repartidor;
        const { desde, hasta } = req.query;
        if (!idRepartidor) return res.status(401).json({ error: "No autenticado como repartidor" });
        const historial = await consultaService.obtenerHistorial(idRepartidor, { desde, hasta });
        res.json(historial);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al listar historial" });
    }
};
