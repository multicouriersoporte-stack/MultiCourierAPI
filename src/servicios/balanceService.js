// Lógica de negocio del Balance; coordina billetera y pedidos sin tocar HTTP.
import { conmysql } from "../db.js";
import * as billeteraService from "./billeteraService.js";
import * as pedidoService from "./pedidoService.js";
import { sincronizarPagoConBalance } from "../integracion/sincronizarPagoConBalance.js";

// Obtiene el resumen del balance del repartidor.
export async function obtenerResumen(id_repartidor) {
    const billetera = await billeteraService.obtenerOAsegurarBilletera(null, id_repartidor);
    const saldo = Number(billetera.billetera_saldo), limite = Number(billetera.billetera_limite || 25);
    const transacciones = await billeteraService.listarTransacciones(billetera.id_billetera, { limite: 0, offset: 0 });
    const sumar = (tipo) => Math.abs(transacciones.filter(t => t.transaccion_tipo === tipo).reduce((sum, t) => sum + Number(t.transaccion_monto || 0), 0));

    return {
        id_billetera: billetera.id_billetera, id_repartidor: billetera.id_repartidor, saldo, limite,
        deuda: Number(billetera.billetera_deuda || 0), porcentaje_minimo: Number(billetera.billetera_porcentaje_minimo || 20),
        efectivo_habilitado: Number(billetera.billetera_efectivo_habilitado) === 1, excede_limite: saldo > limite,
        efectivo_recolectado: sumar("EFECTIVO_RECIBIDO"), total_depositado: sumar("DEPOSITO"), total_carreras_propinas: sumar("PAGO_REPARTIDOR"),
        fecha_actualizacion: billetera.billetera_fecha_actualizacion
    };
}

// Lista las transacciones del repartidor.
export async function listarTransaccionesBalance(id_repartidor, { limite = 50, offset = 0 } = {}) {
    const billetera = await billeteraService.obtenerBilletera(id_repartidor);
    return billetera ? billeteraService.listarTransacciones(billetera.id_billetera, { limite, offset }) : [];
}

// Registra un depósito y actualiza el saldo/habilitación de efectivo.
export async function depositarEfectivo(id_repartidor, monto) {
    const montoDepositado = Number(monto);
    if (!Number.isFinite(montoDepositado) || montoDepositado <= 0)
        throw Object.assign(new Error("El monto a depositar debe ser mayor a cero."), { status: 400 });

    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const billetera = await billeteraService.obtenerOAsegurarBilletera(conexion, id_repartidor, true);
        if (!billetera) throw Object.assign(new Error("No se encontró la billetera."), { status: 404 });

        const saldo = Number(billetera.billetera_saldo);
        if (saldo <= 0) throw Object.assign(new Error(`No tienes efectivo pendiente por depositar. Tu saldo es ${saldo.toFixed(2)} US$.`), { status: 400 });
        if (montoDepositado > saldo) throw Object.assign(new Error(`El monto a depositar (${montoDepositado.toFixed(2)} US$) excede tu saldo disponible (${saldo.toFixed(2)} US$).`), { status: 400 });

        const nuevoSaldo = saldo - montoDepositado;
        // Registra el depósito como movimiento negativo para reducir el saldo.
        const movimiento = await billeteraService.insertarMovimiento(conexion, {
            id_billetera: billetera.id_billetera, id_repartidor, tipo: "DEPOSITO", monto: -montoDepositado,
            saldoAnterior: saldo, saldoNuevo: nuevoSaldo, concepto: `Depósito de efectivo: ${montoDepositado.toFixed(2)} US$`, referencia: `DEPOSITO-${Date.now()}`
        });

        await billeteraService.actualizarSaldo(conexion, billetera.id_billetera, nuevoSaldo);
        const habilitado = nuevoSaldo <= Number(billetera.billetera_limite || 25);
        await billeteraService.actualizarHabilitacionEfectivo(conexion, billetera.id_billetera, habilitado);

        // Premia al repartidor con un punto por realizar el depósito.
        await conexion.query(
            `UPDATE repartidores SET repartidor_puntos = COALESCE(repartidor_puntos, 0) + 1 WHERE id_repartidor = ?`,
            [id_repartidor]
        );

        await conexion.commit();
        const [transaccion] = await conexion.query(`SELECT * FROM billetera_transacciones WHERE id_transaccion = ? LIMIT 1`, [movimiento.id_transaccion]);

        return {
            transaccion: transaccion[0] || null,
            balance: { saldo: nuevoSaldo, limite: Number(billetera.billetera_limite), excede_limite: nuevoSaldo > Number(billetera.billetera_limite), efectivo_habilitado: habilitado }
        };
    } catch (error) {
        try { await conexion.rollback(); } catch (_) { }
        throw error;
    } finally { conexion.release(); }
}

// Sincroniza un pago existente con la billetera evitando movimientos duplicados.
export async function sincronizarPagoExistente(id_pedido) {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const [pagos] = await conexion.query(`SELECT * FROM pagos_repartidor WHERE id_pedido = ? LIMIT 1`, [id_pedido]);
        if (!pagos.length) throw Object.assign(new Error("El pedido no tiene un pago de repartidor registrado. No se puede sincronizar."), { status: 404 });

        const pago = pagos[0];
        const [existentes] = await conexion.query(`SELECT id_transaccion FROM billetera_transacciones WHERE id_pago_repartidor = ? LIMIT 1`, [pago.id_pago_repartidor]);
        if (existentes.length) {
            await conexion.commit();
            return { sincronizado: false, mensaje: "Este pago ya está sincronizado con la billetera." };
        }

        const pedido = await pedidoService.obtenerPedidoParaBalance(conexion, id_pedido);
        const movimientos = await sincronizarPagoConBalance(conexion, {
            id_pedido: Number(id_pedido), id_repartidor: pago.id_repartidor, pedidoTotal: Number(pedido?.pedido_total ?? 0),
            pagoTotal: Number(pago.pago_repartidor_total ?? 0), esEfectivo: pedidoService.esPedidoEfectivo(pedido),
            id_pago_repartidor: pago.id_pago_repartidor
        });

        await conexion.commit();
        return { sincronizado: true, movimientos: movimientos || [] };
    } catch (error) {
        try { await conexion.rollback(); } catch (_) { }
        throw error;
    } finally { conexion.release(); }
}

// Admin registra que el repartidor entregó efectivo (reduce la deuda). No otorga puntos (eso es solo autodepósito).
export async function registrarPagoBalanceAdmin(id_repartidor, monto, { observacion = null, id_usuario_registro = null } = {}) {
    const montoPagado = Number(monto);
    if (!Number.isFinite(montoPagado) || montoPagado <= 0)
        throw Object.assign(new Error("El monto registrado debe ser mayor a cero."), { status: 400 });

    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const billetera = await billeteraService.obtenerOAsegurarBilletera(conexion, id_repartidor, true);
        if (!billetera) throw Object.assign(new Error("No se encontró la billetera del repartidor."), { status: 404 });

        const saldo = Number(billetera.billetera_saldo);
        if (saldo <= 0) throw Object.assign(new Error(`El repartidor no tiene balance pendiente. Saldo actual: ${saldo.toFixed(2)} US$.`), { status: 400 });
        if (montoPagado > saldo) throw Object.assign(new Error(`El monto (${montoPagado.toFixed(2)} US$) excede el balance pendiente (${saldo.toFixed(2)} US$).`), { status: 400 });

        const nuevoSaldo = saldo - montoPagado;
        const conceptoTexto = `Pago de balance registrado por administrador${observacion ? `: ${observacion}` : ""}`;

        const movimiento = await billeteraService.insertarMovimiento(conexion, {
            id_billetera: billetera.id_billetera, id_repartidor, tipo: "DEPOSITO", monto: -montoPagado,
            saldoAnterior: saldo, saldoNuevo: nuevoSaldo, concepto: conceptoTexto,
            referencia: `PAGO_BALANCE_ADMIN-${id_usuario_registro ?? "SN"}-${Date.now()}`
        });

        await billeteraService.actualizarSaldo(conexion, billetera.id_billetera, nuevoSaldo);
        const habilitado = nuevoSaldo <= Number(billetera.billetera_limite || 25);
        await billeteraService.actualizarHabilitacionEfectivo(conexion, billetera.id_billetera, habilitado);

        await conexion.commit();
        const [transaccion] = await conexion.query(`SELECT * FROM billetera_transacciones WHERE id_transaccion = ? LIMIT 1`, [movimiento.id_transaccion]);

        return {
            transaccion: transaccion[0] || null,
            balance: { saldo: nuevoSaldo, limite: Number(billetera.billetera_limite), excede_limite: nuevoSaldo > Number(billetera.billetera_limite), efectivo_habilitado: habilitado }
        };
    } catch (error) {
        try { await conexion.rollback(); } catch (_) { }
        throw error;
    } finally { conexion.release(); }
}

// Obtiene el repartidor asociado al usuario autenticado.
export async function obtenerIdRepartidorDelUsuario(id_usuario) {
    if (!id_usuario) throw Object.assign(new Error("No se pudo identificar al usuario."), { status: 401 });
    const [rows] = await conmysql.query(`SELECT id_repartidor FROM repartidores WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
    if (!rows.length) throw Object.assign(new Error("El usuario no tiene un repartidor asociado."), { status: 403 });
    return Number(rows[0].id_repartidor);
}
