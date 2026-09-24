import { conmysql } from "../db.js";
import {
    ErrorFinanzas, obtenerBalanceRepartidor, crearDeposito, confirmarDeposito, rechazarDeposito,
    revertirDeposito, registrarAjusteBalance, cambiarBloqueoCuenta, recalcularEntregaFinanciera, estadoEfectivoRepartidor
} from "../servicios/finanzasService.js";
import { obtenerIdUsuario, esIdValido } from "./pedidorepartidoresCtrl.js";

const responderError = (res, error, mensajeGenerico) => {
    if (error instanceof ErrorFinanzas)
        return res.status(error.status).json({ success: false, message: error.message, codigo: error.codigo });
    console.error("[Finanzas]", error);
    return res.status(500).json({ success: false, message: mensajeGenerico });
};

// El id_repartidor SIEMPRE se deduce del token: el frontend no puede consultar/operar sobre otro repartidor.
const repartidorDelToken = async req => {
    const idUsuario = Number(obtenerIdUsuario(req));
    if (!esIdValido(idUsuario)) throw new ErrorFinanzas("No se pudo identificar al usuario autenticado.", 401);
    const [r] = await conmysql.query(`SELECT id_repartidor FROM repartidores WHERE id_usuario=? LIMIT 1`, [idUsuario]);
    if (!r.length) throw new ErrorFinanzas("El usuario no tiene un repartidor asociado.", 403);
    return Number(r[0].id_repartidor);
};

export const getMiBalance = async (req, res) => {
    try { return res.json({ success: true, ...(await obtenerBalanceRepartidor(await repartidorDelToken(req), { limite: req.query.limite })) }); }
    catch (e) { return responderError(res, e, "Error al consultar el balance."); }
};

export const getBalanceRepartidor = async (req, res) => {
    try {
        if (!esIdValido(req.params.id_repartidor)) throw new ErrorFinanzas("ID de repartidor inválido.", 400);
        return res.json({ success: true, ...(await obtenerBalanceRepartidor(Number(req.params.id_repartidor), { limite: req.query.limite })) });
    } catch (e) { return responderError(res, e, "Error al consultar el balance."); }
};

export const postDeposito = async (req, res) => {
    try {
        const id_repartidor = await repartidorDelToken(req);
        const r = await crearDeposito({
            id_repartidor, monto: req.body?.monto, referencia: req.body?.referencia?.toString().slice(0, 120) ?? null,
            comprobante_url: req.body?.comprobante_url?.toString().slice(0, 500) ?? null, id_usuario: obtenerIdUsuario(req)
        });
        return res.status(201).json({ success: true, message: "Depósito registrado. Se reflejará en tu balance cuando sea confirmado.", ...r });
    } catch (e) { return responderError(res, e, "Error al registrar el depósito."); }
};

export const getMisDepositos = async (req, res) => {
    try {
        const id = await repartidorDelToken(req);
        const [rows] = await conmysql.query(`SELECT * FROM repartidor_depositos WHERE id_repartidor=? ORDER BY id_deposito DESC LIMIT 200`, [id]);
        return res.json({ success: true, depositos: rows });
    } catch (e) { return responderError(res, e, "Error al consultar depósitos."); }
};

export const getDepositos = async (req, res) => {
    try {
        const estado = String(req.query.estado || "").toUpperCase();
        const validos = ["PENDIENTE", "CONFIRMADO", "RECHAZADO", "REVERTIDO"];
        const [rows] = await conmysql.query(
            `SELECT d.*,r.repartidor_codigo,u.usuario_nombre_completo FROM repartidor_depositos d
       INNER JOIN repartidores r ON d.id_repartidor=r.id_repartidor LEFT JOIN usuarios u ON r.id_usuario=u.id_usuario
       ${validos.includes(estado) ? "WHERE d.deposito_estado=?" : ""} ORDER BY d.id_deposito DESC LIMIT 300`,
            validos.includes(estado) ? [estado] : []);
        return res.json({ success: true, depositos: rows });
    } catch (e) { return responderError(res, e, "Error al consultar depósitos."); }
};

const accionDeposito = (fn, exito) => async (req, res) => {
    try {
        if (!esIdValido(req.params.id)) throw new ErrorFinanzas("ID de depósito inválido.", 400);
        const r = await fn({ id_deposito: Number(req.params.id), motivo: req.body?.motivo, id_usuario: obtenerIdUsuario(req) });
        return res.json({ success: true, message: exito, ...r });
    } catch (e) { return responderError(res, e, "Error al procesar el depósito."); }
};
export const patchConfirmarDeposito = accionDeposito(confirmarDeposito, "Depósito confirmado.");
export const patchRechazarDeposito = accionDeposito(rechazarDeposito, "Depósito rechazado.");
export const patchRevertirDeposito = accionDeposito(revertirDeposito, "Depósito revertido.");

export const postAjusteBalance = async (req, res) => {
    try {
        if (!esIdValido(req.body?.id_repartidor)) throw new ErrorFinanzas("id_repartidor inválido.", 400);
        const r = await registrarAjusteBalance({ id_repartidor: Number(req.body.id_repartidor), monto: req.body.monto, concepto: req.body.concepto, id_usuario: obtenerIdUsuario(req) });
        return res.status(201).json({ success: true, message: "Ajuste registrado.", ...r });
    } catch (e) { return responderError(res, e, "Error al registrar el ajuste."); }
};

export const patchBloqueoCuenta = async (req, res) => {
    try {
        if (!esIdValido(req.params.id)) throw new ErrorFinanzas("ID de repartidor inválido.", 400);
        if (typeof req.body?.bloquear !== "boolean") throw new ErrorFinanzas("'bloquear' debe ser true o false.", 400);
        const r = await cambiarBloqueoCuenta({ id_repartidor: Number(req.params.id), bloquear: req.body.bloquear, motivo: req.body.motivo, id_usuario: obtenerIdUsuario(req) });
        return res.json({ success: true, message: r.bloqueado_cuenta ? "Cuenta bloqueada." : "Cuenta desbloqueada.", ...r, efectivo: await estadoEfectivoRepartidor(r.id_repartidor) });
    } catch (e) { return responderError(res, e, "Error al cambiar el bloqueo de la cuenta."); }
};

// Reverso (anular=true) o recálculo tras corregir carrera/propina/método (anular=false) de un pedido entregado.
export const postRecalcularFinanzasPedido = async (req, res) => {
    try {
        if (!esIdValido(req.params.id)) throw new ErrorFinanzas("ID de pedido inválido.", 400);
        const r = await recalcularEntregaFinanciera({ id_pedido: Number(req.params.id), anular: req.body?.anular === true, motivo: req.body?.motivo, id_usuario: obtenerIdUsuario(req) });
        return res.json({ success: true, message: r.sin_cambios ? "Sin diferencias; no se registró nada." : "Ajustes registrados.", ...r });
    } catch (e) { return responderError(res, e, "Error al recalcular las finanzas del pedido."); }
};