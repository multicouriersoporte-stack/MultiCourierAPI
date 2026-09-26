/* import { conmysql } from "../db.js";

// Ventana para agrupar solicitudes casi simultáneas.
const VENTANA_RESOLUCION_MS = 800;
const timersPorHorario = new Map();
const MINUTOS_ANTICIPACION_MINIMA = 15;

// Calcula las horas acumuladas de las reservas activas de los repartidores.
async function calcularHorasAcumuladas(conn, idsRepartidores) {
    if (idsRepartidores.length === 0) return new Map();

    const [rows] = await conn.query(
        `SELECT hr.id_repartidor,
            COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(hd.horario_hora_fin, hd.horario_hora_inicio))) / 3600, 0) AS horas
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hr.reserva_estado = 1 AND hr.id_repartidor IN (?)
     GROUP BY hr.id_repartidor`,
        [idsRepartidores]
    );

    return new Map(rows.map((r) => [r.id_repartidor, Number(r.horas)]));
}

// Comprueba si el repartidor ya tiene un turno que se solapa con el candidato.
export async function haySolapamiento(conn, idRepartidor, horarioCandidato, excluirIdReserva = null) {
    const params = [
        idRepartidor,
        horarioCandidato.horario_fecha,
        horarioCandidato.horario_hora_inicio,
        horarioCandidato.horario_hora_fin,
    ];
    let filtroExclusion = "";

    if (excluirIdReserva) {
        filtroExclusion = "AND hr.id_reserva != ?";
        params.push(excluirIdReserva);
    }

    const [rows] = await conn.query(
        `SELECT hr.id_reserva
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1
       AND hd.horario_fecha = ?
       AND NOT (hd.horario_hora_fin <= ? OR hd.horario_hora_inicio >= ?)
       ${filtroExclusion}`,
        params
    );

    return rows.length > 0;
}

// Registra la solicitud y la deja pendiente para resolverla por prioridad.
function calcularInicioTurno(horario) {
    const fecha = new Date(horario.horario_fecha).toISOString().slice(0, 10);
    return new Date(`${fecha}T${horario.horario_hora_inicio}`);
}

export async function solicitarReserva(idHorarioDisponible, idRepartidor) {
    const conn = await conmysql.getConnection();
    let idSolicitud;

    try {
        await conn.beginTransaction();

        const [[horario]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE`,
            [idHorarioDisponible]
        );

        if (!horario)
            throw Object.assign(new Error("El horario no existe"), { codigo: "NO_EXISTE" });

        if (horario.horario_estado !== 1)
            throw Object.assign(new Error("El horario ya no está disponible"), { codigo: "NO_DISPONIBLE" });

        const minutosParaInicio = (calcularInicioTurno(horario) - new Date()) / 60000;

        if (minutosParaInicio <= 0)
            throw Object.assign(new Error("Este turno ya comenzó"), { codigo: "TURNO_EN_CURSO" });

        if (minutosParaInicio < MINUTOS_ANTICIPACION_MINIMA)
            throw Object.assign(
                new Error(`Debes solicitar este turno con al menos ${MINUTOS_ANTICIPACION_MINIMA} minutos de anticipación`),
                { codigo: "TURNO_MUY_PRONTO" }
            );

        if (await haySolapamiento(conn, idRepartidor, horario))
            throw Object.assign(new Error("Ya tienes un turno que choca con este horario"), { codigo: "CHOQUE_HORARIO" });

        const [resultado] = await conn.query(
            `INSERT INTO horario_solicitudes_reserva (id_horario_disponible, id_repartidor, solicitud_estado)
       VALUES (?, ?, 1)`,
            [idHorarioDisponible, idRepartidor]
        );

        idSolicitud = resultado.insertId;
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }

    programarResolucion(idHorarioDisponible);
    return { id_solicitud: idSolicitud, estado: "pendiente" };
}

// Programa una única resolución para cada turno.
function programarResolucion(idHorarioDisponible) {
    if (timersPorHorario.has(idHorarioDisponible)) return;

    const timer = setTimeout(() => {
        timersPorHorario.delete(idHorarioDisponible);
        resolverSolicitudes(idHorarioDisponible).catch((error) =>
            console.error("Error resolviendo solicitudes del horario", idHorarioDisponible, error)
        );
    }, VENTANA_RESOLUCION_MS);

    timersPorHorario.set(idHorarioDisponible, timer);
}

// Resuelve por menos horas acumuladas y, en empate, por antigüedad de solicitud.
async function resolverSolicitudes(idHorarioDisponible) {
    const conn = await conmysql.getConnection();

    try {
        await conn.beginTransaction();

        const [[horario]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE`,
            [idHorarioDisponible]
        );

        if (!horario) {
            await conn.rollback();
            return;
        }

        const [solicitudes] = await conn.query(
            `SELECT id_solicitud, id_repartidor, solicitud_fecha
       FROM horario_solicitudes_reserva
       WHERE id_horario_disponible = ? AND solicitud_estado = 1
       ORDER BY solicitud_fecha ASC`,
            [idHorarioDisponible]
        );

        if (solicitudes.length === 0) {
            await conn.commit();
            return;
        }

        const horasMap = await calcularHorasAcumuladas(
            conn,
            solicitudes.map((s) => s.id_repartidor)
        );

        solicitudes.sort((a, b) => {
            const horasA = horasMap.get(a.id_repartidor) || 0;
            const horasB = horasMap.get(b.id_repartidor) || 0;
            if (horasA !== horasB) return horasA - horasB;
            return new Date(a.solicitud_fecha) - new Date(b.solicitud_fecha);
        });

        let cuposDisponibles = horario.horario_cupos_disponibles;

        for (const solicitud of solicitudes) {
            // Sin cupos: solicitud rechazada.
            if (cuposDisponibles <= 0) {
                await conn.query(
                    `UPDATE horario_solicitudes_reserva SET solicitud_estado = 3 WHERE id_solicitud = ?`,
                    [solicitud.id_solicitud]
                );
                continue;
            }

            // Se vuelve a comprobar el solapamiento antes de asignar.
            if (await haySolapamiento(conn, solicitud.id_repartidor, horario)) {
                await conn.query(
                    `UPDATE horario_solicitudes_reserva SET solicitud_estado = 4 WHERE id_solicitud = ?`,
                    [solicitud.id_solicitud]
                );
                continue;
            }

            await conn.query(
                `INSERT INTO horario_reservas (id_horario_disponible, id_repartidor, reserva_estado)
         VALUES (?, ?, 1)`,
                [idHorarioDisponible, solicitud.id_repartidor]
            );

            await conn.query(
                `UPDATE horario_solicitudes_reserva SET solicitud_estado = 2 WHERE id_solicitud = ?`,
                [solicitud.id_solicitud]
            );

            cuposDisponibles--;
        }

        // Actualiza los cupos y el estado del turno.
        await conn.query(
            `UPDATE horarios_disponibles
       SET horario_cupos_disponibles = ?, horario_estado = ?
       WHERE id_horario_disponible = ?`,
            [cuposDisponibles, cuposDisponibles === 0 ? 2 : 1, idHorarioDisponible]
        );

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Consulta una solicitud por su ID.
export async function consultarSolicitud(idSolicitud) {
    const [[solicitud]] = await conmysql.query(
        `SELECT * FROM horario_solicitudes_reserva WHERE id_solicitud = ?`,
        [idSolicitud]
    );
    return solicitud || null;
}

// Libera una reserva antes de que comience el turno y devuelve el cupo.
export async function soltarHoras(idReserva, idRepartidor) {
    const conn = await conmysql.getConnection();

    try {
        await conn.beginTransaction();

        const [[reserva]] = await conn.query(
            `SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE`,
            [idReserva]
        );

        if (! || .id_repartidor !== idRepartidor)
            throw Object.assign(new Error("La  no existe o no te pertenece"), { codigo: "NO_AUTORIZADO" });

        if (reserva.reserva_estado !== 1)
            throw Object.assign(new Error("Esta reserva ya no está activa"), { codigo: "ESTADO_INVALIDO" });

        const [[horario]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE`,
            [reserva.id_horario_disponible]
        );

        if (!horario)
            throw Object.assign(new Error("El horario no existe"), { codigo: "NO_EXISTE" });

        const fecha = new Date(horario.horario_fecha).toISOString().slice(0, 10);
        const inicioTurno = new Date(`${fecha}T${horario.horario_hora_inicio}`);

        if (new Date() >= inicioTurno)
            throw Object.assign(new Error("No puedes soltar un turno que ya empezó"), { codigo: "TURNO_EN_CURSO" });

        await conn.query(
            `UPDATE horario_reservas
       SET reserva_estado = 2, reserva_fecha_liberacion = NOW()
       WHERE id_reserva = ?`,
            [idReserva]
        );

        await conn.query(
            `UPDATE horarios_disponibles
       SET horario_cupos_disponibles = horario_cupos_disponibles + 1, horario_estado = 1
       WHERE id_horario_disponible = ?`,
            [reserva.id_horario_disponible]
        );

        await conn.commit();
        return { liberado: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}
 */


import { conmysql } from "../db.js";
//import { instanteUtcDesdeHoraEcuador } from "../utils/horarioTiempo.js";
import { instanteUtcDesdeHoraEcuador, OFFSET_ECUADOR_HORAS } from "../utils/horarioTiempo.js";

// Configuración de solicitudes.
const VENTANA_RESOLUCION_MS = 800;
const MINUTOS_ANTICIPACION_MINIMA = 15;
const timersPorHorario = new Map();

// Construye el inicio del turno usando la hora local del servidor, sin conversión UTC.
/* function calcularInicioTurno(horario) {
    const fecha = typeof horario.horario_fecha === "string"
        ? horario.horario_fecha.slice(0, 10)
        : `${horario.horario_fecha.getFullYear()}-${String(horario.horario_fecha.getMonth() + 1).padStart(2, "0")}-${String(horario.horario_fecha.getDate()).padStart(2, "0")}`;
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const [hora, minuto, segundo = 0] = String(horario.horario_hora_inicio).split(":").map(Number);
    return new Date(anio, mes - 1, dia, hora, minuto, segundo);
} */
function calcularInicioTurno(horario) {
    return instanteUtcDesdeHoraEcuador(horario.horario_fecha, horario.horario_hora_inicio);
}

// Calcula las horas acumuladas de las reservas activas.
async function calcularHorasAcumuladas(conn, idsRepartidores) {
    if (idsRepartidores.length === 0) return new Map();
    const [rows] = await conn.query(
        `SELECT hr.id_repartidor, COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(hd.horario_hora_fin, hd.horario_hora_inicio))) / 3600, 0) AS horas
         FROM horario_reservas hr JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.reserva_estado = 1 AND hr.id_repartidor IN (?) GROUP BY hr.id_repartidor`,
        [idsRepartidores]
    );
    return new Map(rows.map(r => [r.id_repartidor, Number(r.horas)]));
}

// Comprueba si el repartidor tiene otro turno que se solape.
export async function haySolapamiento(conn, idRepartidor, horarioCandidato, excluirIdReserva = null) {
    const params = [idRepartidor, horarioCandidato.horario_fecha, horarioCandidato.horario_hora_inicio, horarioCandidato.horario_hora_fin];
    let filtroExclusion = "";
    if (excluirIdReserva) {
        filtroExclusion = "AND hr.id_reserva != ?";
        params.push(excluirIdReserva);
    }
    const [rows] = await conn.query(
        `SELECT hr.id_reserva FROM horario_reservas hr JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1 AND hd.horario_fecha = ?
         AND NOT (hd.horario_hora_fin <= ? OR hd.horario_hora_inicio >= ?) ${filtroExclusion}`,
        params
    );
    return rows.length > 0;
}

// Registra la solicitud y la deja pendiente para resolverla por prioridad.
export async function solicitarReserva(idHorarioDisponible, idRepartidor) {
    const conn = await conmysql.getConnection();
    let idSolicitud;
    try {
        await conn.beginTransaction();
        const [[horario]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE`,
            [idHorarioDisponible]
        );
        if (!horario) throw Object.assign(new Error("El horario no existe"), { codigo: "NO_EXISTE" });
        if (horario.horario_estado !== 1) throw Object.assign(new Error("El horario ya no está disponible"), { codigo: "NO_DISPONIBLE" });

        const minutosParaInicio = (calcularInicioTurno(horario) - new Date()) / 60000;
        if (minutosParaInicio <= 0) throw Object.assign(new Error("Este turno ya comenzó"), { codigo: "TURNO_EN_CURSO" });
        if (minutosParaInicio < MINUTOS_ANTICIPACION_MINIMA) {
            throw Object.assign(new Error(`Debes solicitar este turno con al menos ${MINUTOS_ANTICIPACION_MINIMA} minutos de anticipación`), { codigo: "TURNO_MUY_PRONTO" });
        }
        if (await haySolapamiento(conn, idRepartidor, horario)) {
            throw Object.assign(new Error("Ya tienes un turno que choca con este horario"), { codigo: "CHOQUE_HORARIO" });
        }

        const [resultado] = await conn.query(
            `INSERT INTO horario_solicitudes_reserva (id_horario_disponible, id_repartidor, solicitud_estado) VALUES (?, ?, 1)`,
            [idHorarioDisponible, idRepartidor]
        );
        idSolicitud = resultado.insertId;
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
    programarResolucion(idHorarioDisponible);
    return { id_solicitud: idSolicitud, estado: "pendiente" };
}

// Programa una única resolución para cada horario.
function programarResolucion(idHorarioDisponible) {
    if (timersPorHorario.has(idHorarioDisponible)) return;
    const timer = setTimeout(() => {
        timersPorHorario.delete(idHorarioDisponible);
        resolverSolicitudes(idHorarioDisponible).catch(error =>
            console.error("Error resolviendo solicitudes del horario", idHorarioDisponible, error)
        );
    }, VENTANA_RESOLUCION_MS);
    timersPorHorario.set(idHorarioDisponible, timer);
}

// Resuelve solicitudes por menos horas acumuladas y luego por antigüedad.
async function resolverSolicitudes(idHorarioDisponible) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();
        const [[horario]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE`,
            [idHorarioDisponible]
        );
        if (!horario) {
            await conn.rollback();
            return;
        }

        const [solicitudes] = await conn.query(
            `SELECT id_solicitud, id_repartidor, solicitud_fecha FROM horario_solicitudes_reserva
             WHERE id_horario_disponible = ? AND solicitud_estado = 1 ORDER BY solicitud_fecha ASC`,
            [idHorarioDisponible]
        );
        if (solicitudes.length === 0) {
            await conn.commit();
            return;
        }

        const horasMap = await calcularHorasAcumuladas(conn, solicitudes.map(s => s.id_repartidor));
        solicitudes.sort((a, b) => {
            const horasA = horasMap.get(a.id_repartidor) || 0;
            const horasB = horasMap.get(b.id_repartidor) || 0;
            if (horasA !== horasB) return horasA - horasB;
            return new Date(a.solicitud_fecha) - new Date(b.solicitud_fecha);
        });

        let cuposDisponibles = horario.horario_cupos_disponibles;
        for (const solicitud of solicitudes) {
            if (cuposDisponibles <= 0) {
                await conn.query(`UPDATE horario_solicitudes_reserva SET solicitud_estado = 3 WHERE id_solicitud = ?`, [solicitud.id_solicitud]);
                continue;
            }

            // Verificación final para evitar asignar turnos solapados.
            if (await haySolapamiento(conn, solicitud.id_repartidor, horario)) {
                await conn.query(`UPDATE horario_solicitudes_reserva SET solicitud_estado = 4 WHERE id_solicitud = ?`, [solicitud.id_solicitud]);
                continue;
            }

            await conn.query(
                `INSERT INTO horario_reservas (id_horario_disponible, id_repartidor, reserva_estado) VALUES (?, ?, 1)`,
                [idHorarioDisponible, solicitud.id_repartidor]
            );
            await conn.query(
                `UPDATE horario_solicitudes_reserva SET solicitud_estado = 2 WHERE id_solicitud = ?`,
                [solicitud.id_solicitud]
            );
            cuposDisponibles--;
        }

        await conn.query(
            `UPDATE horarios_disponibles SET horario_cupos_disponibles = ?, horario_estado = ? WHERE id_horario_disponible = ?`,
            [cuposDisponibles, cuposDisponibles === 0 ? 2 : 1, idHorarioDisponible]
        );
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Consulta una solicitud por su ID.
export async function consultarSolicitud(idSolicitud) {
    const [[solicitud]] = await conmysql.query(
        `SELECT * FROM horario_solicitudes_reserva WHERE id_solicitud = ?`,
        [idSolicitud]
    );
    return solicitud || null;
}

// Libera una reserva antes de que comience el turno.
export async function soltarHoras(idReserva, idRepartidor) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();

        const [[reserva]] = await conn.query(
            `SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE`,
            [idReserva]
        );
        if (!reserva || reserva.id_repartidor !== idRepartidor) {
            throw Object.assign(new Error("La reserva no existe o no te pertenece"), { codigo: "NO_AUTORIZADO" });
        }
        if (reserva.reserva_estado !== 1) {
            throw Object.assign(new Error("Esta reserva ya no está activa"), { codigo: "ESTADO_INVALIDO" });
        }

        const [[horario]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE`,
            [reserva.id_horario_disponible]
        );
        if (!horario) throw Object.assign(new Error("El horario no existe"), { codigo: "NO_EXISTE" });

        if (new Date() >= calcularInicioTurno(horario)) {
            throw Object.assign(new Error("No puedes soltar un turno que ya empezó"), { codigo: "TURNO_EN_CURSO" });
        }

        await conn.query(
            `UPDATE horario_reservas SET reserva_estado = 2, reserva_fecha_liberacion = NOW() WHERE id_reserva = ?`,
            [idReserva]
        );
        await conn.query(
            `UPDATE horarios_disponibles SET horario_cupos_disponibles = horario_cupos_disponibles + 1, horario_estado = 1 WHERE id_horario_disponible = ?`,
            [reserva.id_horario_disponible]
        );

        await conn.commit();
        return { liberado: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Pasa a completada (6) cualquier reserva activa cuyo turno ya terminó.
/* export async function finalizarReservasVencidas() {
    const [resultado] = await conmysql.query(
        `UPDATE horario_reservas hr
         JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         SET hr.reserva_estado = 6
         WHERE hr.reserva_estado = 1
           AND TIMESTAMP(hd.horario_fecha, hd.horario_hora_fin) <= NOW()`
    );
    return resultado.affectedRows;
} */
// Pasa a completada (6) cualquier reserva activa cuyo turno ya terminó.
export async function finalizarReservasVencidas() {
    const [resultado] = await conmysql.query(
        `UPDATE horario_reservas hr
         JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         SET hr.reserva_estado = 6
         WHERE hr.reserva_estado = 1
           AND TIMESTAMP(hd.horario_fecha, hd.horario_hora_fin) <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${OFFSET_ECUADOR_HORAS} HOUR)`
    );
    return resultado.affectedRows;
}

