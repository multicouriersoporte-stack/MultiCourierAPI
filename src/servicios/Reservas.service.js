const pool = require('../config/db');

// Ventana en la que se agrupan solicitudes casi simultáneas de un mismo
// turno antes de resolverlas todas juntas por prioridad de horas.
const VENTANA_RESOLUCION_MS = 800;
const timersPorHorario = new Map();

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

/**
 * Chequea choques aunque sea de 5 minutos: dos rangos NO chocan solo si
 * uno termina antes de que el otro empiece (o viceversa).
 */
async function haySolapamiento(conn, idRepartidor, horarioCandidato, excluirIdReserva = null) {
    const params = [
        idRepartidor,
        horarioCandidato.horario_fecha,
        horarioCandidato.horario_hora_inicio,
        horarioCandidato.horario_hora_fin,
    ];
    let filtroExclusion = '';
    if (excluirIdReserva) {
        filtroExclusion = 'AND hr.id_reserva != ?';
        params.push(excluirIdReserva);
    }

    const [rows] = await conn.query(
        `SELECT hr.id_reserva
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hr.id_repartidor = ?
       AND hr.reserva_estado = 1
       AND hd.horario_fecha = ?
       AND NOT (hd.horario_hora_fin <= ? OR hd.horario_hora_inicio >= ?)
       ${filtroExclusion}`,
        params
    );
    return rows.length > 0;
}

/**
 * El repartidor pide un turno. No se asigna al instante: entra a una cola
 * y, tras una ventana corta, se resuelve junto con cualquier otra solicitud
 * que haya llegado casi al mismo tiempo (ver resolverSolicitudes).
 */
async function solicitarReserva(idHorarioDisponible, idRepartidor) {
    const conn = await pool.getConnection();
    let idSolicitud;
    try {
        await conn.beginTransaction();

        const [[horario]] = await conn.query(
            'SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE',
            [idHorarioDisponible]
        );
        if (!horario) throw Object.assign(new Error('El horario no existe'), { codigo: 'NO_EXISTE' });
        if (horario.horario_estado !== 1) {
            throw Object.assign(new Error('El horario ya no está disponible'), { codigo: 'NO_DISPONIBLE' });
        }
        if (await haySolapamiento(conn, idRepartidor, horario)) {
            throw Object.assign(new Error('Ya tienes un turno que choca con este horario'), { codigo: 'CHOQUE_HORARIO' });
        }

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
    return { id_solicitud: idSolicitud, estado: 'pendiente' };
}

function programarResolucion(idHorarioDisponible) {
    if (timersPorHorario.has(idHorarioDisponible)) return; // ya hay una ventana corriendo, la solicitud se sube a esa
    const timer = setTimeout(() => {
        timersPorHorario.delete(idHorarioDisponible);
        resolverSolicitudes(idHorarioDisponible).catch((err) =>
            console.error('Error resolviendo solicitudes del horario', idHorarioDisponible, err)
        );
    }, VENTANA_RESOLUCION_MS);
    timersPorHorario.set(idHorarioDisponible, timer);
}

/**
 * Resuelve TODAS las solicitudes pendientes de un turno de una sola vez:
 * ordena por horas acumuladas (menos horas = más prioridad, luego por
 * orden de llegada) y asigna cupos hasta agotarlos. Esto es lo que
 * garantiza que, si Juan y Pedro piden el último cupo casi a la vez,
 * gane el que tiene menos horas trabajadas — y no una carrera de red.
 *
 * Nota: este enfoque funciona en un solo proceso Node. Si vas a correr
 * varias instancias del backend, mueve `timersPorHorario` a Redis (o similar)
 * para que el debounce sea compartido entre instancias.
 */
async function resolverSolicitudes(idHorarioDisponible) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[horario]] = await conn.query(
            'SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE',
            [idHorarioDisponible]
        );
        if (!horario) { await conn.rollback(); return; }

        const [solicitudes] = await conn.query(
            `SELECT id_solicitud, id_repartidor, solicitud_fecha
       FROM horario_solicitudes_reserva
       WHERE id_horario_disponible = ? AND solicitud_estado = 1
       ORDER BY solicitud_fecha ASC`,
            [idHorarioDisponible]
        );
        if (solicitudes.length === 0) { await conn.commit(); return; }

        const horasMap = await calcularHorasAcumuladas(conn, solicitudes.map((s) => s.id_repartidor));

        solicitudes.sort((a, b) => {
            const ha = horasMap.get(a.id_repartidor) || 0;
            const hb = horasMap.get(b.id_repartidor) || 0;
            if (ha !== hb) return ha - hb; // menos horas acumuladas => más prioridad
            return new Date(a.solicitud_fecha) - new Date(b.solicitud_fecha);
        });

        let cuposDisponibles = horario.horario_cupos_disponibles;

        for (const solicitud of solicitudes) {
            if (cuposDisponibles <= 0) {
                await conn.query('UPDATE horario_solicitudes_reserva SET solicitud_estado = 3 WHERE id_solicitud = ?', [solicitud.id_solicitud]);
                continue; // 3 = rechazada por falta de cupo
            }
            if (await haySolapamiento(conn, solicitud.id_repartidor, horario)) {
                await conn.query('UPDATE horario_solicitudes_reserva SET solicitud_estado = 4 WHERE id_solicitud = ?', [solicitud.id_solicitud]);
                continue; // 4 = rechazada por choque (pudo tomar otro turno mientras esperaba)
            }

            await conn.query(
                `INSERT INTO horario_reservas (id_horario_disponible, id_repartidor, reserva_estado)
         VALUES (?, ?, 1)`,
                [idHorarioDisponible, solicitud.id_repartidor]
            );
            await conn.query('UPDATE horario_solicitudes_reserva SET solicitud_estado = 2 WHERE id_solicitud = ?', [solicitud.id_solicitud]);
            cuposDisponibles -= 1;
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

async function consultarSolicitud(idSolicitud) {
    const [[solicitud]] = await pool.query('SELECT * FROM horario_solicitudes_reserva WHERE id_solicitud = ?', [idSolicitud]);
    return solicitud || null;
}

/**
 * El repartidor libera un turno que ya tenía (solo si aún no empezó).
 * El cupo vuelve a quedar abierto para que cualquiera lo tome de nuevo.
 */
async function soltarHoras(idReserva, idRepartidor) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[reserva]] = await conn.query('SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE', [idReserva]);
        if (!reserva || reserva.id_repartidor !== idRepartidor) {
            throw Object.assign(new Error('La reserva no existe o no te pertenece'), { codigo: 'NO_AUTORIZADO' });
        }
        if (reserva.reserva_estado !== 1) {
            throw Object.assign(new Error('Esta reserva ya no está activa'), { codigo: 'ESTADO_INVALIDO' });
        }

        const [[horario]] = await conn.query(
            'SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ? FOR UPDATE',
            [reserva.id_horario_disponible]
        );

        const inicioTurno = new Date(`${horario.horario_fecha.toISOString().slice(0, 10)}T${horario.horario_hora_inicio}`);
        if (new Date() >= inicioTurno) {
            throw Object.assign(new Error('No puedes soltar un turno que ya empezó'), { codigo: 'TURNO_EN_CURSO' });
        }

        await conn.query('UPDATE horario_reservas SET reserva_estado = 2, reserva_fecha_liberacion = NOW() WHERE id_reserva = ?', [idReserva]);
        await conn.query(
            `UPDATE horarios_disponibles SET horario_cupos_disponibles = horario_cupos_disponibles + 1, horario_estado = 1
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

module.exports = { solicitarReserva, consultarSolicitud, soltarHoras, haySolapamiento };