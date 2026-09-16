// npm install node-cron
const cron = require('node-cron');
const { generarHorariosSemana, limpiarSemanaAnterior } = require('../services/horarios.generacion.service');

function siguienteLunes(desde = new Date()) {
    const fecha = new Date(desde);
    const dia = fecha.getDay(); // 0 = domingo
    const diasHastaLunes = dia === 0 ? 1 : (8 - dia) % 7 || 7;
    fecha.setDate(fecha.getDate() + diasHastaLunes);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
}

// Corre todos los domingos a las 20:00 (hora del servidor). Genera la semana
// que arranca el lunes siguiente y limpia lo que quedó de la semana pasada.
cron.schedule('0 20 * * 0', async () => {
    try {
        const lunesQueViene = siguienteLunes();
        console.log('[cron] Generando horarios para la semana del', lunesQueViene.toISOString().slice(0, 10));

        await limpiarSemanaAnterior(lunesQueViene);
        const resultado = await generarHorariosSemana(lunesQueViene);

        console.log('[cron] Resultado:', resultado);
    } catch (error) {
        console.error('[cron] Error generando horarios semanales:', error);
    }
});

// Requiere este archivo UNA VEZ desde tu app.js/server.js para activar el cron:
//   require('./jobs/generarHorariosSemanales.job');
module.exports = {};