import * as consultaService from "../servicios/Horarios.consulta.service.js";
import { obtenerIdUsuario, obtenerRepartidorDelUsuario } from "./pedidosCtrl.js";

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
        if (!req.usuario) return res.status(401).json({ error: "No autenticado" });
        const idRepartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
        if (!idRepartidor) return res.status(403).json({ error: "El usuario no tiene un repartidor asociado" });
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
        if (!fecha) return res.status(400).json({ error: "Falta el parámetro fecha" });
        if (!req.usuario) return res.status(401).json({ error: "No autenticado" });
        const idRepartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
        if (!idRepartidor) return res.status(403).json({ error: "El usuario no tiene un repartidor asociado" });
        const misHoras = await consultaService.obtenerMisHorasPorFecha(idRepartidor, fecha);
        res.json(misHoras);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al listar mis horas" });
    }
};

export const listarHistorial = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ error: "No autenticado" });
        const idRepartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
        if (!idRepartidor) return res.status(403).json({ error: "El usuario no tiene un repartidor asociado" });
        const { desde, hasta } = req.query;
        const historial = await consultaService.obtenerHistorial(idRepartidor, { desde, hasta });
        res.json(historial);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al listar historial" });
    }
};
