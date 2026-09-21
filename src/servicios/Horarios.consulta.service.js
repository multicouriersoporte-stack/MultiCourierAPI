/* import { conmysql } from "../db.js";

export async function obtenerMisReservasActivas(idRepartidor) {
    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.*
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1
       AND TIMESTAMP(hd.horario_fecha, hd.horario_hora_fin) > NOW()
     ORDER BY hd.horario_fecha, hd.horario_hora_inicio`,
        [idRepartidor]
    );
    return rows;
}

export async function obtenerDisponiblesPorFecha(fecha) {
    const [rows] = await conmysql.query(
        `SELECT * FROM horarios_disponibles
     WHERE horario_fecha = ? AND horario_estado = 1
       AND TIMESTAMP(horario_fecha, horario_hora_fin) > NOW()
     ORDER BY horario_hora_inicio`,
        [fecha]
    );
    return rows;
}

export async function obtenerMisHorasPorFecha(idRepartidor, fecha) {
    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.*
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE hr.id_repartidor = ? AND hd.horario_fecha = ? AND hr.reserva_estado IN (1, 5)
       AND TIMESTAMP(hd.horario_fecha, hd.horario_hora_fin) > NOW()
     ORDER BY hd.horario_hora_inicio`,
        [idRepartidor, fecha]
    );
    return rows;
}

export async function obtenerHistorial(idRepartidor, { desde, hasta } = {}) {
    const condiciones = ["hr.id_repartidor = ?", "hr.reserva_estado IN (2, 4)"];
    const params = [idRepartidor];
    if (desde) {
        condiciones.push("hd.horario_fecha >= ?");
        params.push(desde);
    }
    if (hasta) {
        condiciones.push("hd.horario_fecha <= ?");
        params.push(hasta);
    }

    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.*
     FROM horario_reservas hr
     JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
     WHERE ${condiciones.join(" AND ")}
     ORDER BY hd.horario_fecha DESC, hd.horario_hora_inicio`,
        params
    );
    return rows;
}
 */


import { conmysql } from "../db.js";

// Obtiene las reservas activas y cuyo horario aún no termina.
export async function obtenerMisReservasActivas(idRepartidor) {
    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.* FROM horario_reservas hr
         JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1
         AND TIMESTAMP(hd.horario_fecha, hd.horario_hora_fin) > NOW()
         ORDER BY hd.horario_fecha, hd.horario_hora_inicio`,
        [idRepartidor]
    );
    return rows;
}

// Obtiene los horarios disponibles de una fecha que aún no han terminado.
export async function obtenerDisponiblesPorFecha(fecha) {
    const [rows] = await conmysql.query(
        `SELECT * FROM horarios_disponibles
         WHERE horario_fecha = ? AND horario_estado = 1
         AND TIMESTAMP(horario_fecha, horario_hora_fin) > NOW()
         ORDER BY horario_hora_inicio`,
        [fecha]
    );
    return rows;
}

// Obtiene las horas del repartidor para una fecha, incluyendo estados 1 y 5.
/* export async function obtenerMisHorasPorFecha(idRepartidor, fecha) {
    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.* FROM horario_reservas hr
         JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.id_repartidor = ? AND hd.horario_fecha = ? AND hr.reserva_estado IN (1, 5)
         AND TIMESTAMP(hd.horario_fecha, hd.horario_hora_fin) > NOW()
         ORDER BY hd.horario_hora_inicio`,
        [idRepartidor, fecha]
    );
    return rows;
} */
export async function obtenerMisHorasPorFecha(idRepartidor, fecha) {
    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.*
         FROM horario_reservas hr
         JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE hr.id_repartidor = ?
           AND hd.horario_fecha = ?
           AND hr.reserva_estado IN (1, 5)          -- estados que siguen siendo "tuyos"
           AND CONCAT(hd.horario_fecha, ' ', hd.horario_hora_fin) > NOW()
         ORDER BY hd.horario_hora_inicio`,
        [idRepartidor, fecha]
    );
    return rows;
}

// Devuelve el lunes de la semana anterior como fecha inicial predeterminada.
function inicioSemanaAnterior() {
    const hoy = new Date(), dia = hoy.getDay();
    const diasDesdeLunes = dia === 0 ? 6 : dia - 1;
    const lunesActual = new Date(hoy);
    lunesActual.setDate(hoy.getDate() - diasDesdeLunes - 7);
    return lunesActual.toISOString().slice(0, 10);
}

// Obtiene el historial desde "desde" o, por defecto, desde el lunes de la semana anterior.
export async function obtenerHistorial(idRepartidor, { desde, hasta } = {}) {
    const condiciones = ["hr.id_repartidor = ?", "hr.reserva_estado IN (2, 4, 6)"];
    const params = [idRepartidor];
    condiciones.push("hd.horario_fecha >= ?");
    params.push(desde || inicioSemanaAnterior());
    if (hasta) { condiciones.push("hd.horario_fecha <= ?"); params.push(hasta); }

    const [rows] = await conmysql.query(
        `SELECT hr.id_reserva, hr.reserva_estado, hd.* FROM horario_reservas hr
         JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
         WHERE ${condiciones.join(" AND ")}
         ORDER BY hd.horario_fecha DESC, hd.horario_hora_inicio`,
        params
    );
    return rows;
}
