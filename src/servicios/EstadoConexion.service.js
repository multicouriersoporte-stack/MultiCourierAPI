import { conmysql } from "../db.js";

export const MINUTOS_VENTANA_CONEXION = 15;
const ESTADO_REPARTIDOR = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5, INHABILITADO: 6 };

// Construye la fecha/hora usando la hora local del servidor (sin conversión UTC).
function combinarFechaHora(fecha, hora) {
    const f = typeof fecha === "string"
        ? fecha.slice(0, 10)
        : `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    const [anio, mes, dia] = f.split("-").map(Number);
    const [h, m, s = 0] = String(hora).split(":").map(Number);
    return new Date(anio, mes - 1, dia, h, m, s);
}

async function obtenerReservasHoy(idRepartidor) {
    const [rows] = await conmysql.query(`
        SELECT hr.id_reserva, hd.horario_fecha, hd.horario_hora_inicio, hd.horario_hora_fin
        FROM horario_reservas hr
        INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
        WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1 AND hd.horario_fecha = CURDATE()
        ORDER BY hd.horario_hora_inicio ASC
    `, [idRepartidor]);
    return rows;
}

// Determina si el repartidor está dentro de un horario reservado o cuál es el próximo.
export async function calcularEstadoConexion(idRepartidor) {
    const ahora = new Date();
    const reservas = await obtenerReservasHoy(idRepartidor);

    let enCurso = null;
    let proximo = null;

    for (const r of reservas) {
        const inicio = combinarFechaHora(r.horario_fecha, r.horario_hora_inicio);
        const fin = combinarFechaHora(r.horario_fecha, r.horario_hora_fin);
        if (ahora >= inicio && ahora < fin) { enCurso = { ...r, inicio, fin }; break; }
        if (ahora < inicio && !proximo) proximo = { ...r, inicio, fin };
    }

    if (enCurso) {
        return {
            tieneHorario: true, enCurso: true, idReserva: enCurso.id_reserva,
            horaInicio: enCurso.inicio, horaFin: enCurso.fin,
            puedeConectarse: true, minutosParaInicio: 0
        };
    }

    if (proximo) {
        const minutosParaInicio = Math.round((proximo.inicio.getTime() - ahora.getTime()) / 60000);
        return {
            tieneHorario: true, enCurso: false, idReserva: proximo.id_reserva,
            horaInicio: proximo.inicio, horaFin: proximo.fin,
            minutosParaInicio,
            puedeConectarse: minutosParaInicio <= MINUTOS_VENTANA_CONEXION
        };
    }

    return { tieneHorario: false, enCurso: false, puedeConectarse: false, minutosParaInicio: null };
}

// Conecta al repartidor: LISTO si aún no inicia su turno, REPARTIENDO si ya está dentro de él.
export async function conectarRepartidor(idRepartidor) {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();
        const [[repartidor]] = await conexion.query(
            `SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1 FOR UPDATE`,
            [idRepartidor]
        );
        if (!repartidor) throw Object.assign(new Error("El repartidor no existe"), { codigo: "NO_EXISTE" });
        if (Number(repartidor.id_estado_repartidor) !== ESTADO_REPARTIDOR.DESCONECTADO) {
            throw Object.assign(new Error("Solo puedes conectarte estando DESCONECTADO"), { codigo: "ESTADO_INVALIDO" });
        }

        const info = await calcularEstadoConexion(idRepartidor);
        if (!info.tieneHorario) throw Object.assign(new Error("No tienes horarios reservados para hoy"), { codigo: "SIN_HORARIO" });
        if (!info.puedeConectarse) throw Object.assign(new Error("Todavía no puedes conectarte para tu próximo horario"), { codigo: "FUERA_DE_VENTANA" });

        const nuevoEstado = info.enCurso ? ESTADO_REPARTIDOR.REPARTIENDO : ESTADO_REPARTIDOR.LISTO;
        await conexion.query(`UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?`, [nuevoEstado, idRepartidor]);
        await conexion.commit();
        return { conectado: true, id_estado_repartidor: nuevoEstado };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

// Si está LISTO y ya comenzó su horario, lo sube a REPARTIENDO sin que tenga que reconectarse.
export async function sincronizarListoARepartiendo(idRepartidor) {
    const [[repartidor]] = await conmysql.query(
        `SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1`,
        [idRepartidor]
    );
    if (!repartidor || Number(repartidor.id_estado_repartidor) !== ESTADO_REPARTIDOR.LISTO) return false;

    const info = await calcularEstadoConexion(idRepartidor);
    if (info.tieneHorario && info.enCurso) {
        await conmysql.query(`UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?`, [ESTADO_REPARTIDOR.REPARTIENDO, idRepartidor]);
        return true;
    }
    return false;
}