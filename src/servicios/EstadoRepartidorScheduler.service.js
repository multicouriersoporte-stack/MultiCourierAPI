// src/servicios/EstadoRepartidorScheduler.service.js
import { conmysql } from "../db.js";

const ESTADO = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5 };
const INTERVALO_MS = 60 * 1000;

// Si el turno reservado ya inició, el repartidor pasa automáticamente a REPARTIENDO
// (a menos que ya esté EN_PEDIDO o INHABILITADO).
async function activarTurnosIniciados() {
    await conmysql.query(`
    UPDATE repartidores r
    SET r.id_estado_repartidor = ${ESTADO.REPARTIENDO}
    WHERE r.id_estado_repartidor IN (${ESTADO.DESCONECTADO}, ${ESTADO.LISTO})
      AND EXISTS (
        SELECT 1 FROM horario_reservas hr
        INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
        WHERE hr.id_repartidor = r.id_repartidor AND hr.reserva_estado = 1
          AND hd.horario_fecha = CURDATE()
          AND CURTIME() BETWEEN hd.horario_hora_inicio AND hd.horario_hora_fin
      )
  `);
}

// Si el turno reservado ya terminó, el repartidor pasa a DESCONECTADO,
// salvo que esté EN_PEDIDO (debe completar la entrega primero).
async function desconectarTurnosFinalizados() {
    await conmysql.query(`
    UPDATE repartidores r
    SET r.id_estado_repartidor = ${ESTADO.DESCONECTADO}
    WHERE r.id_estado_repartidor IN (${ESTADO.LISTO}, ${ESTADO.REPARTIENDO}, ${ESTADO.EN_PAUSA})
      AND NOT EXISTS (
        SELECT 1 FROM horario_reservas hr
        INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
        WHERE hr.id_repartidor = r.id_repartidor AND hr.reserva_estado = 1
          AND hd.horario_fecha = CURDATE()
          AND CURTIME() BETWEEN hd.horario_hora_inicio AND hd.horario_hora_fin
      )
  `);
}

async function ejecutarCiclo() {
    try {
        await activarTurnosIniciados();
        await desconectarTurnosFinalizados();
    } catch (error) {
        console.error("[EstadoRepartidor] Error en ciclo automático:", error);
    }
}

export function iniciarSchedulerEstadosRepartidor() {
    ejecutarCiclo();
    setInterval(ejecutarCiclo, INTERVALO_MS);
}