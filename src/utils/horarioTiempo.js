// Ecuador continental (Guayaquil, Quito) es siempre UTC-5, sin horario de verano.
export const OFFSET_ECUADOR_HORAS = 5;

function partesFecha(horarioFecha) {
    return typeof horarioFecha === "string"
        ? horarioFecha.slice(0, 10)
        : `${horarioFecha.getFullYear()}-${String(horarioFecha.getMonth() + 1).padStart(2, "0")}-${String(horarioFecha.getDate()).padStart(2, "0")}`;
}

// Convierte una fecha+hora "de pared" en Ecuador (como se guarda en horarios_disponibles)
// al instante UTC real, sin depender de la zona horaria configurada en el proceso Node.
export function instanteUtcDesdeHoraEcuador(horarioFecha, horaTexto) {
    const [anio, mes, dia] = partesFecha(horarioFecha).split("-").map(Number);
    const [hora, minuto, segundo = 0] = String(horaTexto).split(":").map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia, hora + OFFSET_ECUADOR_HORAS, minuto, segundo));
}
