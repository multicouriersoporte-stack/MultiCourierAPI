// sincronizarPagoConBalance.js — Integra la creación de pagos con la Billetera.
//
// Función utilitaria para llamar desde pagosrepartidorCtrl.crearPagoRepartidorDesdePedido
// después de INSERT en pagos_repartidor, o desde el endpoint manual POST /balance/pedido/:id/recalcular.
//
// Uso dentro de crearPagoRepartidorDesdePedido (después del INSERT, antes del commit):
//
//   import { sincronizarPagoConBalance } from "../integracion/sincronizarPagoConBalance.js";
//   // ... dentro de crearPagoRepartidorDesdePedido:
//   await sincronizarPagoConBalance(conexion, {
//     id_pedido: idPedido,
//     id_repartidor: pedido.id_repartidor,
//     pedidoTotal: Number(pedido.pedido_total ?? 0),
//     pagoTotal: montoRepartidor,
//     esEfectivo: String(pedido.metodo_pago_nombre || "").trim().toUpperCase() === "EFECTIVO",
//     id_pago_repartidor: resultado.insertId,
//   });

import * as billeteraService from "../servicios/billeteraService.js";
import * as pedidoService from "../servicios/pedidoService.js";

/**
 * Registra los movimientos correspondientes a la entrega de un pedido en la Billetera:
 *  - EFECTIVO_RECIBIDO (+pedido_total)  solo si método de pago = EFECTIVO.
 *  - PAGO_REPARTIDOR  (−pago_repartidor_total)  siempre que se genere un pago al repartidor.
 *
 * Siempre se ejecuta dentro de la misma conexión/transacción que el pago.
 *
 * @param {import('mysql2').Connection} conexion  — conexión con transacción activa
 * @param {Object} params
 * @param {number} params.id_pedido
 * @param {number} params.id_repartidor
 * @param {number} params.pedidoTotal  — total del pedido (todo el efectivo que el repartidor colectó)
 * @param {number} params.pagoTotal    — monto que la app le debe al repartidor (carrera neta + propina)
 * @param {boolean} params.esEfectivo  — true si método de pago = EFECTIVO
 * @param {number}  [params.id_pago_repartidor]
 */
export async function sincronizarPagoConBalance(
    conexion,
    { id_pedido, id_repartidor, pedidoTotal, pagoTotal, esEfectivo, id_pago_repartidor }
) {
    if (!conexion) throw new Error("sincronizarPagoConBalance requiere una conexión existente.");
    if (!id_repartidor) return null;

    const billetera = await billeteraService.obtenerOAsegurarBilletera(conexion, id_repartidor, true);
    if (!billetera) return null;

    let saldo = Number(billetera.billetera_saldo);
    const movimientos = [];

    // 1. EFECTIVO RECIBIDO: el repartidor recibe todo el dinero en efectivo del pedido.
    if (esEfectivo) {
        const pedido = await pedidoService.obtenerPedidoParaBalance(conexion, id_pedido);
        const efectivoRecibido = Number(pedido?.pedido_total ?? pedidoTotal ?? 0);
        if (efectivoRecibido > 0) {
            const saldoAnterior = saldo;
            saldo += efectivoRecibido;
            const mov = await billeteraService.insertarMovimiento(conexion, {
                id_billetera: billetera.id_billetera,
                id_repartidor,
                id_pedido,
                id_pago_repartidor: id_pago_repartidor ?? null,
                tipo: "EFECTIVO_RECIBIDO",
                monto: +efectivoRecibido,
                saldoAnterior,
                saldoNuevo: saldo,
                concepto: `Efectivo recibido del pedido ${pedido?.pedido_codigo ?? `#${id_pedido}`}`,
                referencia: pedido?.pedido_codigo ?? null,
            });
            movimientos.push({ ...mov, tipo: "EFECTIVO_RECIBIDO", monto: efectivoRecibido });
        }
    }

    // 2. PAGO REPARTIDOR: lo que la app le debe al repartidor por carreras + propinas.
    if (Number(pagoTotal) > 0) {
        const saldoAnterior = saldo;
        saldo -= Number(pagoTotal);
        const mov = await billeteraService.insertarMovimiento(conexion, {
            id_billetera: billetera.id_billetera,
            id_repartidor,
            id_pedido,
            id_pago_repartidor: id_pago_repartidor ?? null,
            tipo: "PAGO_REPARTIDOR",
            monto: -Number(pagoTotal),
            saldoAnterior,
            saldoNuevo: saldo,
            concepto: `Carreras y propinas generadas — pedido #${id_pedido}`,
            referencia: null,
        });
        movimientos.push({ ...mov, tipo: "PAGO_REPARTIDOR", monto: -Number(pagoTotal) });
    }

    // Actualizar saldo y flag de habilitación.
    if (movimientos.length) {
        await billeteraService.actualizarSaldo(conexion, billetera.id_billetera, saldo);
        const habilitado = saldo <= Number(billetera.billetera_limite || 25);
        await billeteraService.actualizarHabilitacionEfectivo(conexion, billetera.id_billetera, habilitado);
    }

    return movimientos;
}