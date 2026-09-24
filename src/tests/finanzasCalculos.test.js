// Ejecutar: node --test backend/tests/
import test from "node:test";
import assert from "node:assert/strict";
import {
    calcularPagoRepartidor, calcularPagoLocal, efectivoARecolectar, evaluarEfectivo,
    clasificarMetodoPago, redondear, TIPO_PAGO
} from "../servicios/finanzasCalculos.js";

// Simula el libro de Balance (movimientos con signo) para probar secuencias.
const libro = () => {
    let saldo = 0;
    return { aplicar: m => (saldo = redondear(saldo + m)), get saldo() { return saldo; } };
};

test("Clasificación de métodos de pago", () => {
    for (const nombre of ["Transferencia", "Depósito", "De una", "Tarjeta", "Billetera del cliente"])
        assert.equal(clasificarMetodoPago({ metodo_pago_nombre: nombre }), TIPO_PAGO.ONLINE, nombre);
    assert.equal(clasificarMetodoPago({ metodo_pago_nombre: "Efectivo" }), TIPO_PAGO.EFECTIVO);
    assert.equal(clasificarMetodoPago({ metodo_pago_nombre: "Cripto" }), null); // desconocido => el caller debe fallar
    assert.equal(clasificarMetodoPago({ metodo_pago_nombre: "X", metodo_pago_es_efectivo: 1 }), TIPO_PAGO.EFECTIVO);
});

test("Caso A - pedido en línea (tarjeta): balance no sube, pago = carrera - comisión + propina", () => {
    // Con 25% de comisión sobre la carrera de $4 => comisión $1 (ejemplo del enunciado).
    const pago = calcularPagoRepartidor({ carrera: 4, propina: 2, porcentajeComision: 25 });
    assert.equal(pago.carreraBruta, 4);
    assert.equal(pago.comision, 1);
    assert.equal(pago.propina, 2);
    assert.equal(pago.total, 5);
    assert.equal(efectivoARecolectar({ tipo: TIPO_PAGO.ONLINE, pedido_total: 26 }), 0);
});

test("Caso A' - regla vigente del sistema (7.5% de la carrera)", () => {
    const pago = calcularPagoRepartidor({ carrera: 4, propina: 2, porcentajeComision: 7.5 });
    assert.equal(pago.comision, 0.3);
    assert.equal(pago.total, 5.7);
});

test("Caso B - pedido en efectivo: balance +26 y pagos (carrera+propina) independientes", () => {
    assert.equal(efectivoARecolectar({ tipo: TIPO_PAGO.EFECTIVO, pedido_total: 26 }), 26);
    const pago = calcularPagoRepartidor({ carrera: 4, propina: 2, porcentajeComision: 25 });
    assert.equal(pago.total, 5); // Pagos NO se altera por ser efectivo; Balance y Pagos son conceptos distintos
});

test("Caso C - varios pedidos en efectivo y depósito parcial", () => {
    const l = libro();
    [20, 15, 25].forEach(t => l.aplicar(efectivoARecolectar({ tipo: TIPO_PAGO.EFECTIVO, pedido_total: t })));
    assert.equal(l.saldo, 60);
    l.aplicar(-40);
    assert.equal(l.saldo, 20);
});

test("Caso D - límite 100: 95 + 20 = 115 restringe; depósito de 30 => 85 rehabilita", () => {
    const l = libro();
    l.aplicar(95);
    assert.equal(evaluarEfectivo({ balance: l.saldo, limite: 100 }).puede_recibir_efectivo, true);
    l.aplicar(20);
    const e = evaluarEfectivo({ balance: l.saldo, limite: 100 });
    assert.equal(e.balance, 115);
    assert.equal(e.restringido, true);
    assert.equal(e.disponible, 0);
    l.aplicar(-30);
    const e2 = evaluarEfectivo({ balance: l.saldo, limite: 100 });
    assert.equal(e2.balance, 85);
    assert.equal(e2.restringido, false);
    assert.equal(e2.advertencia, true); // 85% >= umbral 80%
});

test("Límite exacto restringe (>=) y justo por debajo no", () => {
    assert.equal(evaluarEfectivo({ balance: 100, limite: 100 }).restringido, true);
    assert.equal(evaluarEfectivo({ balance: 99.99, limite: 100 }).restringido, false);
});

test("Reverso deja el balance como estaba y el precio flotante no acumula error", () => {
    const l = libro();
    l.aplicar(0.1); l.aplicar(0.2);
    assert.equal(l.saldo, 0.3);
    l.aplicar(-0.3);
    assert.equal(l.saldo, 0);
});

test("Pago local: subtotal - comisión", () => {
    assert.deepEqual(calcularPagoLocal({ subtotal: 20, porcentajeComision: 1 }), { subtotal: 20, comision: 0.2, total: 19.8 });
});

test("Validaciones: valores negativos o NaN se rechazan", () => {
    assert.throws(() => calcularPagoRepartidor({ carrera: -1, propina: 0, porcentajeComision: 5 }));
    assert.throws(() => calcularPagoRepartidor({ carrera: "abc", propina: 0, porcentajeComision: 5 }));
});