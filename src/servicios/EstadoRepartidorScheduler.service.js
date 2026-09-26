// src/servicios/EstadoRepartidorScheduler.service.js
import { conmysql } from "../db.js";
import { OFFSET_ECUADOR_HORAS } from "../utils/horarioTiempo.js";

const ESTADO = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5 };
const INTERVALO_MS = 60 * 1000;

// NOTA: la activación LISTO -> REPARTIENDO ya la hace activarTurnosIniciados()
// en ConexionRepartidor.service.js (correcta, usa instanteUtcDesdeHoraEcuador).
// Esa función NUNCA parte de DESCONECTADO porque conectarse es siempre una
// acción manual del repartidor. Este scheduler solo se encarga de desconectar
// cuando el turno ya terminó.

// Si el repartidor está LISTO/REPARTIENDO/EN_PAUSA y su turno reservado ya
// terminó, vuelve a DESCONECTADO. No toca a quien está EN_PEDIDO (debe
// completar la entrega primero) ni conecta a nadie: solo desconecta.
async function desconectarTurnosFinalizados() {
    await conmysql.query(`
    UPDATE repartidores r
    SET r.id_estado_repartidor = ${ESTADO.DESCONECTADO}
    WHERE r.id_estado_repartidor IN (${ESTADO.LISTO}, ${ESTADO.REPARTIENDO}, ${ESTADO.EN_PAUSA})
      AND NOT EXISTS (
        SELECT 1 FROM horario_reservas hr
        INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
        WHERE hr.id_repartidor = r.id_repartidor AND hr.reserva_estado = 1
          AND hd.horario_fecha = DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${OFFSET_ECUADOR_HORAS} HOUR))
          AND TIME(DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${OFFSET_ECUADOR_HORAS} HOUR))
              BETWEEN hd.horario_hora_inicio AND hd.horario_hora_fin
      )
  `);
}

async function ejecutarCiclo() {
    try {
        await desconectarTurnosFinalizados();
    } catch (error) {
        console.error("[EstadoRepartidor] Error en ciclo automático:", error);
    }
}

export function iniciarSchedulerEstadosRepartidor() {
    ejecutarCiclo();
    setInterval(ejecutarCiclo, INTERVALO_MS);
}
