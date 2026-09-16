const pool = require('../config/db');
const { haySolapamiento } = require('./Reservas.service');

/**
 * El dueño de una reserva la pone a disposición. A diferencia de "soltar
 * horas", el turno NO se libera todavía: sigue siendo suyo hasta que el
 * intercambio se concrete (por eso pasa a estado 5 = EN_INTERCAMBIO).
 */
async function ofrecerIntercambio(idReserva, idRepartidor) {
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

        const [resultado] = await conn.query(
            `INSERT INTO horario_intercambios (id_reserva_ofrecida, id_repartidor_ofrece, intercambio_estado)
       VALUES (?, ?, 1)`,
            [idReserva, idRepartidor]
        );
        await conn.query('UPDATE horario_reservas SET reserva_estado = 5 WHERE id_reserva = ?', [idReserva]);

        await conn.commit();
        return { id_intercambio: resultado.insertId };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function listarOfertasDisponibles() {
    const [rows] = await pool.query(
        `SELECT hi.id_intercambio, hi.id_reserva_ofrecida, hi.id_repartidor_ofrece,
            hd.horario_fecha, hd.horario_hora_inicio, hd.horario_hora_fin
     FROM horario_intercambios hi
     JOIN horario_reservas hr ON hr.id_reserva = hi.id_reserva_ofrecida
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hi.intercambio_estado = 1
     ORDER BY hd.horario_fecha, hd.horario_hora_inicio`
    );
    return rows;
}

/**
 * Un repartidor propone su propia reserva a cambio de la ofrecida.
 * Queda pendiente hasta que el oferente original la acepte o la rechace.
 */
async function solicitarIntercambio(idIntercambio, idReservaPropia, idRepartidorSolicitante) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[intercambio]] = await conn.query('SELECT * FROM horario_intercambios WHERE id_intercambio = ? FOR UPDATE', [idIntercambio]);
        if (!intercambio || intercambio.intercambio_estado !== 1) {
            throw Object.assign(new Error('Esta oferta ya no está disponible'), { codigo: 'NO_DISPONIBLE' });
        }

        const [[reservaPropia]] = await conn.query('SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE', [idReservaPropia]);
        if (!reservaPropia || reservaPropia.id_repartidor !== idRepartidorSolicitante || reservaPropia.reserva_estado !== 1) {
            throw Object.assign(new Error('Esa reserva no es válida para el intercambio'), { codigo: 'RESERVA_INVALIDA' });
        }

        await conn.query(
            `UPDATE horario_intercambios
       SET id_reserva_solicitante = ?, id_repartidor_solicitante = ?, intercambio_estado = 2
       WHERE id_intercambio = ?`,
            [idReservaPropia, idRepartidorSolicitante, idIntercambio]
        );
        await conn.query('UPDATE horario_reservas SET reserva_estado = 5 WHERE id_reserva = ?', [idReservaPropia]);

        await conn.commit();
        return { estado: 'propuesta_pendiente' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * El dueño original acepta: se cambian los dueños de ambas reservas,
 * validando que a ninguno de los dos le choque el turno que va a recibir.
 */
async function aceptarIntercambio(idIntercambio, idRepartidorOfrece) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[intercambio]] = await conn.query('SELECT * FROM horario_intercambios WHERE id_intercambio = ? FOR UPDATE', [idIntercambio]);
        if (!intercambio || intercambio.id_repartidor_ofrece !== idRepartidorOfrece || intercambio.intercambio_estado !== 2) {
            throw Object.assign(new Error('No hay una propuesta pendiente para aceptar'), { codigo: 'ESTADO_INVALIDO' });
        }

        const [[reservaA]] = await conn.query('SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE', [intercambio.id_reserva_ofrecida]);
        const [[reservaB]] = await conn.query('SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE', [intercambio.id_reserva_solicitante]);
        const [[horarioA]] = await conn.query('SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ?', [reservaA.id_horario_disponible]);
        const [[horarioB]] = await conn.query('SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ?', [reservaB.id_horario_disponible]);

        if (await haySolapamiento(conn, reservaB.id_repartidor, horarioA, reservaB.id_reserva)) {
            throw Object.assign(new Error('El turno ofrecido choca con otro horario del solicitante'), { codigo: 'CHOQUE_HORARIO' });
        }
        if (await haySolapamiento(conn, reservaA.id_repartidor, horarioB, reservaA.id_reserva)) {
            throw Object.assign(new Error('El turno propio choca con otro de tus horarios'), { codigo: 'CHOQUE_HORARIO' });
        }

        await conn.query('UPDATE horario_reservas SET reserva_estado = 1, id_repartidor = ? WHERE id_reserva = ?', [reservaB.id_repartidor, reservaA.id_reserva]);
        await conn.query('UPDATE horario_reservas SET reserva_estado = 1, id_repartidor = ? WHERE id_reserva = ?', [reservaA.id_repartidor, reservaB.id_reserva]);
        await conn.query('UPDATE horario_intercambios SET intercambio_estado = 3, fecha_resolucion = NOW() WHERE id_intercambio = ?', [idIntercambio]);

        await conn.commit();
        return { estado: 'aceptado' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function rechazarIntercambio(idIntercambio, idRepartidorOfrece) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[intercambio]] = await conn.query('SELECT * FROM horario_intercambios WHERE id_intercambio = ? FOR UPDATE', [idIntercambio]);
        if (!intercambio || intercambio.id_repartidor_ofrece !== idRepartidorOfrece) {
            throw Object.assign(new Error('No autorizado'), { codigo: 'NO_AUTORIZADO' });
        }

        if (intercambio.id_reserva_solicitante) {
            await conn.query('UPDATE horario_reservas SET reserva_estado = 1 WHERE id_reserva = ?', [intercambio.id_reserva_solicitante]);
        }
        await conn.query(
            `UPDATE horario_intercambios SET intercambio_estado = 1, id_reserva_solicitante = NULL, id_repartidor_solicitante = NULL
       WHERE id_intercambio = ?`,
            [idIntercambio]
        );

        await conn.commit();
        return { estado: 'rechazado_vuelve_a_oferta' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { ofrecerIntercambio, listarOfertasDisponibles, solicitarIntercambio, aceptarIntercambio, rechazarIntercambio };