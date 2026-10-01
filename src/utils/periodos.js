// src/utils/periodos.js
// Manejo de rangos de fechas en hora de Ecuador (UTC-5, sin horario de verano).

const OFFSET_EC = -5 * 60 * 60 * 1000;
const DIA_MS = 86400000;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha (AAAA-MM-DD) en Ecuador de un instante
export const fechaEC = (instante) => new Date(new Date(instante).getTime() + OFFSET_EC).toISOString().slice(0, 10);

// Día de la semana en Ecuador (0 = domingo ... 6 = sábado)
export const diaSemanaEC = (instante) => new Date(new Date(instante).getTime() + OFFSET_EC).getUTCDay();

export const hoyEC = () => fechaEC(Date.now());

export const sumarDias = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

export const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);

const fechaValida = (f) => FECHA_RE.test(f || "") && !Number.isNaN(Date.parse(`${f}T00:00:00Z`)) && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f;

/**
 * Valida y normaliza un rango. Si no se envía, usa los últimos 7 días (incluyendo hoy).
 * Devuelve { desde, hasta, dias, inicio, fin } (inicio/fin son instantes Date) o { error }.
 */
export const parseRango = (desde, hasta, maxDias = 366) => {
    const fin = hasta || hoyEC();
    const ini = desde || sumarDias(fin, -6);
    if (!fechaValida(ini) || !fechaValida(fin)) return { error: "Las fechas deben tener formato AAAA-MM-DD." };
    if (ini > fin) return { error: "La fecha inicial no puede ser posterior a la final." };
    const dias = diasEntre(ini, fin) + 1;
    if (dias > maxDias) return { error: `El rango máximo permitido es de ${maxDias} días.` };
    return {
        desde: ini, hasta: fin, dias,
        inicio: new Date(`${ini}T00:00:00-05:00`),
        fin: new Date(`${fin}T23:59:59.999-05:00`)
    };
};

// Periodo inmediatamente anterior, de la misma duración
export const periodoAnterior = (rango) => {
    const hasta = sumarDias(rango.desde, -1);
    const desde = sumarDias(hasta, -(rango.dias - 1));
    return { desde, hasta, dias: rango.dias, inicio: new Date(`${desde}T00:00:00-05:00`), fin: new Date(`${hasta}T23:59:59.999-05:00`) };
};