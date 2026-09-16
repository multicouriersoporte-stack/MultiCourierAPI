const pool = require('../config/db');

// ================== CONFIGURACIÓN DE GENERACIÓN ==================
const DURACIONES_MINUTOS = [150, 75];       // 2h30 y 1h15
const HORA_INICIO_JORNADA = '08:30:00';
const HORA_FIN_JORNADA = '23:30:00';
const INTERVALO_INICIO_MINUTOS = 60;        // cada cuánto arranca un nuevo turno
const CUPOS_POR_TURNO = 2;                  // máx. repartidores en paralelo por turno
// ===================================================================

function textoAMinutos(texto) {
    const [h, m] = texto.split(':').map(Number);
    return h * 60 + m;
}

function minutosATexto(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    return `${h}:${m}:00`;
}

function sumarDias(fecha, dias) {
    const nueva = new Date(fecha);
    nueva.setDate(nueva.getDate() + dias);
    return nueva;
}

function aISO(fecha) {
    return fecha.toISOString().slice(0, 10);
}

/**
 * Genera, para un solo día, todos los turnos posibles (ambas duraciones)
 * arrancando cada INTERVALO_INICIO_MINUTOS. Esto es lo que resuelve
 * "máximo 2 turnos por hora": en vez de bloques fijos de 2h30 que solo dan
 * ~6 turnos al día, hay un turno nuevo empezando cada hora, cada uno con
 * cupo para 2 repartidores en paralelo.
 */
function generarSlotsDelDia(fechaISO) {
    const inicioJornada = textoAMinutos(HORA_INICIO_JORNADA);
    const finJornada = textoAMinutos(HORA_FIN_JORNADA);
    const filas = [];

    for (const duracion of DURACIONES_MINUTOS) {
        let inicio = inicioJornada;
        while (inicio + duracion <= finJornada) {
            filas.push([
                fechaISO,
                minutosATexto(inicio),
                minutosATexto(inicio + duracion),
                duracion,
                CUPOS_POR_TURNO,
                CUPOS_POR_TURNO,
                1, // DISPONIBLE
            ]);
            inicio += INTERVALO_INICIO_MINUTOS;
        }
    }
    return filas;
}

/**
 * Genera los horarios de lunes a domingo para la semana que inicia en `fechaLunes`.
 */
async function generarHorariosSemana(fechaLunes) {
    const semanaInicioISO = aISO(fechaLunes);
    const semanaFinISO = aISO(sumarDias(fechaLunes, 6));

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existe] = await conn.query(
            'SELECT id_generacion FROM horario_generaciones WHERE semana_inicio = ? FOR UPDATE',
            [semanaInicioISO]
        );
        if (existe.length > 0) {
            await conn.rollback();
            return { generado: false, motivo: 'La semana ya fue generada previamente' };
        }

        let filas = [];
        for (let i = 0; i < 7; i++) {
            filas = filas.concat(generarSlotsDelDia(aISO(sumarDias(fechaLunes, i))));
        }

        await conn.query(
            `INSERT INTO horarios_disponibles
        (horario_fecha, horario_hora_inicio, horario_hora_fin, horario_duracion_minutos,
         horario_cupos_totales, horario_cupos_disponibles, horario_estado)
       VALUES ?`,
            [filas]
        );

        await conn.query(
            `INSERT INTO horario_generaciones (semana_inicio, semana_fin, total_horarios_creados)
       VALUES (?, ?, ?)`,
            [semanaInicioISO, semanaFinISO, filas.length]
        );

        await conn.commit();
        return { generado: true, total: filas.length, semanaInicio: semanaInicioISO };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * Limpieza de la semana anterior:
 * - Si un turno NUNCA fue tomado, se borra físicamente (tal como pediste).
 * - Si tuvo al menos una reserva, se marca FINALIZADO en vez de borrarse:
 *   borrarlo rompería la FK con horario_reservas y perderías el historial
 *   de horas trabajadas que usamos para desempatar reservas (ver reservas.service.js).
 */
async function limpiarSemanaAnterior(fechaLunesActual) {
    const fechaLimiteISO = aISO(fechaLunesActual);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [borrados] = await conn.query(
            `DELETE hd FROM horarios_disponibles hd
       LEFT JOIN horario_reservas hr ON hr.id_horario_disponible = hd.id_horario_disponible
       WHERE hd.horario_fecha < ? AND hr.id_reserva IS NULL`,
            [fechaLimiteISO]
        );

        const [finalizados] = await conn.query(
            `UPDATE horarios_disponibles
       SET horario_estado = 3
       WHERE horario_fecha < ? AND horario_estado NOT IN (3, 4)`,
            [fechaLimiteISO]
        );

        await conn.commit();
        return { eliminados: borrados.affectedRows, finalizados: finalizados.affectedRows };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { generarHorariosSemana, limpiarSemanaAnterior, generarSlotsDelDia };