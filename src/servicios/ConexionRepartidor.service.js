import { conmysql } from "../db.js";
import { instanteUtcDesdeHoraEcuador } from "../utils/horarioTiempo.js";

const ESTADO_REPARTIDOR = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5, INHABILITADO: 6 };
const MINUTOS_ANTICIPACION_MINIMA = 15;

const calcularInicioTurno = h => instanteUtcDesdeHoraEcuador(h.horario_fecha, h.horario_hora_inicio);
const calcularFinTurno = h => instanteUtcDesdeHoraEcuador(h.horario_fecha, h.horario_hora_fin);

function elegirHorarioRelevante(vigentes, ahora) {
    const enCursoAhora = vigentes.find(h => calcularInicioTurno(h) <= ahora && calcularFinTurno(h) > ahora);
    return enCursoAhora || vigentes.find(h => calcularInicioTurno(h) > ahora) || vigentes[0] || null;
}

// Estado calculado en base a hora real (UTC), útil para pintar el widget "Conectarse".
// Nunca conecta a nadie: es solo lectura.
export async function obtenerEstadoConexion(idRepartidor) {
    const [[repartidor]] = await conmysql.query(
        `SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1`,
        [idRepartidor]
    );
    if (!repartidor) throw Object.assign(new Error("El repartidor no existe"), { codigo: "NO_EXISTE" });
    const idEstadoActual = Number(repartidor.id_estado_repartidor);

    const [horarios] = await conmysql.query(
        `SELECT hr.id_reserva, hd.horario_fecha, hd.horario_hora_inicio, hd.horario_hora_fin
         FROM horario_reservas hr
         INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1 AND hd.horario_fecha = CURDATE()
         ORDER BY hd.horario_hora_inicio ASC`,
        [idRepartidor]
    );

    const ahora = new Date();
    const vigentes = horarios.filter(h => calcularFinTurno(h) > ahora);

    if (!vigentes.length) {
        return { tieneHorario: false, enCurso: false, minutosParaInicio: null, puedeConectarse: false, id_estado_repartidor: idEstadoActual };
    }

    const horario = elegirHorarioRelevante(vigentes, ahora);
    const inicioTurno = calcularInicioTurno(horario);
    const finTurno = calcularFinTurno(horario);
    const minutosParaInicio = (inicioTurno.getTime() - ahora.getTime()) / 60000;
    const enCurso = inicioTurno <= ahora && finTurno > ahora;
    // Solo tiene sentido "conectarse" si sigue DESCONECTADO. Si ya está LISTO/REPARTIENDO, el frontend oculta el widget.
    const puedeConectarse = idEstadoActual === ESTADO_REPARTIDOR.DESCONECTADO && (enCurso || minutosParaInicio <= MINUTOS_ANTICIPACION_MINIMA);

    return {
        tieneHorario: true,
        enCurso,
        idReserva: horario.id_reserva,
        horaInicio: inicioTurno.toISOString(),
        horaFin: finTurno.toISOString(),
        minutosParaInicio: Math.round(minutosParaInicio),
        puedeConectarse,
        id_estado_repartidor: idEstadoActual
    };
}

// ÚNICO punto donde un repartidor pasa de DESCONECTADO a LISTO/REPARTIENDO.
// Se ejecuta EXCLUSIVAMENTE cuando el repartidor pulsa "Conectarse" (acción explícita, opcional).
export async function conectarRepartidor(idRepartidor) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();

        const [[repartidor]] = await conn.query(
            `SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? FOR UPDATE`,
            [idRepartidor]
        );
        if (!repartidor) throw Object.assign(new Error("El repartidor no existe"), { codigo: "NO_EXISTE" });
        if (Number(repartidor.id_estado_repartidor) !== ESTADO_REPARTIDOR.DESCONECTADO) {
            throw Object.assign(new Error("Solo puedes conectarte estando DESCONECTADO."), { codigo: "ESTADO_INVALIDO" });
        }

        const [horarios] = await conn.query(
            `SELECT hr.id_reserva, hd.horario_fecha, hd.horario_hora_inicio, hd.horario_hora_fin
             FROM horario_reservas hr
             INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
             WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1 AND hd.horario_fecha = CURDATE()
             ORDER BY hd.horario_hora_inicio ASC FOR UPDATE`,
            [idRepartidor]
        );

        const ahora = new Date();
        const vigentes = horarios.filter(h => calcularFinTurno(h) > ahora);
        if (!vigentes.length) throw Object.assign(new Error("No tienes horarios reservados para hoy."), { codigo: "SIN_HORARIO" });

        const horario = elegirHorarioRelevante(vigentes, ahora);
        const inicioTurno = calcularInicioTurno(horario);
        const finTurno = calcularFinTurno(horario);
        const minutosParaInicio = (inicioTurno.getTime() - ahora.getTime()) / 60000;
        const enCurso = inicioTurno <= ahora && finTurno > ahora;

        if (!enCurso && minutosParaInicio > MINUTOS_ANTICIPACION_MINIMA) {
            throw Object.assign(
                new Error(`Todavía no puedes conectarte. Podrás hacerlo desde ${MINUTOS_ANTICIPACION_MINIMA} minutos antes de tu horario.`),
                { codigo: "MUY_PRONTO" }
            );
        }

        const nuevoEstado = enCurso ? ESTADO_REPARTIDOR.REPARTIENDO : ESTADO_REPARTIDOR.LISTO;
        await conn.query(`UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?`, [nuevoEstado, idRepartidor]);
        await conn.commit();

        return { conectado: true, id_estado_repartidor: nuevoEstado, id_reserva: horario.id_reserva };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Job periódico: SOLO avanza a quien ya eligió conectarse (LISTO) y su turno ya empezó.
// Jamás conecta a alguien DESCONECTADO — respeta que conectarse es opcional.
export async function activarTurnosIniciados() {
    const [resultado] = await conmysql.query(
        `UPDATE repartidores r
         INNER JOIN horario_reservas hr ON hr.id_repartidor = r.id_repartidor AND hr.reserva_estado = 1
         INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         SET r.id_estado_repartidor = ${ESTADO_REPARTIDOR.REPARTIENDO}
         WHERE r.id_estado_repartidor = ${ESTADO_REPARTIDOR.LISTO}
           AND hd.horario_fecha = CURDATE()
           AND CURTIME() >= hd.horario_hora_inicio
           AND CURTIME() < hd.horario_hora_fin`
    );
    return resultado.affectedRows;
}
