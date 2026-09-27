// Funciones PURAS (sin BD) con toda la matemática financiera. Se prueban en tests/finanzasCalculos.test.js

export const redondear = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const normalizar = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export const TIPO_PAGO = Object.freeze({ ONLINE: "ONLINE", EFECTIVO: "EFECTIVO" });

const NOMBRES_ONLINE = ["TRANSFERENCIA", "DEPOSITO", "DE UNA", "DEUNA", "TARJETA", "BILLETERA"];
const IDS_ONLINE_CONOCIDOS = [3, 5]; // 3 = TARJETA, 5 = BILLETERA

export const clasificarMetodoPago = metodo => {
    if (!metodo) return null;
    const flag = metodo.metodo_pago_es_efectivo;
    if (flag !== undefined && flag !== null) return Number(flag) === 1 ? TIPO_PAGO.EFECTIVO : TIPO_PAGO.ONLINE;
    const n = normalizar(metodo.metodo_pago_nombre);
    if (n === "EFECTIVO") return TIPO_PAGO.EFECTIVO;
    if (NOMBRES_ONLINE.some(x => n === x || n.startsWith(x))) return TIPO_PAGO.ONLINE;
    if (IDS_ONLINE_CONOCIDOS.includes(Number(metodo.id_metodo_pago))) return TIPO_PAGO.ONLINE;
    return null;
};

const numeroNoNegativo = (valor, nombre) => {
    const n = Number(valor ?? 0);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${nombre} inválido.`);
    return n;
};

export const calcularPagoRepartidor = ({ carrera, propina, porcentajeComision, otros = 0 }) => {
    const c = numeroNoNegativo(carrera, "La carrera");
    const p = numeroNoNegativo(propina, "La propina");
    const o = numeroNoNegativo(otros, "Otros");
    const pct = numeroNoNegativo(porcentajeComision, "El porcentaje de comisión");
    const comision = redondear((c * pct) / 100);
    const carreraNeta = redondear(c - comision);
    return {
        porcentajeComision: pct, carreraBruta: redondear(c), comision, carreraNeta,
        propina: redondear(p), otros: redondear(o), total: redondear(carreraNeta + p + o)
    };
};

export const calcularPagoLocal = ({ subtotal, porcentajeComision }) => {
    const s = numeroNoNegativo(subtotal, "El subtotal");
    const comision = redondear((s * numeroNoNegativo(porcentajeComision, "El porcentaje")) / 100);
    return { subtotal: redondear(s), comision, total: redondear(s - comision) };
};

export const efectivoARecolectar = ({ tipo, pedido_total }) =>
    tipo === TIPO_PAGO.EFECTIVO ? redondear(numeroNoNegativo(pedido_total, "El total del pedido")) : 0;

/**
 * Estado del efectivo de un repartidor.
 * CORRECCIÓN (Sección 5 de la especificación): la restricción se activa SOLO cuando el balance
 * SUPERA el límite (balance > límite). balance == límite sigue habilitado.
 * El código anterior usaba `balance >= limite`, que bloqueaba incorrectamente justo en el límite
 * de cada repartidor (el límite es individual: repartidor_limite_billetera, no un valor fijo).
 */
export const evaluarEfectivo = ({ balance, limite, umbralAdvertenciaPct = 80 }) => {
    const b = redondear(balance ?? 0);
    const l = redondear(limite);
    const restringido = b > l;
    // Con balance negativo el porcentaje puede salir negativo; se acota a 0 solo para la barra de progreso.
    const porcentaje = l > 0 ? Math.max(0, Math.min(100, redondear((b / l) * 100))) : (b > 0 ? 100 : 0);
    return {
        balance: b,
        limite: l,
        disponible: redondear(Math.max(0, l - b)),
        porcentaje,
        restringido,
        advertencia: !restringido && b >= redondear((l * umbralAdvertenciaPct) / 100),
        puede_recibir_efectivo: !restringido
    };
};

/**
 * Regla de depósito (Secciones 3, 7-14 de la especificación). El límite y el balance son SIEMPRE
 * los del repartidor concreto que se está evaluando; no hay ningún valor fijo tipo "$100".
 *
 * - Balance <= 0: no hay nada que depositar (Sección 4: balance negativo nunca exige depósito).
 * - 0 < Balance <= límite: mínimo = porcentajeMinimoNormal% del balance (80% por defecto);
 *   recomendado = 100% del balance.
 * - Balance > límite: NO hay mínimo bloqueante (Sección 14: se permite depósito parcial). Se informa
 *   un "objetivo" (porcentajeObjetivoExceso% del límite, 20% por defecto) y cuánto se necesitaría
 *   depositar para llegar a él — puramente informativo. Alcanzar ese objetivo NO es obligatorio
 *   para desbloquear el efectivo: basta con volver a Balance <= límite.
 */
export const calcularReglaDeposito = ({ balance, limite, porcentajeMinimoNormal = 80, porcentajeObjetivoExceso = 20 }) => {
    const b = redondear(balance ?? 0);
    const l = redondear(limite);

    if (b <= 0) {
        return {
            balance: b, limite: l, excede_limite: false, requiere_deposito: false,
            minimo: 0, recomendado: 0, objetivo: null, deposito_para_objetivo: null
        };
    }

    const excede = b > l;

    if (!excede) {
        const minimo = redondear((b * porcentajeMinimoNormal) / 100);
        return {
            balance: b, limite: l, excede_limite: false, requiere_deposito: true,
            minimo, recomendado: b, objetivo: null, deposito_para_objetivo: null
        };
    }

    const objetivo = redondear((l * porcentajeObjetivoExceso) / 100);
    const depositoParaObjetivo = redondear(Math.max(0, b - objetivo));
    return {
        balance: b, limite: l, excede_limite: true, requiere_deposito: true,
        minimo: 0, recomendado: b, objetivo, deposito_para_objetivo: depositoParaObjetivo
    };
};
