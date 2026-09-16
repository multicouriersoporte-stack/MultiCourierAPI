const pool = require('../config/db');

async function obtenerDisponiblesPorFecha(fecha) {
    const [rows] = await pool.query(
        `SELECT * FROM horarios_disponibles
     WHERE horario_fecha = ? AND horario_estado = 1
     ORDER BY horario_hora_inicio`,
        [fecha]
    );
    return rows;
}

async function obtenerMisHorasPorFecha(idRepartidor, fecha) {
    const [rows] = await pool.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.*
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hr.id_repartidor = ? AND hd.horario_fecha = ? AND hr.reserva_estado IN (1, 5)
     ORDER BY hd.horario_hora_inicio`,
        [idRepartidor, fecha]
    );
    return rows;
}

async function obtenerHistorial(idRepartidor, { desde, hasta } = {}) {
    const condiciones = ['hr.id_repartidor = ?', 'hr.reserva_estado IN (2, 4)'];
    const params = [idRepartidor];
    if (desde) { condiciones.push('hd.horario_fecha >= ?'); params.push(desde); }
    if (hasta) { condiciones.push('hd.horario_fecha <= ?'); params.push(hasta); }

    const [rows] = await pool.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.*
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE ${condiciones.join(' AND ')}
     ORDER BY hd.horario_fecha DESC, hd.horario_hora_inicio`,
        params
    );
    return rows;
}

module.exports = { obtenerDisponiblesPorFecha, obtenerMisHorasPorFecha, obtenerHistorial };