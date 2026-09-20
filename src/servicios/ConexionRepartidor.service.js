import { conmysql } from "../db.js";
import { instanteUtcDesdeHoraEcuador } from "../utils/horarioTiempo.js";

const ESTADO_REPARTIDOR = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5, INHABILITADO: 6 };
const MINUTOS_ANTICIPACION_MINIMA = 15;

function partesFecha(horarioFecha) {
    return typeof horarioFecha === "string"
        ? horarioFecha.slice(0, 10)
        : `${horarioFecha.getFullYear()}-${String(horarioFecha.getMonth() + 1).padStart(2, "0")}-${String(horarioFecha.getDate()).padStart(2, "0")}`;
}

function combinarFechaHora(horarioFecha, horaTexto) {
    const [anio, mes, dia] = partesFecha(horarioFecha).split("-").map(Number);
    const [hora, minuto, segundo = 0] = String(horaTexto).split(":").map(Number);
    return new Date(anio, mes - 1, dia, hora, minuto, segundo);
}

/* const calcularInicioTurno = h => combinarFechaHora(h.horario_fecha, h.horario_hora_inicio);
const calcularFinTurno = h => combinarFechaHora(h.horario_fecha, h.horario_hora_fin); */
const calcularInicioTurno = h => instanteUtcDesdeHoraEcuador(h.horario_fecha, h.horario_hora_inicio);
const calcularFinTurno = h => instanteUtcDesdeHoraEcuador(h.horario_fecha, h.horario_hora_fin);

async function obtenerHorariosVigentesHoy(conn, idRepartidor) {
    const [horarios] = await conn.query(
        `SELECT hr.id_reserva, hd.horario_fecha, hd.horario_hora_inicio, hd.horario_hora_fin
         FROM horario_reservas hr
         INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1 AND hd.horario_fecha = CURDATE()
         ORDER BY hd.horario_hora_inicio ASC`,
        [idRepartidor]
    );
    const ahora = new Date();
    return horarios.filter(h => calcularFinTurno(h) > ahora);
}

function elegirHorarioRelevante(vigentes, ahora) {
    const enCursoAhora = vigentes.find(h => calcularInicioTurno(h) <= ahora && calcularFinTurno(h) > ahora);
    return enCursoAhora || vigentes.find(h => calcularInicioTurno(h) > ahora) || vigentes[0] || null;
}

// Estado calculado con hora del servidor, para pintar el widget "Conectarse".
export async function obtenerEstadoConexion(idRepartidor) {
    const [[repartidor]] = await conmysql.query(
        `SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1`,
        [idRepartidor]
    );
    if (!repartidor) throw Object.assign(new Error("El repartidor no existe"), { codigo: "NO_EXISTE" });
    const idEstadoActual = Number(repartidor.id_estado_repartidor);

    const vigentes = await obtenerHorariosVigentesHoy(conmysql, idRepartidor);
    if (!vigentes.length) {
        return { tieneHorario: false, enCurso: false, minutosParaInicio: null, puedeConectarse: false, id_estado_repartidor: idEstadoActual };
    }

    const ahora = new Date();
    const horario = elegirHorarioRelevante(vigentes, ahora);
    const inicioTurno = calcularInicioTurno(horario);
    const finTurno = calcularFinTurno(horario);
    const minutosParaInicio = (inicioTurno.getTime() - ahora.getTime()) / 60000;
    const enCurso = inicioTurno <= ahora && finTurno > ahora;
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

// Ejecuta la conexión: valida todo de nuevo contra el servidor antes de escribir en BD.
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

// Job periódico: pasa de LISTO a REPARTIENDO en cuanto empieza el turno reservado, sin que el repartidor haga nada.
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
