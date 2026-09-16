// sincronizarPagoConBalance.js — Integra pagos con la Billetera.
// Usar dentro de la misma conexión/transacción que crea el pago.

import * as billeteraService from "../servicios/billeteraService.js";
import * as pedidoService from "../servicios/pedidoService.js";

/**
 * Registra EFECTIVO_RECIBIDO (+pedido_total) si el pedido es en efectivo
 * y PAGO_REPARTIDOR (-pagoTotal) siempre que exista un pago al repartidor.
 */
export async function sincronizarPagoConBalance(conexion, { id_pedido, id_repartidor, pedidoTotal, pagoTotal, esEfectivo, id_pago_repartidor }) {
    if (!conexion) throw new Error("sincronizarPagoConBalance requiere una conexión existente.");
    if (!id_repartidor) return null;

    const billetera = await billeteraService.obtenerOAsegurarBilletera(conexion, id_repartidor, true);
    if (!billetera) return null;

    let saldo = Number(billetera.billetera_saldo), movimientos = [];

    // El repartidor recibe todo el efectivo cobrado por el pedido.
    if (esEfectivo) {
        const pedido = await pedidoService.obtenerPedidoParaBalance(conexion, id_pedido);
        const efectivoRecibido = Number(pedido?.pedido_total ?? pedidoTotal ?? 0);
        if (efectivoRecibido > 0) {
            const saldoAnterior = saldo;
            saldo += efectivoRecibido;
            const mov = await billeteraService.insertarMovimiento(conexion, {
                id_billetera: billetera.id_billetera, id_repartidor, id_pedido, id_pago_repartidor: id_pago_repartidor ?? null,
                tipo: "EFECTIVO_RECIBIDO", monto: efectivoRecibido, saldoAnterior, saldoNuevo: saldo,
                concepto: `Efectivo recibido del pedido ${pedido?.pedido_codigo ?? `#${id_pedido}`}`,
                referencia: pedido?.pedido_codigo ?? null
            });
            movimientos.push({ ...mov, tipo: "EFECTIVO_RECIBIDO", monto: efectivoRecibido });
        }
    }

    // Descuenta de la billetera lo que la app debe al repartidor.
    if (Number(pagoTotal) > 0) {
        const monto = Number(pagoTotal), saldoAnterior = saldo;
        saldo -= monto;
        const mov = await billeteraService.insertarMovimiento(conexion, {
            id_billetera: billetera.id_billetera, id_repartidor, id_pedido, id_pago_repartidor: id_pago_repartidor ?? null,
            tipo: "PAGO_REPARTIDOR", monto: -monto, saldoAnterior, saldoNuevo: saldo,
            concepto: `Carreras y propinas generadas — pedido #${id_pedido}`, referencia: null
        });
        movimientos.push({ ...mov, tipo: "PAGO_REPARTIDOR", monto: -monto });
    }

    // Guarda el saldo final y actualiza la habilitación para efectivo.
    if (movimientos.length) {
        await billeteraService.actualizarSaldo(conexion, billetera.id_billetera, saldo);
        await billeteraService.actualizarHabilitacionEfectivo(conexion, billetera.id_billetera, saldo <= Number(billetera.billetera_limite || 25));
    }

    return movimientos;
}
