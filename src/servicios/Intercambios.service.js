import { conmysql } from "../db.js";
import { haySolapamiento } from "./Reservas.service.js";

// Estado 5 = EN_INTERCAMBIO. La reserva sigue perteneciendo al oferente.
export async function ofrecerIntercambio(idReserva, idRepartidor) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();

        const [[reserva]] = await conn.query(
            `SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE`, [idReserva]
        );

        if (!reserva || reserva.id_repartidor !== idRepartidor)
            throw Object.assign(new Error("La reserva no existe o no te pertenece"), { codigo: "NO_AUTORIZADO" });

        if (reserva.reserva_estado !== 1)
            throw Object.assign(new Error("Esta reserva ya no está activa"), { codigo: "ESTADO_INVALIDO" });

        const [resultado] = await conn.query(
            `INSERT INTO horario_intercambios (id_reserva_ofrecida, id_repartidor_ofrece, intercambio_estado) VALUES (?, ?, 1)`,
            [idReserva, idRepartidor]
        );

        await conn.query(
            `UPDATE horario_reservas SET reserva_estado = 5 WHERE id_reserva = ?`, [idReserva]
        );

        await conn.commit();
        return { id_intercambio: resultado.insertId };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Obtiene las ofertas de intercambio disponibles.
export async function listarOfertasDisponibles() {
    const [rows] = await conmysql.query(
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

// El repartidor propone una de sus reservas a cambio de la oferta.
export async function solicitarIntercambio(idIntercambio, idReservaPropia, idRepartidorSolicitante) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();

        const [[intercambio]] = await conn.query(
            `SELECT * FROM horario_intercambios WHERE id_intercambio = ? FOR UPDATE`, [idIntercambio]
        );

        if (!intercambio || intercambio.intercambio_estado !== 1)
            throw Object.assign(new Error("Esta oferta ya no está disponible"), { codigo: "NO_DISPONIBLE" });

        const [[reservaPropia]] = await conn.query(
            `SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE`, [idReservaPropia]
        );

        if (!reservaPropia || reservaPropia.id_repartidor !== idRepartidorSolicitante || reservaPropia.reserva_estado !== 1)
            throw Object.assign(new Error("Esa reserva no es válida para el intercambio"), { codigo: "RESERVA_INVALIDA" });

        // Evita intercambiar una reserva consigo mismo.
        if (intercambio.id_repartidor_ofrece === idRepartidorSolicitante)
            throw Object.assign(new Error("No puedes intercambiar una reserva contigo mismo"), { codigo: "INTERCAMBIO_INVALIDO" });

        await conn.query(
            `UPDATE horario_intercambios
       SET id_reserva_solicitante = ?, id_repartidor_solicitante = ?, intercambio_estado = 2
       WHERE id_intercambio = ?`,
            [idReservaPropia, idRepartidorSolicitante, idIntercambio]
        );

        await conn.query(
            `UPDATE horario_reservas SET reserva_estado = 5 WHERE id_reserva = ?`, [idReservaPropia]
        );

        await conn.commit();
        return { estado: "propuesta_pendiente" };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// El dueño original acepta y se intercambian los propietarios.
export async function aceptarIntercambio(idIntercambio, idRepartidorOfrece) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();

        const [[intercambio]] = await conn.query(
            `SELECT * FROM horario_intercambios WHERE id_intercambio = ? FOR UPDATE`, [idIntercambio]
        );

        if (!intercambio || intercambio.id_repartidor_ofrece !== idRepartidorOfrece || intercambio.intercambio_estado !== 2)
            throw Object.assign(new Error("No hay una propuesta pendiente para aceptar"), { codigo: "ESTADO_INVALIDO" });

        const [[reservaA]] = await conn.query(
            `SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE`, [intercambio.id_reserva_ofrecida]
        );
        const [[reservaB]] = await conn.query(
            `SELECT * FROM horario_reservas WHERE id_reserva = ? FOR UPDATE`, [intercambio.id_reserva_solicitante]
        );

        if (!reservaA || !reservaB)
            throw Object.assign(new Error("No se encontraron las reservas del intercambio"), { codigo: "RESERVAS_NO_ENCONTRADAS" });

        const [[horarioA]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ?`, [reservaA.id_horario_disponible]
        );
        const [[horarioB]] = await conn.query(
            `SELECT * FROM horarios_disponibles WHERE id_horario_disponible = ?`, [reservaB.id_horario_disponible]
        );

        if (!horarioA || !horarioB)
            throw Object.assign(new Error("No se encontraron los horarios del intercambio"), { codigo: "HORARIOS_NO_ENCONTRADOS" });

        // Verifica que cada repartidor pueda recibir el turno sin solapamientos.
        if (await haySolapamiento(conn, reservaB.id_repartidor, horarioA, reservaB.id_reserva))
            throw Object.assign(new Error("El turno ofrecido choca con otro horario del solicitante"), { codigo: "CHOQUE_HORARIO" });

        if (await haySolapamiento(conn, reservaA.id_repartidor, horarioB, reservaA.id_reserva))
            throw Object.assign(new Error("El turno propio choca con otro de tus horarios"), { codigo: "CHOQUE_HORARIO" });

        // Intercambia los propietarios y reactiva ambas reservas.
        await conn.query(
            `UPDATE horario_reservas SET reserva_estado = 1, id_repartidor = ? WHERE id_reserva = ?`,
            [reservaB.id_repartidor, reservaA.id_reserva]
        );
        await conn.query(
            `UPDATE horario_reservas SET reserva_estado = 1, id_repartidor = ? WHERE id_reserva = ?`,
            [reservaA.id_repartidor, reservaB.id_reserva]
        );

        await conn.query(
            `UPDATE horario_intercambios SET intercambio_estado = 3, fecha_resolucion = NOW() WHERE id_intercambio = ?`,
            [idIntercambio]
        );

        await conn.commit();
        return { estado: "aceptado" };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Rechaza la propuesta y deja nuevamente disponible la oferta.
export async function rechazarIntercambio(idIntercambio, idRepartidorOfrece) {
    const conn = await conmysql.getConnection();
    try {
        await conn.beginTransaction();

        const [[intercambio]] = await conn.query(
            `SELECT * FROM horario_intercambios WHERE id_intercambio = ? FOR UPDATE`, [idIntercambio]
        );

        if (!intercambio || intercambio.id_repartidor_ofrece !== idRepartidorOfrece)
            throw Object.assign(new Error("No autorizado"), { codigo: "NO_AUTORIZADO" });

        if (intercambio.intercambio_estado !== 2)
            throw Object.assign(new Error("No existe una propuesta pendiente"), { codigo: "ESTADO_INVALIDO" });

        if (intercambio.id_reserva_solicitante) {
            await conn.query(
                `UPDATE horario_reservas SET reserva_estado = 1 WHERE id_reserva = ?`,
                [intercambio.id_reserva_solicitante]
            );
        }

        // La reserva del oferente permanece en intercambio; la propuesta del solicitante se libera.
        await conn.query(
            `UPDATE horario_intercambios
       SET intercambio_estado = 1, id_reserva_solicitante = NULL, id_repartidor_solicitante = NULL
       WHERE id_intercambio = ?`,
            [idIntercambio]
        );

        await conn.commit();
        return { estado: "rechazado_vuelve_a_oferta" };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}
