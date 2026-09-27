import { randomUUID } from "node:crypto";
import { conmysql } from "../db.js";
import { crearPagoLocalDesdePedido } from "../controladores/pagoslocalesCtrl.js";
import { crearPagoRepartidorDesdePedido } from "../controladores/pagosrepartidorCtrl.js";
import {
    redondear, clasificarMetodoPago, TIPO_PAGO, calcularPagoRepartidor, calcularPagoLocal,
    efectivoARecolectar, evaluarEfectivo, calcularReglaDeposito
} from "./finanzasCalculos.js";

export class ErrorFinanzas extends Error {
    constructor(message, status = 409, codigo = undefined) { super(message); this.status = status; this.codigo = codigo; }
}

// Sección 5/7/13: los porcentajes son configurables vía `configuracion_financiera`; el límite y el
// balance base son SIEMPRE los del repartidor individual (repartidor_limite_billetera).
const CONFIG_DEFECTO = {
    limite_efectivo_default: 25, umbral_advertencia_pct: 80,
    deposito_porcentaje_minimo_normal: 80, deposito_porcentaje_objetivo_exceso: 20
};
const NOMBRE_ESTADO_BLOQUEADO = "INHABILITADO";
const NOMBRE_ESTADO_DESBLOQUEADO = "DESCONECTADO";

const conTransaccion = async (fn, externa = null) => {
    if (externa) return fn(externa);
    const c = await conmysql.getConnection();
    try { await c.beginTransaction(); const r = await fn(c); await c.commit(); return r; }
    catch (e) { try { await c.rollback(); } catch (_) { /* noop */ } throw e; }
    finally { c.release(); }
};

const auditar = (c, entidad, id, accion, detalle, id_usuario = null) =>
    c.query(`INSERT INTO finanzas_auditoria (auditoria_entidad,auditoria_id_entidad,auditoria_accion,auditoria_detalle,id_usuario) VALUES (?,?,?,?,?)`,
        [entidad, id ?? null, accion, JSON.stringify(detalle ?? {}), id_usuario]);

export const obtenerConfig = async (c = conmysql) => {
    const cfg = { ...CONFIG_DEFECTO };
    try {
        const [rows] = await c.query(`SELECT config_clave,config_valor FROM configuracion_financiera`);
        for (const r of rows) if (Number.isFinite(Number(r.config_valor))) cfg[r.config_clave] = Number(r.config_valor);
    } catch (e) { if (e.code !== "ER_NO_SUCH_TABLE") throw e; }
    return cfg;
};

const limiteDe = (rep, cfg) => {
    const l = Number(rep.repartidor_limite_billetera);
    return Number.isFinite(l) && l > 0 ? l : cfg.limite_efectivo_default;
};

const bloquearRepartidor = async (c, id_repartidor) => {
    const [rows] = await c.query(
        `SELECT r.id_repartidor,r.id_usuario,r.id_estado_repartidor,r.repartidor_balance_efectivo,r.repartidor_limite_billetera,er.estado_repartidor_nombre
     FROM repartidores r LEFT JOIN estados_repartidor er ON r.id_estado_repartidor=er.id_estado_repartidor
     WHERE r.id_repartidor=? LIMIT 1 FOR UPDATE`, [id_repartidor]);
    if (!rows.length) throw new ErrorFinanzas("El repartidor no existe.", 404);
    return rows[0];
};

// ─────────────────────────── Estado de efectivo ───────────────────────────

/**
 * Devuelve el estado completo de efectivo de UN repartidor concreto: su balance, su límite propio,
 * la regla de depósito vigente para SU balance, y una alerta si cambió el balance mientras tenía
 * un depósito pendiente (Sección 17).
 */
export const estadoEfectivoRepartidor = async (id_repartidor, c = conmysql) => {
    const cfg = await obtenerConfig(c);
    const [rows] = await c.query(
        `SELECT r.id_repartidor,r.id_estado_repartidor,r.repartidor_balance_efectivo,r.repartidor_limite_billetera,er.estado_repartidor_nombre
     FROM repartidores r LEFT JOIN estados_repartidor er ON r.id_estado_repartidor=er.id_estado_repartidor WHERE r.id_repartidor=? LIMIT 1`, [id_repartidor]);
    if (!rows.length) throw new ErrorFinanzas("El repartidor no existe.", 404);
    const rep = rows[0];
    const limite = limiteDe(rep, cfg);

    // Sección 15: en teoría solo puede haber uno, pero se lee la lista completa por seguridad/depuración.
    const [pendRows] = await c.query(
        `SELECT id_deposito, deposito_monto FROM repartidor_depositos WHERE id_repartidor=? AND deposito_estado='PENDIENTE' ORDER BY id_deposito DESC`,
        [id_repartidor]
    );
    const totalPendiente = redondear(pendRows.reduce((s, d) => s + Number(d.deposito_monto || 0), 0));
    const depositoPendiente = pendRows[0] || null;

    const regla = calcularReglaDeposito({
        balance: rep.repartidor_balance_efectivo, limite,
        porcentajeMinimoNormal: cfg.deposito_porcentaje_minimo_normal,
        porcentajeObjetivoExceso: cfg.deposito_porcentaje_objetivo_exceso
    });

    // Sección 17: si el balance cambió (por un nuevo pedido o un pago) mientras el depósito seguía
    // pendiente, el monto declarado puede haber dejado de alcanzar el nuevo mínimo. No se invalida
    // automáticamente la solicitud (la confirmación sigue siendo decisión de SOPORTE/ADMINISTRADOR),
    // pero se expone la alerta para que el repartidor y el admin la vean.
    let alerta_recalculo = null;
    if (depositoPendiente && !regla.excede_limite && Number(depositoPendiente.deposito_monto) < regla.minimo) {
        alerta_recalculo = {
            id_deposito: depositoPendiente.id_deposito,
            monto_declarado: redondear(depositoPendiente.deposito_monto),
            nuevo_minimo: regla.minimo,
            mensaje: `Tu Balance cambió. El monto mínimo de depósito debe recalcularse: ahora es ${regla.minimo} de ${regla.balance} de Balance.`
        };
    }

    return {
        id_repartidor: Number(id_repartidor),
        ...evaluarEfectivo({ balance: rep.repartidor_balance_efectivo, limite, umbralAdvertenciaPct: cfg.umbral_advertencia_pct }),
        depositos_pendientes: totalPendiente,
        deposito_pendiente_id: depositoPendiente ? depositoPendiente.id_deposito : null,
        regla_deposito: regla,
        alerta_recalculo,
        bloqueado_cuenta: String(rep.estado_repartidor_nombre || "").toUpperCase() === NOMBRE_ESTADO_BLOQUEADO
    };
};

const metodoDePedido = async (c, id_metodo_pago) => {
    const [rows] = await c.query(`SELECT id_metodo_pago,metodo_pago_nombre,metodo_pago_es_efectivo FROM metodos_pago WHERE id_metodo_pago=? LIMIT 1`, [id_metodo_pago]);
    return rows[0] ?? null;
};

export const pedidoRequiereEfectivo = async (c, id_metodo_pago) => {
    const metodo = await metodoDePedido(c, id_metodo_pago);
    const tipo = clasificarMetodoPago(metodo);
    if (!tipo) throw new ErrorFinanzas(`El método de pago ${id_metodo_pago} no está clasificado como ONLINE/EFECTIVO.`, 500, "METODO_PAGO_SIN_CLASIFICAR");
    return tipo === TIPO_PAGO.EFECTIVO;
};

/**
 * Filtra repartidores según su propio límite/balance (no uno global).
 */
export const filtrarRepartidoresPorEfectivo = async (c, repartidores, id_metodo_pago) => {
    if (!(await pedidoRequiereEfectivo(c, id_metodo_pago))) return { elegibles: repartidores, excluidos: [] };
    const cfg = await obtenerConfig(c);
    const ids = repartidores.map(r => r.id_repartidor);
    if (!ids.length) return { elegibles: [], excluidos: [] };
    const [rows] = await c.query(`SELECT id_repartidor,repartidor_balance_efectivo,repartidor_limite_billetera FROM repartidores WHERE id_repartidor IN (?)`, [ids]);
    const porId = new Map(rows.map(r => [Number(r.id_repartidor), r]));
    const elegibles = [], excluidos = [];
    for (const r of repartidores) {
        const rep = porId.get(Number(r.id_repartidor));
        const ok = rep && !evaluarEfectivo({ balance: rep.repartidor_balance_efectivo, limite: limiteDe(rep, cfg) }).restringido;
        (ok ? elegibles : excluidos).push(r);
    }
    return { elegibles, excluidos };
};

export const validarRepartidorPuedeTomarPedido = async (c, { id_repartidor, id_metodo_pago }) => {
    if (!(await pedidoRequiereEfectivo(c, id_metodo_pago))) return { ok: true };
    const est = await estadoEfectivoRepartidor(id_repartidor, c);
    if (est.restringido)
        throw new ErrorFinanzas("El repartidor superó su límite de efectivo y solo puede recibir pedidos en línea. Debe depositar para volver a recibir pedidos en efectivo.", 409, "LIMITE_EFECTIVO_SUPERADO");
    return { ok: true, estado: est };
};

// ─────────────────────────── Libro de Balance ───────────────────────────

/**
 * Registra un movimiento del Balance. Idempotente por `clave` (evita doble descuento — Sección 34).
 * El Balance puede quedar NEGATIVO (Sección 4): esta función ya no bloquea eso para depósitos.
 * La validación de "no depositar más de lo que corresponde" ocurre en crearDeposito(), contra el
 * Balance vigente en ESE momento; entre esa validación y la confirmación del admin pueden ocurrir
 * otros movimientos (pagos confirmados, nuevos pedidos) que legítimamente dejen el Balance negativo
 * al confirmarse el depósito (Sección 19/28: ejemplo $60 − $64 = -$4).
 */
export const registrarMovimientoBalance = async (c, { id_repartidor, id_pedido = null, id_deposito = null, tipo, monto, concepto, clave, id_usuario = null }) => {
    const [existente] = await c.query(`SELECT * FROM repartidor_balance_movimientos WHERE balance_movimiento_clave=? LIMIT 1`, [clave]);
    if (existente.length) return { duplicado: true, movimiento: existente[0] };

    const rep = await bloquearRepartidor(c, id_repartidor);       // serializa movimientos del mismo repartidor
    const anterior = redondear(rep.repartidor_balance_efectivo);
    const delta = redondear(monto);
    const nuevo = redondear(anterior + delta);

    const [ins] = await c.query(
        `INSERT INTO repartidor_balance_movimientos (id_repartidor,id_pedido,id_deposito,balance_movimiento_tipo,balance_movimiento_monto,balance_movimiento_saldo_anterior,balance_movimiento_saldo_nuevo,balance_movimiento_concepto,balance_movimiento_clave,id_usuario_registra)
     VALUES (?,?,?,?,?,?,?,?,?,?)`, [id_repartidor, id_pedido, id_deposito, tipo, delta, anterior, nuevo, concepto, clave, id_usuario]);
    await c.query(`UPDATE repartidores SET repartidor_balance_efectivo=? WHERE id_repartidor=?`, [nuevo, id_repartidor]);
    return { duplicado: false, movimiento: { id_balance_movimiento: ins.insertId, tipo, monto: delta, saldo_anterior: anterior, saldo_nuevo: nuevo } };
};

// ─────────────────────────── Entrega del pedido ───────────────────────────
const leerPedidoFinanciero = async (c, id_pedido) => {
    const [rows] = await c.query(
        `SELECT p.id_pedido,p.pedido_codigo,p.id_local,p.id_repartidor,p.id_metodo_pago,p.pedido_total,p.pedido_carrera,p.pedido_propina,p.pedido_subtotal_local,e.estado_nombre
     FROM pedidos p LEFT JOIN estados e ON p.id_estado=e.id_estado WHERE p.id_pedido=? LIMIT 1 FOR UPDATE`, [id_pedido]);
    if (!rows.length) throw new ErrorFinanzas("El pedido no existe.", 404);
    return rows[0];
};

export const procesarEntregaFinanciera = (id_pedido, externa = null) => conTransaccion(async c => {
    const pedido = await leerPedidoFinanciero(c, id_pedido);
    if (String(pedido.estado_nombre || "").trim().toUpperCase() !== "ENTREGADO")
        throw new ErrorFinanzas(`Solo se procesan pedidos ENTREGADO. Estado actual: ${pedido.estado_nombre}.`, 409);
    if (!pedido.id_repartidor) throw new ErrorFinanzas(`El pedido ${id_pedido} no tiene repartidor asignado.`, 409);

    const tipo = clasificarMetodoPago(await metodoDePedido(c, pedido.id_metodo_pago));
    if (!tipo) throw new ErrorFinanzas("Método de pago sin clasificar (ONLINE/EFECTIVO).", 500, "METODO_PAGO_SIN_CLASIFICAR");

    const pago_local = await crearPagoLocalDesdePedido(id_pedido, c);
    const pago_repartidor = await crearPagoRepartidorDesdePedido(id_pedido, c);

    let balance = null;
    const monto = efectivoARecolectar({ tipo, pedido_total: pedido.pedido_total });
    if (monto > 0) {
        balance = await registrarMovimientoBalance(c, {
            id_repartidor: pedido.id_repartidor, id_pedido, tipo: "COBRO_EFECTIVO", monto,
            concepto: `Efectivo cobrado en ${pedido.pedido_codigo}`, clave: `COBRO:${id_pedido}`
        });
    }
    const efectivo = await estadoEfectivoRepartidor(pedido.id_repartidor, c);
    return { tipo_pago: tipo, pago_local, pago_repartidor, balance, efectivo };
}, externa);

// ─────────────────────────── Reversos / correcciones ───────────────────────────
const sumaAjustes = async (c, beneficiario, id_pago) => {
    const [r] = await c.query(`SELECT COALESCE(SUM(pago_ajuste_monto),0) AS t FROM pagos_ajustes WHERE pago_ajuste_beneficiario=? AND id_pago=?`, [beneficiario, id_pago]);
    return Number(r[0].t);
};
const insertarAjuste = (c, beneficiario, id_pago, id_pedido, monto, concepto, id_usuario) =>
    c.query(`INSERT INTO pagos_ajustes (pago_ajuste_beneficiario,id_pago,id_pedido,pago_ajuste_monto,pago_ajuste_concepto,id_usuario_registra) VALUES (?,?,?,?,?,?)`,
        [beneficiario, id_pago, id_pedido, redondear(monto), concepto, id_usuario]);

export const recalcularEntregaFinanciera = ({ id_pedido, anular = false, motivo, id_usuario = null }, externa = null) => conTransaccion(async c => {
    if (!String(motivo || "").trim()) throw new ErrorFinanzas("El motivo es obligatorio.", 400);
    const pedido = await leerPedidoFinanciero(c, id_pedido);
    const cambios = [];
    const etiqueta = anular ? "Reverso" : "Corrección";

    const [pr] = await c.query(`SELECT * FROM pagos_repartidor WHERE id_pedido=? LIMIT 1 FOR UPDATE`, [id_pedido]);
    if (pr.length) {
        const actual = redondear(Number(pr[0].pago_repartidor_total) + await sumaAjustes(c, "REPARTIDOR", pr[0].id_pago_repartidor));
        const esperado = anular ? 0 : calcularPagoRepartidor({
            carrera: pedido.pedido_carrera, propina: pedido.pedido_propina,
            porcentajeComision: pr[0].pago_repartidor_comision_porcentaje, otros: pr[0].pago_repartidor_otros
        }).total;
        const delta = redondear(esperado - actual);
        if (Math.abs(delta) >= 0.01) {
            await insertarAjuste(c, "REPARTIDOR", pr[0].id_pago_repartidor, id_pedido, delta, `${etiqueta}: ${motivo}`, id_usuario);
            cambios.push({ concepto: "PAGO_REPARTIDOR", delta });
        }
        if (anular && String(pr[0].pago_repartidor_estado).toUpperCase() === "PENDIENTE")
            await c.query(`UPDATE pagos_repartidor SET pago_repartidor_estado='CANCELADO' WHERE id_pago_repartidor=?`, [pr[0].id_pago_repartidor]);
    }

    const [pl] = await c.query(`SELECT * FROM pagos_locales WHERE id_pedido=? LIMIT 1 FOR UPDATE`, [id_pedido]);
    if (pl.length) {
        const actual = redondear(Number(pl[0].pago_local_total) + await sumaAjustes(c, "LOCAL", pl[0].id_pago_local));
        const esperado = anular ? 0 : calcularPagoLocal({ subtotal: pedido.pedido_subtotal_local, porcentajeComision: pl[0].pago_local_comision_porcentaje }).total;
        const delta = redondear(esperado - actual);
        if (Math.abs(delta) >= 0.01) {
            await insertarAjuste(c, "LOCAL", pl[0].id_pago_local, id_pedido, delta, `${etiqueta}: ${motivo}`, id_usuario);
            cambios.push({ concepto: "PAGO_LOCAL", delta });
        }
        if (anular && String(pl[0].pago_local_estado).toUpperCase() === "PENDIENTE")
            await c.query(`UPDATE pagos_locales SET pago_local_estado='CANCELADO' WHERE id_pago_local=?`, [pl[0].id_pago_local]);
    }

    if (pedido.id_repartidor) {
        const tipo = clasificarMetodoPago(await metodoDePedido(c, pedido.id_metodo_pago));
        if (!tipo) throw new ErrorFinanzas("Método de pago sin clasificar (ONLINE/EFECTIVO).", 500, "METODO_PAGO_SIN_CLASIFICAR");
        const esperado = anular ? 0 : efectivoARecolectar({ tipo, pedido_total: pedido.pedido_total });
        const [s] = await c.query(`SELECT COALESCE(SUM(balance_movimiento_monto),0) AS t FROM repartidor_balance_movimientos WHERE id_pedido=? AND balance_movimiento_tipo='COBRO_EFECTIVO'`, [id_pedido]);
        const delta = redondear(esperado - Number(s[0].t));
        if (Math.abs(delta) >= 0.01) {
            await registrarMovimientoBalance(c, {
                id_repartidor: pedido.id_repartidor, id_pedido, tipo: anular ? "REVERSO" : "AJUSTE", monto: delta,
                concepto: `${etiqueta} ${pedido.pedido_codigo}: ${motivo}`, clave: `AJ:${id_pedido}:${randomUUID()}`, id_usuario
            });
            cambios.push({ concepto: "BALANCE_EFECTIVO", delta });
        }
    }

    await auditar(c, "PEDIDO", id_pedido, anular ? "REVERSO_FINANCIERO" : "CORRECCION_FINANCIERA", { motivo, cambios }, id_usuario);
    return { id_pedido, anulado: anular, cambios, sin_cambios: cambios.length === 0 };
}, externa);

// ─────────────────────────── Depósitos ───────────────────────────

/**
 * Crea un depósito. Aplica:
 * - Sección 15: un solo depósito PENDIENTE a la vez por repartidor.
 * - Sección 4: si el balance es <= 0, no hay nada que depositar.
 * - Sección 7-10: si el balance no supera el límite, el mínimo es el % configurado (80% por defecto)
 *   del balance ACTUAL del repartidor (no un valor fijo).
 * - Sección 14: si el balance supera el límite, se permite depósito parcial (sin mínimo bloqueante).
 */
export const crearDeposito = ({ id_repartidor, monto, referencia = null, comprobante_url = null, id_usuario = null }) => conTransaccion(async c => {
    const m = redondear(monto);
    if (!Number.isFinite(m) || m <= 0) throw new ErrorFinanzas("El monto del depósito debe ser mayor a cero.", 400);

    const rep = await bloquearRepartidor(c, id_repartidor);   // serializa: evita la carrera de dos depósitos simultáneos

    const [pendExistente] = await c.query(
        `SELECT id_deposito FROM repartidor_depositos WHERE id_repartidor=? AND deposito_estado='PENDIENTE' LIMIT 1`, [id_repartidor]
    );
    if (pendExistente.length)
        throw new ErrorFinanzas(`Ya tienes un depósito pendiente de confirmación (#${pendExistente[0].id_deposito}). Espera a que sea confirmado o rechazado antes de registrar otro.`, 409, "DEPOSITO_PENDIENTE_EXISTENTE");

    const cfg = await obtenerConfig(c);
    const limite = limiteDe(rep, cfg);
    const regla = calcularReglaDeposito({
        balance: rep.repartidor_balance_efectivo, limite,
        porcentajeMinimoNormal: cfg.deposito_porcentaje_minimo_normal,
        porcentajeObjetivoExceso: cfg.deposito_porcentaje_objetivo_exceso
    });

    if (!regla.requiere_deposito)
        throw new ErrorFinanzas(`No tienes efectivo pendiente por depositar. Tu Balance actual es ${regla.balance}.`, 400, "SIN_EFECTIVO_PENDIENTE");
    if (m > regla.balance)
        throw new ErrorFinanzas(`El depósito (${m}) supera tu Balance actual (${regla.balance}).`, 409, "DEPOSITO_EXCEDE_BALANCE");
    if (!regla.excede_limite && m < regla.minimo)
        throw new ErrorFinanzas(`Debes depositar como mínimo ${regla.minimo} de los ${regla.balance} de Balance.`, 400, "DEPOSITO_MENOR_AL_MINIMO");

    const [ins] = await c.query(`INSERT INTO repartidor_depositos (id_repartidor,deposito_monto,deposito_referencia,deposito_comprobante_url) VALUES (?,?,?,?)`,
        [id_repartidor, m, referencia, comprobante_url]);
    await auditar(c, "DEPOSITO", ins.insertId, "CREADO", { monto: m, referencia, balance_al_crear: regla.balance }, id_usuario);

    return {
        id_deposito: ins.insertId, monto: m, estado: "PENDIENTE",
        regla_deposito: regla,
        es_100_por_ciento: m >= regla.recomendado,
        recomendacion: m < regla.recomendado
            ? `Has alcanzado el depósito mínimo${!regla.excede_limite ? ` de ${regla.minimo}` : ""}. Se recomienda depositar el 100% (${regla.recomendado}).`
            : "Has depositado el 100% de tu Balance."
    };
});

const leerDeposito = async (c, id) => {
    const [r] = await c.query(`SELECT * FROM repartidor_depositos WHERE id_deposito=? LIMIT 1 FOR UPDATE`, [id]);
    if (!r.length) throw new ErrorFinanzas("El depósito no existe.", 404);
    return r[0];
};

export const confirmarDeposito = ({ id_deposito, id_usuario }) => conTransaccion(async c => {
    const d = await leerDeposito(c, id_deposito);
    if (d.deposito_estado !== "PENDIENTE") throw new ErrorFinanzas(`El depósito está ${d.deposito_estado}; solo se confirman los PENDIENTE.`, 409);
    const mov = await registrarMovimientoBalance(c, {
        id_repartidor: d.id_repartidor, id_deposito, tipo: "DEPOSITO", monto: -Number(d.deposito_monto),
        concepto: `Depósito #${id_deposito}${d.deposito_referencia ? ` (${d.deposito_referencia})` : ""}`, clave: `DEP:${id_deposito}`, id_usuario
    });
    await c.query(`UPDATE repartidor_depositos SET deposito_estado='CONFIRMADO',id_usuario_revisa=?,deposito_fecha_revision=NOW() WHERE id_deposito=?`, [id_usuario, id_deposito]);
    await auditar(c, "DEPOSITO", id_deposito, "CONFIRMADO", { monto: d.deposito_monto }, id_usuario);
    return { id_deposito, estado: "CONFIRMADO", movimiento: mov.movimiento, efectivo: await estadoEfectivoRepartidor(d.id_repartidor, c) };
});

export const rechazarDeposito = ({ id_deposito, motivo, id_usuario }) => conTransaccion(async c => {
    if (!String(motivo || "").trim()) throw new ErrorFinanzas("El motivo es obligatorio.", 400);
    const d = await leerDeposito(c, id_deposito);
    if (d.deposito_estado !== "PENDIENTE") throw new ErrorFinanzas(`El depósito está ${d.deposito_estado}; solo se rechazan los PENDIENTE.`, 409);
    await c.query(`UPDATE repartidor_depositos SET deposito_estado='RECHAZADO',id_usuario_revisa=?,deposito_fecha_revision=NOW(),deposito_motivo=? WHERE id_deposito=?`, [id_usuario, motivo, id_deposito]);
    await auditar(c, "DEPOSITO", id_deposito, "RECHAZADO", { motivo }, id_usuario);
    return { id_deposito, estado: "RECHAZADO" };   // el balance nunca se movió; el repartidor ya puede crear otro
});

export const revertirDeposito = ({ id_deposito, motivo, id_usuario }) => conTransaccion(async c => {
    if (!String(motivo || "").trim()) throw new ErrorFinanzas("El motivo es obligatorio.", 400);
    const d = await leerDeposito(c, id_deposito);
    if (d.deposito_estado !== "CONFIRMADO") throw new ErrorFinanzas("Solo se pueden revertir depósitos CONFIRMADOS.", 409);
    await registrarMovimientoBalance(c, {
        id_repartidor: d.id_repartidor, id_deposito, tipo: "REVERSO", monto: Number(d.deposito_monto),
        concepto: `Reverso depósito #${id_deposito}: ${motivo}`, clave: `REV-DEP:${id_deposito}`, id_usuario
    });
    await c.query(`UPDATE repartidor_depositos SET deposito_estado='REVERTIDO',id_usuario_revisa=?,deposito_fecha_revision=NOW(),deposito_motivo=? WHERE id_deposito=?`, [id_usuario, motivo, id_deposito]);
    await auditar(c, "DEPOSITO", id_deposito, "REVERTIDO", { motivo }, id_usuario);
    return { id_deposito, estado: "REVERTIDO", efectivo: await estadoEfectivoRepartidor(d.id_repartidor, c) };
});

export const registrarAjusteBalance = ({ id_repartidor, monto, concepto, id_usuario }) => conTransaccion(async c => {
    const m = redondear(monto);
    if (!Number.isFinite(m) || m === 0) throw new ErrorFinanzas("El monto del ajuste debe ser distinto de cero.", 400);
    if (!String(concepto || "").trim()) throw new ErrorFinanzas("El concepto es obligatorio.", 400);
    const mov = await registrarMovimientoBalance(c, { id_repartidor, tipo: "AJUSTE", monto: m, concepto, clave: `AJ:MANUAL:${randomUUID()}`, id_usuario });
    await auditar(c, "REPARTIDOR", id_repartidor, "AJUSTE_BALANCE_MANUAL", { monto: m, concepto }, id_usuario);
    return { movimiento: mov.movimiento, efectivo: await estadoEfectivoRepartidor(id_repartidor, c) };
});

export const cambiarBloqueoCuenta = ({ id_repartidor, bloquear, motivo, id_usuario }) => conTransaccion(async c => {
    if (!String(motivo || "").trim()) throw new ErrorFinanzas("El motivo es obligatorio.", 400);
    const rep = await bloquearRepartidor(c, id_repartidor);
    const actual = String(rep.estado_repartidor_nombre || "").toUpperCase();
    const destino = bloquear ? NOMBRE_ESTADO_BLOQUEADO : NOMBRE_ESTADO_DESBLOQUEADO;
    if (bloquear && actual === NOMBRE_ESTADO_BLOQUEADO) throw new ErrorFinanzas("La cuenta ya está bloqueada.", 409);
    if (!bloquear && actual !== NOMBRE_ESTADO_BLOQUEADO) throw new ErrorFinanzas("La cuenta no está bloqueada.", 409);
    const [e] = await c.query(`SELECT id_estado_repartidor FROM estados_repartidor WHERE UPPER(TRIM(estado_repartidor_nombre))=? AND estado_repartidor_estado=1 LIMIT 1`, [destino]);
    if (!e.length) throw new ErrorFinanzas(`No existe el estado de repartidor ${destino}.`, 500);
    await c.query(`UPDATE repartidores SET id_estado_repartidor=? WHERE id_repartidor=?`, [e[0].id_estado_repartidor, id_repartidor]);
    await auditar(c, "REPARTIDOR", id_repartidor, bloquear ? "CUENTA_BLOQUEADA" : "CUENTA_DESBLOQUEADA", { motivo, estado_previo: actual }, id_usuario);
    return { id_repartidor, bloqueado_cuenta: !!bloquear };
});

// ─────────────────────────── Consultas ───────────────────────────

/**
 * Balance completo de un repartidor, incluyendo el desglose 🔴/⚫/🟢 (Sección 25):
 * - efectivo_recolectado: suma de COBRO_EFECTIVO.
 * - total_depositado: suma de DEPOSITO confirmados.
 * - total_pagos_confirmados: suma de PAGO_CONFIRMADO (ganancias que ya descontaron el Balance).
 */
export const obtenerBalanceRepartidor = async (id_repartidor, { limite = 100 } = {}) => {
    const efectivo = await estadoEfectivoRepartidor(id_repartidor);
    const lim = Math.min(Math.max(Number(limite) || 100, 1), 500);
    const [movimientos] = await conmysql.query(
        `SELECT m.*,p.pedido_codigo,d.deposito_estado FROM repartidor_balance_movimientos m
     LEFT JOIN pedidos p ON m.id_pedido=p.id_pedido LEFT JOIN repartidor_depositos d ON m.id_deposito=d.id_deposito
     WHERE m.id_repartidor=? ORDER BY m.id_balance_movimiento DESC LIMIT ?`, [id_repartidor, lim]);
    const [depositos] = await conmysql.query(`SELECT * FROM repartidor_depositos WHERE id_repartidor=? ORDER BY id_deposito DESC LIMIT ?`, [id_repartidor, lim]);
    const [tot] = await conmysql.query(
        `SELECT COALESCE(SUM(CASE WHEN balance_movimiento_tipo='COBRO_EFECTIVO' THEN balance_movimiento_monto END),0) AS efectivo_recolectado,
            COALESCE(-SUM(CASE WHEN balance_movimiento_tipo='DEPOSITO' THEN balance_movimiento_monto END),0) AS depositado,
            COALESCE(-SUM(CASE WHEN balance_movimiento_tipo='PAGO_CONFIRMADO' THEN balance_movimiento_monto END),0) AS pagos_confirmados
     FROM repartidor_balance_movimientos WHERE id_repartidor=?`, [id_repartidor]);
    return {
        efectivo, efectivo_recolectado: Number(tot[0].efectivo_recolectado), total_depositado: Number(tot[0].depositado),
        total_pagos_confirmados: Number(tot[0].pagos_confirmados), movimientos, depositos
    };
};
