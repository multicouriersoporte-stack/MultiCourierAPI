// src/servicios/asignacionAutomatica.js

import { conmysql } from "../db.js";
import { asignarRepartidorAutomaticamente } from "../controladores/pedidorepartidoresCtrl.js";

const INTERVALO_ASIGNACION_MS = 30 * 1000;
const ESTADOS_PENDIENTES_ASIGNACION = [11, 12]; // 11 = EN_PREPARACION, 12 = LISTO

let intervaloAsignacion = null;
let procesoEjecutando = false;

// Obtiene pedidos pendientes sin repartidor.
const obtenerPedidosPendientesDeAsignacion = async () => {
    const [pedidos] = await conmysql.query(
        `SELECT p.id_pedido, p.pedido_codigo, p.id_local, p.id_repartidor,
                p.id_estado, e.estado_nombre, p.pedido_fecha, p.pedido_total
         FROM pedidos p
         INNER JOIN estados e ON p.id_estado = e.id_estado
         WHERE p.id_estado IN (?, ?) AND p.id_repartidor IS NULL
         ORDER BY p.pedido_fecha ASC, p.id_pedido ASC`,
        ESTADOS_PENDIENTES_ASIGNACION
    );
    return pedidos;
};

// Intenta asignar repartidor a cada pedido pendiente.
export const revisarPedidosSinRepartidor = async () => {
    if (procesoEjecutando) {
        console.log("[AsignacionAutomatica] Ya existe una revisión en ejecución. Se omite esta ejecución.");
        return;
    }

    procesoEjecutando = true;
    try {
        const pedidos = await obtenerPedidosPendientesDeAsignacion();

        if (!pedidos.length) {
            console.log("[AsignacionAutomatica] No hay pedidos EN_PREPARACION o LISTO pendientes de asignación.");
            return;
        }

        console.log(`[AsignacionAutomatica] ${pedidos.length} pedido(s) pendientes de asignación.`);

        for (const pedido of pedidos) {
            try {
                console.log("[AsignacionAutomatica] Intentando asignar repartidor:", {
                    id_pedido: pedido.id_pedido,
                    pedido_codigo: pedido.pedido_codigo,
                    id_local: pedido.id_local,
                    id_estado: pedido.id_estado,
                    estado_nombre: pedido.estado_nombre,
                    pedido_total: pedido.pedido_total
                });

                const resultado = await asignarRepartidorAutomaticamente(Number(pedido.id_pedido));

                if (resultado?.asignado) {
                    console.log("[AsignacionAutomatica] Repartidor asignado correctamente:", resultado);
                } else {
                    console.log("[AsignacionAutomatica] No se pudo asignar todavía:", {
                        id_pedido: pedido.id_pedido,
                        pedido_codigo: pedido.pedido_codigo,
                        id_estado: pedido.id_estado,
                        estado_nombre: pedido.estado_nombre,
                        motivo: resultado?.motivo
                    });
                }
            } catch (errorPedido) {
                // Un error individual no debe detener los demás pedidos.
                console.error("[AsignacionAutomatica] Error procesando pedido:", {
                    id_pedido: pedido.id_pedido,
                    pedido_codigo: pedido.pedido_codigo,
                    id_estado: pedido.id_estado,
                    estado_nombre: pedido.estado_nombre,
                    error: errorPedido.message
                });
            }
        }
    } catch (error) {
        console.error("[AsignacionAutomatica] Error durante la revisión general:", error);
    } finally {
        procesoEjecutando = false;
    }
};

// Inicia el servicio y ejecuta una revisión inmediata.
export const iniciarAsignacionAutomatica = async () => {
    if (intervaloAsignacion) {
        console.log("[AsignacionAutomatica] El servicio ya está iniciado.");
        return;
    }

    console.log("[AsignacionAutomatica] Iniciando servicio de asignación automática.");
    console.log(`[AsignacionAutomatica] Intervalo: ${INTERVALO_ASIGNACION_MS / 1000} segundos.`);
    console.log(`[AsignacionAutomatica] Estados supervisados: ${ESTADOS_PENDIENTES_ASIGNACION.join(", ")} (EN_PREPARACION, LISTO).`);

    await revisarPedidosSinRepartidor();

    intervaloAsignacion = setInterval(async () => {
        try {
            await revisarPedidosSinRepartidor();
        } catch (error) {
            console.error("[AsignacionAutomatica] Error en intervalo:", error);
        }
    }, INTERVALO_ASIGNACION_MS);

    console.log("[AsignacionAutomatica] Servicio iniciado correctamente.");
};

// Detiene la revisión automática.
export const detenerAsignacionAutomatica = () => {
    if (!intervaloAsignacion) return;

    clearInterval(intervaloAsignacion);
    intervaloAsignacion = null;
    console.log("[AsignacionAutomatica] Servicio detenido.");
};

export default { iniciarAsignacionAutomatica, detenerAsignacionAutomatica, revisarPedidosSinRepartidor };
