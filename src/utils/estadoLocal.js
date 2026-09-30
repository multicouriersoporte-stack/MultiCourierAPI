const OFFSET_EC = -5 * 60 * 60 * 1000; // Ecuador no tiene horario de verano

const aMinutos = (t) => {
    if (!t) return null;
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
};

const minutosAhoraEC = () => {
    const d = new Date(Date.now() + OFFSET_EC);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
};

// ¿Está abierto según el horario?
export const abiertoPorHorario = (apertura, cierre) => {
    const a = aMinutos(apertura), c = aMinutos(cierre), m = minutosAhoraEC();
    if (a === null || c === null || a === c) return true;   // sin horario: abierto
    return a < c ? (m >= a && m < c) : (m >= a || m < c);   // soporta horarios que cruzan medianoche
};

// Epoch (ms) de la próxima vez que sea esa hora (hora Ecuador)
export const proximaOcurrencia = (hora) => {
    const minutos = aMinutos(hora);
    if (minutos === null) return null;
    const ahoraEC = Date.now() + OFFSET_EC;
    const inicioDia = Math.floor(ahoraEC / 86400000) * 86400000;
    let objetivo = inicioDia + minutos * 60000;
    if (objetivo <= ahoraEC) objetivo += 86400000;
    return objetivo - OFFSET_EC;
};

// Devuelve el local con el estado efectivo calculado
export const calcularEstado = (l) => {
    if (!l) return l;
    const ahora = Date.now();
    const auto = abiertoPorHorario(l.local_hora_apertura, l.local_hora_cierre);
    const manualVigente = l.local_modo_manual && l.local_modo_manual !== "AUTO"
        && (!l.local_manual_hasta || ahora < Number(l.local_manual_hasta));
    const abierto = manualVigente ? l.local_modo_manual === "ABIERTO" : auto;

    return {
        ...l,
        id_estado: abierto ? 1 : 2,
        local_abierto: abierto,
        local_estado_origen: manualVigente ? "MANUAL" : "AUTO",
        local_manual_desde: manualVigente ? Number(l.local_manual_desde) : null,
        local_manual_hasta: manualVigente && l.local_manual_hasta ? Number(l.local_manual_hasta) : null
    };
};