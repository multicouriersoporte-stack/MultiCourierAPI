// Controladores HTTP del módulo Balance.
import * as balanceService from "../servicios/balanceService.js";
import { obtenerIdUsuario } from "../middlewares/rolesHelpers.js";

// Responde errores con formato estandarizado.
const error = (res, e) => res.status(e.status || 500).json({ success: false, message: e.message || "Error interno del servidor." });

// GET /balance/mis-balance — Resumen del balance del repartidor autenticado.
export const getMiBalance = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_usuario = obtenerIdUsuario(req), id_repartidor = await balanceService.obtenerIdRepartidorDelUsuario(id_usuario);
        const resumen = await balanceService.obtenerResumen(id_repartidor);
        return res.json({ success: true, balance: resumen });
    } catch (e) { return error(res, e); }
};

// GET /balance/mis-transacciones — Lista las transacciones recientes.
export const getMisTransacciones = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_usuario = obtenerIdUsuario(req), id_repartidor = await balanceService.obtenerIdRepartidorDelUsuario(id_usuario);
        const limite = Number(req.query.limite || 50), offset = Number(req.query.offset || 0);
        const transacciones = await balanceService.listarTransaccionesBalance(id_repartidor, { limite, offset });
        return res.json({ success: true, id_repartidor, total: transacciones.length, transacciones });
    } catch (e) { return error(res, e); }
};

// POST /balance/depositar — Registra un depósito de efectivo.
export const postDepositar = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const { monto } = req.body || {}, id_usuario = obtenerIdUsuario(req);
        const id_repartidor = await balanceService.obtenerIdRepartidorDelUsuario(id_usuario);
        const resultado = await balanceService.depositarEfectivo(id_repartidor, monto);
        return res.status(201).json({ success: true, message: "Depósito registrado correctamente.", ...resultado });
    } catch (e) { return error(res, e); }
};

// POST /balance/pedido/:id/recalcular — Sincroniza un pago existente con la billetera.
export const postRecalcularPago = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const { id } = req.params;
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        const resultado = await balanceService.sincronizarPagoExistente(Number(id));
        return res.json({ success: true, ...resultado });
    } catch (e) { return error(res, e); }
};

// GET /balance/repartidor/:id_repartidor — resumen (uso admin/soporte)
export const getBalanceRepartidorAdmin = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_repartidor = Number(req.params.id_repartidor);
        if (!Number.isInteger(id_repartidor) || id_repartidor <= 0) return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." });
        const resumen = await balanceService.obtenerResumen(id_repartidor);
        return res.json({ success: true, balance: resumen });
    } catch (e) { return error(res, e); }
};

// GET /balance/repartidor/:id_repartidor/transacciones
export const getTransaccionesRepartidorAdmin = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_repartidor = Number(req.params.id_repartidor);
        if (!Number.isInteger(id_repartidor) || id_repartidor <= 0) return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." });
        const limite = Number(req.query.limite || 50), offset = Number(req.query.offset || 0);
        const transacciones = await balanceService.listarTransaccionesBalance(id_repartidor, { limite, offset });
        return res.json({ success: true, id_repartidor, total: transacciones.length, transacciones });
    } catch (e) { return error(res, e); }
};

// POST /balance/repartidor/:id_repartidor/pagar — admin registra que el repartidor entregó efectivo
export const postRegistrarPagoBalance = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const id_repartidor = Number(req.params.id_repartidor);
        if (!Number.isInteger(id_repartidor) || id_repartidor <= 0) return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." });

        const { monto, observacion } = req.body || {};
        const id_usuario_registro = obtenerIdUsuario(req);

        const resultado = await balanceService.registrarPagoBalanceAdmin(id_repartidor, monto, { observacion, id_usuario_registro });
        return res.status(201).json({ success: true, message: "Pago de balance registrado correctamente.", ...resultado });
    } catch (e) { return error(res, e); }
};
