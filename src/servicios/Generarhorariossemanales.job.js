import cron from "node-cron";
import { generarHorariosSemana, finalizarHorariosVencidos, purgarHistorialAntiguo } from "./Horarios.generacion.service.js";
import { finalizarReservasVencidas } from "./Reservas.service.js";

const OFFSET_MS = 5 * 3600 * 1000; // Ecuador UTC-5

function hoyEcuador() {
    const d = new Date(Date.now() - OFFSET_MS);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function lunesDe(fecha) {
    const d = new Date(fecha);
    const dia = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
    return d;
}
const iso = f => f.toISOString().slice(0, 10);

let corriendo = false;
// Garantiza que existan la semana actual (días que faltan desde hoy) y la siguiente.
export async function asegurarHorarios() {
    if (corriendo) return;
    corriendo = true;
    try {
        const hoy = hoyEcuador();
        const lunesActual = lunesDe(hoy);
        const lunesSiguiente = new Date(lunesActual); lunesSiguiente.setUTCDate(lunesSiguiente.getUTCDate() + 7);

        await purgarHistorialAntiguo(lunesActual);
        for (const lunes of [lunesActual, lunesSiguiente]) {
            const r = await generarHorariosSemana(lunes, { desdeISO: iso(hoy) });
            if (r.generado) console.log("[cron] Horarios generados:", r);
        }
    } catch (error) {
        console.error("[cron] Error asegurando horarios:", error);
    } finally {
        corriendo = false;
    }
}

// Cada hora y también al arrancar (por si el servidor estaba dormido).
cron.schedule("5 * * * *", asegurarHorarios, { timezone: "America/Guayaquil" });
asegurarHorarios();

// Cada 10 minutos: finaliza lo que ya terminó.
cron.schedule("*/10 * * * *", async () => {
    try {
        await finalizarHorariosVencidos();
        await finalizarReservasVencidas();
    } catch (error) {
        console.error("[cron] Error finalizando turnos vencidos:", error);
    }
});

console.log("[cron] Job de horarios cargado");
