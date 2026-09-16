// balanceService.js — Lógica de negocio del Balance del repartidor.
// Orquesta billeteraService y pedidoService, sin tocar la capa HTTP.
import { conmysql } from "../db.js";
import * as billeteraService from "./billeteraService.js";
import * as pedidoService from "./pedidoService.js";
import { sincronizarPagoConBalance } from "../integracion/sincronizarPagoConBalance.js";

// ─── Consulta: resumen de balance ───────────────────────────────────────────

/**
 * Devuelve el resumen del balance para el repartidor autenticado.
 */
export async function obtenerResumen(id_repartidor) {
    const billetera = await billeteraService.obtenerOAsegurarBilletera(null, id_repartidor);
    const saldo = Number(billetera.billetera_saldo);
    const limite = Number(billetera.billetera_limite || 25);
    const excedeLimite = saldo > limite;

    // Agregados de transacciones: sumar montos por tipo.
    const transacciones = await billeteraService.listarTransacciones(billetera.id_billetera, { limite: 0, offset: 0 });
    const efectivoRecolectado = transacciones
        .filter((t) => t.transaccion_tipo === "EFECTIVO_RECIBIDO")
        .reduce((sum, t) => sum + Number(t.transaccion_monto || 0), 0);
    const totalDepositado = Math.abs(
        transacciones
            .filter((t) => t.transaccion_tipo === "DEPOSITO")
            .reduce((sum, t) => sum + Number(t.transaccion_monto || 0), 0)
    );
    const totalCarrerasPropinas = Math.abs(
        transacciones
            .filter((t) => t.transaccion_tipo === "PAGO_REPARTIDOR")
            .reduce((sum, t) => sum + Number(t.transaccion_monto || 0), 0)
    );

    return {
        id_billetera: billetera.id_billetera,
        id_repartidor: billetera.id_repartidor,
        saldo,
        limite,
        deuda: Number(billetera.billetera_deuda || 0),
        porcentaje_minimo: Number(billetera.billetera_porcentaje_minimo || 20),
        efectivo_habilitado: Number(billetera.billetera_efectivo_habilitado) === 1,
        excede_limite: excedeLimite,
        efectivo_recolectado: efectivoRecolectado,
        total_depositado: totalDepositado,
        total_carreras_propinas: totalCarrerasPropinas,
        fecha_actualizacion: billetera.billetera_fecha_actualizacion,
    };
}

// ─── Consulta: transacciones recientes ──────────────────────────────────────

/**
 * Lista las transacciones del repartidor (últimas N, o paginadas).
 */
export async function listarTransaccionesBalance(id_repartidor, { limite = 50, offset = 0 } = {}) {
    const billetera = await billeteraService.obtenerBilletera(id_repartidor);
    if (!billetera) return [];
    return billeteraService.listarTransacciones(billetera.id_billetera, { limite, offset });
}

// ─── Acción: depositar efectivo ─────────────────────────────────────────────

/**
 * Registra un depósito de efectivo del repartidor a la app.
 * Valida que el repartidor tenga saldo positivo (efectivo a depositar).
 * @returns {{ transaccion, balance }}
 */
export async function depositarEfectivo(id_repartidor, monto) {
    const montoDepositado = Number(monto);
    if (!Number.isFinite(montoDepositado) || montoDepositado <= 0) {
        throw Object.assign(new Error("El monto a depositar debe ser mayor a cero."), { status: 400 });
    }

    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();

        const billetera = await billeteraService.obtenerOAsegurarBilletera(conexion, id_repartidor, true);
        if (!billetera) throw Object.assign(new Error("No se encontró la billetera."), { status: 404 });

        const saldo = Number(billetera.billetera_saldo);
        if (saldo <= 0) {
            throw Object.assign(
                new Error("No tienes efectivo pendiente por depositar. Tu saldo es " + saldo.toFixed(2) + " US$."),
                { status: 400 }
            );
        }
        if (montoDepositado > saldo) {
            throw Object.assign(
                new Error("El monto a depositar (" + montoDepositado.toFixed(2) + " US$) excede tu saldo disponible (" + saldo.toFixed(2) + " US$)."),
                { status: 400 }
            );
        }

        const saldoAnterior = saldo;
        const nuevoSaldo = saldo - montoDepositado;

        // Registrar transacción DEPOSITO (monto negativo para que el saldo baje).
        const movimiento = await billeteraService.insertarMovimiento(conexion, {
            id_billetera: billetera.id_billetera,
            id_repartidor,
            tipo: "DEPOSITO",
            monto: -montoDepositado,
            saldoAnterior,
            saldoNuevo: nuevoSaldo,
            concepto: `Depósito de efectivo: ${montoDepositado.toFixed(2)} US$`,
            referencia: `DEPOSITO-${Date.now()}`,
        });

        // Actualizar saldo y desbloquear efectivo si pasa por debajo del límite.
        await billeteraService.actualizarSaldo(conexion, billetera.id_billetera, nuevoSaldo);
        const habilitado = nuevoSaldo <= Number(billetera.billetera_limite || 25);
        await billeteraService.actualizarHabilitacionEfectivo(conexion, billetera.id_billetera, habilitado);

        // Sumar puntos al repartidor (1 punto por depósito, recompensa "buen repartidor").
        await conexion.query(
            `UPDATE repartidores SET repartidor_puntos = COALESCE(repartidor_puntos, 0) + 1 WHERE id_repartidor = ?`,
            [id_repartidor]
        );

        await conexion.commit();

        const [transaccion] = await conexion.query(
            `SELECT * FROM billetera_transacciones WHERE id_transaccion = ? LIMIT 1`,
            [movimiento.id_transaccion]
        );

        return {
            transaccion: transaccion[0] || null,
            balance: {
                saldo: nuevoSaldo,
                limite: Number(billetera.billetera_limite),
                excede_limite: nuevoSaldo > Number(billetera.billetera_limite),
                efectivo_habilitado: habilitado,
            },
        };
    } catch (error) {
        try { await conexion.rollback(); } catch (_) { }
        throw error;
    } finally {
        conexion.release();
    }
}

// ─── Acción: sincronizar pago existente con billetera (backfill / re-sync) ──

/**
 * Sincroniza un pago de repartidor ya existente con la billetera.
 * Endpoint manual POST /balance/pedido/:id/recalcular — útil para datos históricos.
 */
export async function sincronizarPagoExistente(id_pedido) {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();

        // Obtener pago del pedido (debe existir).
        const [pagos] = await conexion.query(
            `SELECT * FROM pagos_repartidor WHERE id_pedido = ? LIMIT 1`,
            [id_pedido]
        );
        if (!pagos.length) {
            throw Object.assign(
                new Error("El pedido no tiene un pago de repartidor registrado. No se puede sincronizar."),
                { status: 404 }
            );
        }
        const pago = pagos[0];

        // Verificar si ya existe un movimiento de este pago (evitar duplicados).
        const [existentes] = await conexion.query(
            `SELECT id_transaccion FROM billetera_transacciones WHERE id_pago_repartidor = ? LIMIT 1`,
            [pago.id_pago_repartidor]
        );
        if (existentes.length) {
            await conexion.commit();
            return { sincronizado: false, mensaje: "Este pago ya está sincronizado con la billetera." };
        }

        const pedido = await pedidoService.obtenerPedidoParaBalance(conexion, id_pedido);
        const esEfectivo = pedidoService.esPedidoEfectivo(pedido);

        const movimientos = await sincronizarPagoConBalance(conexion, {
            id_pedido: Number(id_pedido),
            id_repartidor: pago.id_repartidor,
            pedidoTotal: Number(pedido?.pedido_total ?? 0),
            pagoTotal: Number(pago.pago_repartidor_total ?? 0),
            esEfectivo,
            id_pago_repartidor: pago.id_pago_repartidor,
        });

        await conexion.commit();
        return { sincronizado: true, movimientos: movimientos || [] };
    } catch (error) {
        try { await conexion.rollback(); } catch (_) { }
        throw error;
    } finally {
        conexion.release();
    }
}

// ─── Acción: obtener repartidor del usuario ─────────────────────────────────

/**
 * Dado el id_usuario (autenticado), retorna el id_repartidor asociado.
 * Lanza error 403 si no existe.
 */
export async function obtenerIdRepartidorDelUsuario(id_usuario) {
    if (!id_usuario) throw Object.assign(new Error("No se pudo identificar al usuario."), { status: 401 });
    const [rows] = await conmysql.query(
        `SELECT id_repartidor FROM repartidores WHERE id_usuario = ? LIMIT 1`,
        [id_usuario]
    );
    if (!rows.length) {
        throw Object.assign(
            new Error("El usuario no tiene un repartidor asociado."),
            { status: 403 }
        );
    }
    return Number(rows[0].id_repartidor);
}