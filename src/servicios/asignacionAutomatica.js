// src/servicios/asignacionAutomatica.js

import { conmysql } from "../db.js";
import { asignarRepartidorAutomaticamente } from "../controladores/pedidorepartidoresCtrl.js";

const INTERVALO_ASIGNACION_MS = 30 * 1000;

let intervaloAsignacion = null;
let procesoEjecutando = false;

/**
 * Obtiene el ID del estado EN_PREPARACION.
 */
const obtenerIdEstadoEnPreparacion = async () => {
    const [rows] = await conmysql.query(
        `SELECT id_estado
         FROM estados
         WHERE UPPER(TRIM(estado_nombre)) = 'EN_PREPARACION'
         LIMIT 1`
    );

    return rows.length ? rows[0].id_estado : null;
};

/**
 * Busca todos los pedidos que están EN_PREPARACION
 * y todavía no tienen repartidor asignado.
 */
const obtenerPedidosPendientesDeAsignacion = async () => {
    const idEstado = await obtenerIdEstadoEnPreparacion();

    if (!idEstado) {
        throw new Error(
            'No existe el estado "EN_PREPARACION" en la tabla estados.'
        );
    }

    const [pedidos] = await conmysql.query(
        `SELECT
            p.id_pedido,
            p.pedido_codigo,
            p.id_local,
            p.id_repartidor,
            p.id_estado,
            e.estado_nombre,
            p.pedido_fecha,
            p.pedido_total
         FROM pedidos p
         INNER JOIN estados e
             ON p.id_estado = e.id_estado
         WHERE p.id_estado = ?
           AND p.id_repartidor IS NULL
         ORDER BY p.pedido_fecha ASC, p.id_pedido ASC`,
        [idEstado]
    );

    return pedidos;
};

/**
 * Intenta asignar repartidores a todos los pedidos
 * EN_PREPARACION que todavía no tengan repartidor.
 */
export const revisarPedidosSinRepartidor = async () => {
    if (procesoEjecutando) {
        console.log(
            "[AsignacionAutomatica] Ya existe una revisión en ejecución. Se omite esta ejecución."
        );
        return;
    }

    procesoEjecutando = true;

    try {
        const pedidos = await obtenerPedidosPendientesDeAsignacion();

        if (!pedidos.length) {
            console.log(
                "[AsignacionAutomatica] No hay pedidos EN_PREPARACION pendientes de asignación."
            );
            return;
        }

        console.log(
            `[AsignacionAutomatica] ${pedidos.length} pedido(s) pendientes de asignación.`
        );

        for (const pedido of pedidos) {
            try {
                console.log(
                    "[AsignacionAutomatica] Intentando asignar repartidor:",
                    {
                        id_pedido: pedido.id_pedido,
                        pedido_codigo: pedido.pedido_codigo,
                        id_local: pedido.id_local,
                        pedido_total: pedido.pedido_total
                    }
                );

                const resultado =
                    await asignarRepartidorAutomaticamente(
                        Number(pedido.id_pedido)
                    );

                if (resultado?.asignado) {
                    console.log(
                        "[AsignacionAutomatica] Repartidor asignado correctamente:",
                        resultado
                    );
                } else {
                    console.log(
                        "[AsignacionAutomatica] No se pudo asignar todavía:",
                        {
                            id_pedido: pedido.id_pedido,
                            pedido_codigo: pedido.pedido_codigo,
                            motivo: resultado?.motivo
                        }
                    );
                }
            } catch (errorPedido) {
                // Un pedido con error no debe detener la revisión
                // de los demás pedidos.
                console.error(
                    "[AsignacionAutomatica] Error procesando pedido:",
                    {
                        id_pedido: pedido.id_pedido,
                        pedido_codigo: pedido.pedido_codigo,
                        error: errorPedido.message
                    }
                );
            }
        }
    } catch (error) {
        console.error(
            "[AsignacionAutomatica] Error durante la revisión general:",
            error
        );
    } finally {
        procesoEjecutando = false;
    }
};

/**
 * Inicia la revisión automática cada 30 segundos.
 *
 * También realiza una revisión inmediatamente al iniciar.
 */
export const iniciarAsignacionAutomatica = async () => {
    if (intervaloAsignacion) {
        console.log(
            "[AsignacionAutomatica] El servicio ya está iniciado."
        );
        return;
    }

    console.log(
        "[AsignacionAutomatica] Iniciando servicio de asignación automática."
    );

    console.log(
        `[AsignacionAutomatica] Intervalo configurado: ${INTERVALO_ASIGNACION_MS / 1000} segundos.`
    );

    // Primer intento inmediatamente al iniciar el servidor.
    await revisarPedidosSinRepartidor();

    // Luego revisar cada 30 segundos.
    intervaloAsignacion = setInterval(async () => {
        try {
            await revisarPedidosSinRepartidor();
        } catch (error) {
            console.error(
                "[AsignacionAutomatica] Error en intervalo:",
                error
            );
        }
    }, INTERVALO_ASIGNACION_MS);

    console.log(
        "[AsignacionAutomatica] Servicio iniciado correctamente."
    );
};

/**
 * Detiene el servicio de asignación automática.
 */
export const detenerAsignacionAutomatica = () => {
    if (!intervaloAsignacion) {
        return;
    }

    clearInterval(intervaloAsignacion);
    intervaloAsignacion = null;

    console.log(
        "[AsignacionAutomatica] Servicio detenido."
    );
};

export default {
    iniciarAsignacionAutomatica,
    detenerAsignacionAutomatica,
    revisarPedidosSinRepartidor
};
