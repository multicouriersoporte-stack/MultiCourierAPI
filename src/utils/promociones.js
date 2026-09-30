// src/utils/promociones.js
// Helpers compartidos por cupones y descuentos.

const OFFSET_EC = -5 * 60 * 60 * 1000; // Ecuador (UTC-5), sin horario de verano

export const CODIGO_RE = /^[A-Z0-9_-]{3,30}$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de hoy en Ecuador (AAAA-MM-DD). Render corre en UTC, por eso no se usa new Date() directo.
export const hoyEC = () => new Date(Date.now() + OFFSET_EC).toISOString().slice(0, 10);

export const normalizarCodigo = (c) => String(c ?? "").toUpperCase().replace(/\s/g, "");

export const limiteONull = (l) => (l === null || l === undefined || l === "" ? null : Number(l));

export const validarValor = (tipo, valor) => {
    const v = Number(valor);
    if (!(v > 0)) return "El valor del descuento debe ser mayor a 0";
    if (tipo === "porcentaje" && v > 100) return "El porcentaje no puede superar 100";
    return null;
};

export const validarVigenciaYLimites = (b) => {
    if (!FECHA_RE.test(b.fecha_inicio || "") || !FECHA_RE.test(b.fecha_fin || "")) return "Las fechas deben tener formato AAAA-MM-DD";
    if (b.fecha_fin < b.fecha_inicio) return "La fecha de vencimiento no puede ser anterior a la de inicio";

    const minimo = Number(b.monto_minimo ?? 0);
    if (Number.isNaN(minimo) || minimo < 0) return "La compra mínima no puede ser negativa";

    const limite = limiteONull(b.limite_usos);
    if (limite !== null && (!Number.isInteger(limite) || limite < 1)) return "El límite de usos debe ser un entero mayor a 0";
    return null;
};

// Agrega `estado` calculado: inactivo | vencido | agotado | programado | activo
export const calcularEstadoPromo = (p) => {
    if (!p) return p;
    const hoy = hoyEC();
    const limite = p.limite_usos === null || p.limite_usos === undefined ? null : Number(p.limite_usos);
    const usos = Number(p.usos_actuales || 0);
    const activo = Number(p.activo) === 1;

    let estado = "activo";
    if (!activo) estado = "inactivo";
    else if (p.fecha_fin < hoy) estado = "vencido";
    else if (limite !== null && usos >= limite) estado = "agotado";
    else if (p.fecha_inicio > hoy) estado = "programado";

    const salida = { ...p, activo, usos_actuales: usos, limite_usos: limite, monto_minimo: Number(p.monto_minimo || 0), estado };
    if (p.valor_descuento !== undefined) salida.valor_descuento = Number(p.valor_descuento);
    if (p.valor !== undefined) salida.valor = Number(p.valor);
    return salida;
};