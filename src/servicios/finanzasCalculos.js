// Funciones PURAS (sin BD) con toda la matemática financiera. Se prueban en tests/finanzasCalculos.test.js

export const redondear = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const normalizar = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export const TIPO_PAGO = Object.freeze({ ONLINE: "ONLINE", EFECTIVO: "EFECTIVO" });

const NOMBRES_ONLINE = ["TRANSFERENCIA", "DEPOSITO", "DE UNA", "DEUNA", "TARJETA", "BILLETERA"];
const IDS_ONLINE_CONOCIDOS = [3, 5]; // 3 = TARJETA, 5 = BILLETERA (ya usados en pedidosCtrl)

/**
 * Clasifica un método de pago como ONLINE o EFECTIVO.
 * Prioridad: columna metodo_pago_es_efectivo > nombre > id conocido.
 * Devuelve null si no se puede clasificar (el caller DEBE fallar en vez de adivinar con dinero de por medio).
 */
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

/** Pago al repartidor = carrera - comisión + propina (+ otros). La comisión sale SOLO de la carrera. */
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

/** Lo que recibe el local: subtotal - comisión. */
export const calcularPagoLocal = ({ subtotal, porcentajeComision }) => {
    const s = numeroNoNegativo(subtotal, "El subtotal");
    const comision = redondear((s * numeroNoNegativo(porcentajeComision, "El porcentaje")) / 100);
    return { subtotal: redondear(s), comision, total: redondear(s - comision) };
};

/** Efectivo que el repartidor cobra físicamente al cliente: TODO el total si es efectivo, 0 si es online. */
export const efectivoARecolectar = ({ tipo, pedido_total }) =>
    tipo === TIPO_PAGO.EFECTIVO ? redondear(numeroNoNegativo(pedido_total, "El total del pedido")) : 0;

/** Estado del efectivo de un repartidor. Restringido cuando balance >= límite. */
export const evaluarEfectivo = ({ balance, limite, umbralAdvertenciaPct = 80 }) => {
    const b = redondear(balance ?? 0);
    const l = redondear(limite);
    const restringido = b >= l;
    return {
        balance: b,
        limite: l,
        disponible: redondear(Math.max(0, l - b)),
        porcentaje: l > 0 ? Math.min(100, redondear((b / l) * 100)) : 100,
        restringido,
        advertencia: !restringido && b >= redondear((l * umbralAdvertenciaPct) / 100),
        puede_recibir_efectivo: !restringido
    };
};