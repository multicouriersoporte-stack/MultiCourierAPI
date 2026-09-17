import cron from "node-cron";

//import { generarHorariosSemana, limpiarSemanaAnterior } from "./Horarios.generacion.service.js";
import { generarHorariosSemana, finalizarHorariosVencidos, purgarHistorialAntiguo } from "./Horarios.generacion.service.js";
import { finalizarReservasVencidas } from "./Reservas.service.js";

function siguienteLunes(desde = new Date()) {
    const fecha = new Date(desde);
    const dia = fecha.getDay(); // 0 = domingo

    const diasHastaLunes =
        dia === 0 ? 1 : (8 - dia) % 7 || 7;

    fecha.setDate(fecha.getDate() + diasHastaLunes);
    fecha.setHours(0, 0, 0, 0);

    return fecha;
}

// Corre todos los domingos a las 20:00,
// usando la hora de Ecuador.
cron.schedule(
    "30 17 * * 3",
    async () => {
        try {
            const lunesQueViene = siguienteLunes();

            console.log(
                "[cron] Generando horarios para la semana del",
                lunesQueViene.toISOString().slice(0, 10)
            );

            await limpiarSemanaAnterior(lunesQueViene);

            const resultado =
                await generarHorariosSemana(lunesQueViene);

            console.log("[cron] Resultado:", resultado);

        } catch (error) {
            console.error(
                "[cron] Error generando horarios semanales:",
                error
            );
        }
    },
    {
        timezone: "America/Guayaquil"
    }
);

// Cada 10 minutos: pasa a "finalizado"/"completada" lo que ya terminó.
cron.schedule("*/10 * * * *", async () => {
    try {
        await finalizarHorariosVencidos();
        await finalizarReservasVencidas();
    } catch (error) {
        console.error("[cron] Error finalizando turnos vencidos:", error);
    }
});

// Semanal: genera la semana nueva y purga todo lo anterior a la semana pasada.
cron.schedule(
    "30 17 * * 3",
    async () => {
        try {
            const lunesQueViene = siguienteLunes();
            await purgarHistorialAntiguo(lunesQueViene);
            const resultado = await generarHorariosSemana(lunesQueViene);
            console.log("[cron] Resultado:", resultado);
        } catch (error) {
            console.error("[cron] Error generando horarios semanales:", error);
        }
    },
    { timezone: "America/Guayaquil" }
);

console.log("[cron] Job de horarios semanales cargado");
