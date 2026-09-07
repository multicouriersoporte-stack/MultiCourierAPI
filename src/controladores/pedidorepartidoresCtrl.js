import { conmysql } from "../db.js";

// Configuración
const RADIOS_ASIGNACION = [3, 6, 10, 16];
const MAX_ANTIGUEDAD_UBICACION_MINUTOS = 3;
const VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS = 5;
const DIFERENCIA_PEDIDOS_RANKING = 5;

// Estados válidos
const ESTADOS_REPARTIDOR_DISPONIBLES = ["LISTO", "REPARTIENDO"];
const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE";
const ESTADO_PEDIDO_EN_PREPARACION = "EN_PREPARACION";
const ESTADO_PEDIDO_ASIGNADO = "ASIGNADO";
const ESTADO_PR_OFERTADO = "OFERTADO";
const ESTADO_PR_ACEPTADO = "ACEPTADO";
const ESTADO_PR_RECHAZADO = "RECHAZADO";
const ESTADO_PR_RECOGIDO = "RECOGIDO";
const ESTADO_PR_ENTREGADO = "ENTREGADO";

// Autorización
const obtenerIdUsuario = req => {
    const u = req.usuario || {};
    return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

const obtenerRol = req => {
    const u = req.usuario || {};
    const rol = u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.usuario_role ?? u.rol_nombre;
    if (String(rol || "").trim()) return String(rol).trim().toUpperCase();

    const idRol = Number(u.id_rol ?? u.rol_id ?? u.idRol ?? u.usuario_id_rol);
    switch (idRol) {
        case 1: return "CLIENTE";
        case 2: return "REPARTIDOR";
        case 3: return "LOCAL";
        case 4: return "CENTRAL";
        case 5: return "SUPERVISOR";
        case 6: return "SOPORTE";
        case 7: return "ADMINISTRADOR";
        default: return "";
    }
};

const tieneRol = (req, rolesPermitidos = []) => rolesPermitidos.map(r => String(r).trim().toUpperCase()).includes(obtenerRol(req));
const puedeAsignarManualmente = req => tieneRol(req, ["ADMINISTRADOR", "CENTRAL", "SOPORTE"]);
const puedeReasignar = req => tieneRol(req, ["ADMINISTRADOR", "SOPORTE"]);

// Validaciones
const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;

// Estados
const obtenerIdEstadoPedido = async (conexion, nombreEstado) => {
    const [estados] = await conexion.query(
        `SELECT id_estado FROM estados WHERE estado_tipo = 'PEDIDO' AND UPPER(TRIM(estado_nombre)) = ? AND estado_activo = 1 LIMIT 1`,
        [String(nombreEstado).trim().toUpperCase()]
    );
    return estados.length ? estados[0].id_estado : null;
};

const obtenerIdEstadoPedidoRepartidor = async (conexion, nombreEstado) => {
    const [estados] = await conexion.query(
        `SELECT id_estado FROM estados WHERE estado_tipo = 'PEDIDO_REPARTIDOR' AND UPPER(TRIM(estado_nombre)) = ? AND estado_activo = 1 LIMIT 1`,
        [String(nombreEstado).trim().toUpperCase()]
    );
    return estados.length ? estados[0].id_estado : null;
};

// Pedido bloqueado durante la transacción
const obtenerPedidoBloqueado = async (conexion, id_pedido) => {
    const [pedidos] = await conexion.query(
        `SELECT p.id_pedido,p.pedido_codigo,p.id_cliente,p.id_local,p.id_repartidor,p.id_estado,p.pedido_fecha,p.pedido_total,p.pedido_carrera,p.pedido_local_latitud,p.pedido_local_longitud,p.pedido_cliente_latitud,p.pedido_cliente_longitud,e.estado_nombre
         FROM pedidos p LEFT JOIN estados e ON p.id_estado=e.id_estado
         WHERE p.id_pedido=? LIMIT 1 FOR UPDATE`,
        [id_pedido]
    );
    return pedidos.length ? pedidos[0] : null;
};

// Repartidor bloqueado durante la transacción
const obtenerRepartidorBloqueado = async (conexion, id_repartidor) => {
    const [rows] = await conexion.query(
        `SELECT r.id_repartidor,r.id_usuario,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,r.repartidor_posicion_ranking,r.repartidor_total_pedidos,r.repartidor_puntos,r.repartidor_calificacion,r.id_estado_repartidor,
                er.estado_repartidor_nombre,er.estado_repartidor_permite_pedidos,er.estado_repartidor_permite_seleccion,er.estado_repartidor_estado
         FROM repartidores r
         INNER JOIN estados_repartidor er ON r.id_estado_repartidor=er.id_estado_repartidor
         WHERE r.id_repartidor=? LIMIT 1 FOR UPDATE`,
        [id_repartidor]
    );
    return rows.length ? rows[0] : null;
};

const repartidorPuedeRecibirPedido = repartidor => {
    if (!repartidor) return false;
    const estado = String(repartidor.estado_repartidor_nombre || "").trim().toUpperCase();
    return ESTADOS_REPARTIDOR_DISPONIBLES.includes(estado) &&
        Number(repartidor.estado_repartidor_permite_pedidos) === 1 &&
        Number(repartidor.estado_repartidor_estado) === 1;
};

// Asignaciones activas
const obtenerAsignacionActiva = async (conexion, id_pedido) => {
    const [rows] = await conexion.query(
        `SELECT pr.*,r.repartidor_codigo,e.estado_nombre
         FROM pedido_repartidores pr
         INNER JOIN repartidores r ON pr.id_repartidor=r.id_repartidor
         INNER JOIN estados e ON pr.id_estado=e.id_estado
         WHERE pr.id_pedido=? AND e.estado_tipo='PEDIDO_REPARTIDOR'
         AND UPPER(TRIM(e.estado_nombre)) IN ('OFERTADO','ACEPTADO','RECOGIDO')
         ORDER BY pr.id_pedido_repartidor DESC LIMIT 1 FOR UPDATE`,
        [id_pedido]
    );
    return rows.length ? rows[0] : null;
};

const obtenerAsignacionesPedido = async (conexion, id_pedido) => {
    const [rows] = await conexion.query(
        `SELECT pr.*,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,e.estado_nombre AS estado_asignacion
         FROM pedido_repartidores pr
         INNER JOIN repartidores r ON pr.id_repartidor=r.id_repartidor
         INNER JOIN estados e ON pr.id_estado=e.id_estado
         WHERE pr.id_pedido=?
         ORDER BY pr.id_pedido_repartidor DESC`,
        [id_pedido]
    );
    return rows;
};

// Crea una oferta para el repartidor
const crearAsignacion = async ({ conexion, pedido, repartidor, idEstadoOfertado }) => {
    const [insert] = await conexion.query(
        `INSERT INTO pedido_repartidores
        (id_pedido,id_repartidor,pedido_repartidor_fecha_solicitud,pedido_repartidor_fecha_asignacion,pedido_repartidor_prioridad,pedido_repartidor_es_seleccion_cliente,pedido_repartidor_costo_seleccion,pedido_repartidor_orden_simultaneo,id_estado)
        VALUES (?,?,NOW(),NOW(),0,0,0,1,?)`,
        [pedido.id_pedido, repartidor.id_repartidor, idEstadoOfertado]
    );
    return insert.insertId;
};

// Asocia el repartidor al pedido sin modificar su estado
const asociarRepartidorAlPedido = async (conexion, id_pedido, id_repartidor, idEstadoEnPreparacion) => {
    const [resultado] = await conexion.query(
        `UPDATE pedidos SET id_repartidor=? WHERE id_pedido=? AND id_repartidor IS NULL AND id_estado=?`,
        [id_repartidor, id_pedido, idEstadoEnPreparacion]
    );
    return resultado;
};

// Asignación automática
export const asignarRepartidorAutomaticamente = async id_pedido => {
    const conexion = await conmysql.getConnection();
    try {
        await conexion.beginTransaction();

        const idEstadoEnPreparacion = await obtenerIdEstadoPedido(conexion, ESTADO_PEDIDO_EN_PREPARACION);
        const idEstadoOfertado = await obtenerIdEstadoPedidoRepartidor(conexion, ESTADO_PR_OFERTADO);

        if (!idEstadoEnPreparacion) throw new Error(`No existe el estado PEDIDO "${ESTADO_PEDIDO_EN_PREPARACION}".`);
        if (!idEstadoOfertado) throw new Error(`No existe el estado PEDIDO_REPARTIDOR "${ESTADO_PR_OFERTADO}".`);

        const pedido = await obtenerPedidoBloqueado(conexion, id_pedido);
        if (!pedido) throw new Error("El pedido no existe.");

        if (Number(pedido.id_estado) !== Number(idEstadoEnPreparacion)) {
            await conexion.rollback();
            return { asignado: false, motivo: `El pedido no está en ${ESTADO_PEDIDO_EN_PREPARACION}.`, estado_actual: pedido.estado_nombre, id_estado_actual: pedido.id_estado };
        }

        if (pedido.id_repartidor !== null) {
            await conexion.rollback();
            return { asignado: false, motivo: "El pedido ya tiene un repartidor asignado.", id_repartidor: pedido.id_repartidor };
        }

        if (pedido.pedido_local_latitud === null || pedido.pedido_local_longitud === null) {
            await conexion.rollback();
            return { asignado: false, motivo: "El pedido no tiene coordenadas válidas del local." };
        }

        const asignacionActiva = await obtenerAsignacionActiva(conexion, id_pedido);
        if (asignacionActiva) {
            await conexion.rollback();
            return {
                asignado: false,
                motivo: "El pedido ya tiene una asignación activa.",
                id_repartidor: asignacionActiva.id_repartidor,
                id_pedido_repartidor: asignacionActiva.id_pedido_repartidor
            };
        }

        // Prioriza pedidos simultáneos de mayor valor.
        const [pedidosSimultaneos] = await conexion.query(
            `SELECT p2.id_pedido,p2.pedido_codigo,p2.pedido_total,p2.pedido_fecha
             FROM pedidos p2
             WHERE p2.id_estado=? AND p2.id_repartidor IS NULL AND p2.id_pedido<>?
             AND p2.pedido_fecha BETWEEN DATE_SUB(?,INTERVAL ? MINUTE) AND DATE_ADD(?,INTERVAL ? MINUTE)
             ORDER BY p2.pedido_total DESC,p2.pedido_fecha ASC,p2.id_pedido ASC`,
            [idEstadoEnPreparacion, id_pedido, pedido.pedido_fecha, VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS, pedido.pedido_fecha, VENTANA_PEDIDOS_SIMULTANEOS_MINUTOS]
        );

        const pedidoDeMayorValor = pedidosSimultaneos.find(otro => Number(otro.pedido_total || 0) > Number(pedido.pedido_total || 0));
        if (pedidoDeMayorValor) {
            await conexion.rollback();
            return {
                asignado: false,
                motivo: "Existe otro pedido simultáneo de mayor valor.",
                pedido_prioritario: {
                    id_pedido: pedidoDeMayorValor.id_pedido,
                    pedido_codigo: pedidoDeMayorValor.pedido_codigo,
                    pedido_total: Number(pedidoDeMayorValor.pedido_total || 0)
                }
            };
        }

        // Busca repartidores disponibles con ubicación reciente.
        const [repartidores] = await conexion.query(
            `SELECT r.id_repartidor,r.id_usuario,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,
                    r.repartidor_posicion_ranking,r.repartidor_total_pedidos,r.repartidor_puntos,r.repartidor_calificacion,
                    er.estado_repartidor_nombre,er.estado_repartidor_permite_pedidos,er.estado_repartidor_permite_seleccion,
                    ru.repartidor_ubicacion_latitud,ru.repartidor_ubicacion_longitud,ru.repartidor_ubicacion_fecha,
                    (6371*ACOS(LEAST(1,GREATEST(-1,
                        COS(RADIANS(?))*COS(RADIANS(ru.repartidor_ubicacion_latitud))*
                        COS(RADIANS(ru.repartidor_ubicacion_longitud)-RADIANS(?))+
                        SIN(RADIANS(?))*SIN(RADIANS(ru.repartidor_ubicacion_latitud))
                    )))) AS distancia_km
             FROM repartidores r
             INNER JOIN estados_repartidor er ON r.id_estado_repartidor=er.id_estado_repartidor
             INNER JOIN (
                 SELECT ru1.* FROM repartidor_ubicaciones ru1
                 INNER JOIN (
                     SELECT id_repartidor,MAX(id_repartidor_ubicacion) AS ultima_ubicacion
                     FROM repartidor_ubicaciones GROUP BY id_repartidor
                 ) ultima ON ru1.id_repartidor_ubicacion=ultima.ultima_ubicacion
             ) ru ON r.id_repartidor=ru.id_repartidor
             WHERE er.estado_repartidor_estado=1
             AND UPPER(TRIM(er.estado_repartidor_nombre)) IN ('LISTO','REPARTIENDO')
             AND er.estado_repartidor_permite_pedidos=1
             AND ru.repartidor_ubicacion_fecha>=DATE_SUB(NOW(),INTERVAL ? MINUTE)`,
            [pedido.pedido_local_latitud, pedido.pedido_local_longitud, pedido.pedido_local_latitud, MAX_ANTIGUEDAD_UBICACION_MINUTOS]
        );

        if (!repartidores.length) {
            await conexion.rollback();
            return { asignado: false, motivo: "No existen repartidores LISTO o REPARTIENDO con ubicación reciente." };
        }

        let candidatos = [];
        let radioSeleccionado = null;

        for (const radio of RADIOS_ASIGNACION) {
            candidatos = repartidores.filter(r => Number(r.distancia_km) <= radio);
            if (candidatos.length) {
                radioSeleccionado = radio;
                break;
            }
        }

        if (!candidatos.length) {
            await conexion.rollback();
            return { asignado: false, motivo: "No existe repartidor disponible dentro de 16 km." };
        }

        // Orden: distancia, ranking si la diferencia de pedidos es baja, pedidos, puntos y calificación.
        candidatos.sort((a, b) => {
            const distanciaA = Number(a.distancia_km || 999999);
            const distanciaB = Number(b.distancia_km || 999999);
            if (distanciaA !== distanciaB) return distanciaA - distanciaB;

            const pedidosA = Number(a.repartidor_total_pedidos || 0);
            const pedidosB = Number(b.repartidor_total_pedidos || 0);

            if (Math.abs(pedidosA - pedidosB) <= DIFERENCIA_PEDIDOS_RANKING) {
                const rankingA = Number(a.repartidor_posicion_ranking ?? 999999);
                const rankingB = Number(b.repartidor_posicion_ranking ?? 999999);
                if (rankingA !== rankingB) return rankingA - rankingB;
            }

            if (pedidosA !== pedidosB) return pedidosA - pedidosB;

            const puntosA = Number(a.repartidor_puntos || 0);
            const puntosB = Number(b.repartidor_puntos || 0);
            if (puntosA !== puntosB) return puntosB - puntosA;

            const calificacionA = Number(a.repartidor_calificacion || 0);
            const calificacionB = Number(b.repartidor_calificacion || 0);
            if (calificacionA !== calificacionB) return calificacionB - calificacionA;

            return Number(a.id_repartidor) - Number(b.id_repartidor);
        });

        const candidato = candidatos[0];
        const repartidor = await obtenerRepartidorBloqueado(conexion, candidato.id_repartidor);

        if (!repartidor) throw new Error("El repartidor seleccionado ya no existe.");

        if (!repartidorPuedeRecibirPedido(repartidor)) {
            await conexion.rollback();
            return { asignado: false, motivo: "El repartidor seleccionado ya no está disponible." };
        }

        const idPedidoRepartidor = await crearAsignacion({ conexion, pedido, repartidor, idEstadoOfertado });
        const actualizacion = await asociarRepartidorAlPedido(conexion, id_pedido, repartidor.id_repartidor, idEstadoEnPreparacion);

        if (!actualizacion.affectedRows) {
            await conexion.query(`DELETE FROM pedido_repartidores WHERE id_pedido_repartidor=?`, [idPedidoRepartidor]);
            await conexion.rollback();
            return { asignado: false, motivo: "El pedido cambió de estado o fue asignado a otro repartidor." };
        }

        await conexion.commit();

        return {
            asignado: true,
            tipo_asignacion: "AUTOMATICA",
            id_pedido,
            pedido_codigo: pedido.pedido_codigo,
            id_pedido_repartidor: idPedidoRepartidor,
            id_repartidor: repartidor.id_repartidor,
            repartidor_codigo: repartidor.repartidor_codigo,
            estado_pedido: ESTADO_PEDIDO_EN_PREPARACION,
            estado_asignacion: ESTADO_PR_OFERTADO,
            estado_repartidor: repartidor.estado_repartidor_nombre,
            distancia_km: Number(Number(candidato.distancia_km).toFixed(3)),
            radio_asignacion_km: radioSeleccionado,
            pedido_total: Number(pedido.pedido_total || 0),
            mensaje_repartidor: "Pedido asignado"
        };
    } catch (error) {
        try { await conexion.rollback(); } catch (rollbackError) {
            console.error("[PedidoRepartidor] Error rollback:", rollbackError);
        }
        console.error("[PedidoRepartidor] Error asignación automática:", error);
        throw error;
    } finally {
        conexion.release();
    }
};

// Lista repartidores disponibles para asignación manual.
export const getRepartidoresDisponiblesAsignacion = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!puedeAsignarManualmente(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar repartidores disponibles para asignación." });

        const { id_pedido, latitud, longitud } = req.query;
        let lat = Number(latitud), lng = Number(longitud);

        if (esIdValido(id_pedido)) {
            const [pedidos] = await conmysql.query(
                `SELECT id_pedido,pedido_local_latitud,pedido_local_longitud FROM pedidos WHERE id_pedido=? LIMIT 1`,
                [id_pedido]
            );

            if (!pedidos.length) return res.status(404).json({ success: false, message: "El pedido no existe." });
            lat = Number(pedidos[0].pedido_local_latitud);
            lng = Number(pedidos[0].pedido_local_longitud);
        }

        const tieneCoordenadas = Number.isFinite(lat) && Number.isFinite(lng);
        const parametros = [];

        let sql = `
            SELECT r.id_repartidor,r.id_usuario,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,
                   r.repartidor_posicion_ranking,r.repartidor_total_pedidos,r.repartidor_puntos,r.repartidor_calificacion,
                   er.estado_repartidor_nombre,er.estado_repartidor_permite_pedidos,er.estado_repartidor_permite_seleccion,
                   ru.repartidor_ubicacion_latitud,ru.repartidor_ubicacion_longitud,ru.repartidor_ubicacion_fecha`;

        if (tieneCoordenadas) {
            sql += `,
                (6371*ACOS(LEAST(1,GREATEST(-1,
                    COS(RADIANS(?))*COS(RADIANS(ru.repartidor_ubicacion_latitud))*
                    COS(RADIANS(ru.repartidor_ubicacion_longitud)-RADIANS(?))+
                    SIN(RADIANS(?))*SIN(RADIANS(ru.repartidor_ubicacion_latitud))
                )))) AS distancia_km`;
            parametros.push(lat, lng, lat);
        } else {
            sql += `,NULL AS distancia_km`;
        }

        sql += `
            FROM repartidores r
            INNER JOIN estados_repartidor er ON r.id_estado_repartidor=er.id_estado_repartidor
            LEFT JOIN (
                SELECT ru1.* FROM repartidor_ubicaciones ru1
                INNER JOIN (
                    SELECT id_repartidor,MAX(id_repartidor_ubicacion) AS ultima_ubicacion
                    FROM repartidor_ubicaciones GROUP BY id_repartidor
                ) ultima ON ru1.id_repartidor_ubicacion=ultima.ultima_ubicacion
            ) ru ON r.id_repartidor=ru.id_repartidor
            WHERE er.estado_repartidor_estado=1
            AND UPPER(TRIM(er.estado_repartidor_nombre)) IN ('LISTO','REPARTIENDO')
            AND er.estado_repartidor_permite_pedidos=1
            ORDER BY CASE
                WHEN er.estado_repartidor_nombre='LISTO' THEN 1
                WHEN er.estado_repartidor_nombre='REPARTIENDO' THEN 2
                ELSE 3
            END,distancia_km ASC,r.repartidor_posicion_ranking ASC,r.repartidor_total_pedidos ASC,
            r.repartidor_puntos DESC,r.repartidor_calificacion DESC,r.id_repartidor ASC`;

        const [rows] = await conmysql.query(sql, parametros);
        return res.json({ success: true, repartidores: rows });
    } catch (error) {
        console.error("[PedidoRepartidor] Error repartidores disponibles:", error);
        return res.status(500).json({ success: false, message: "Error al consultar repartidores disponibles." });
    }
};

// Asignación manual.
export const asignarRepartidorManualmente = async (req, res) => {
    const conexion = await conmysql.getConnection();

    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!puedeAsignarManualmente(req)) return res.status(403).json({ success: false, message: "No tienes permisos para asignar repartidores manualmente." });

        const id_pedido = Number(req.params.id_pedido);
        const id_repartidor = Number(req.body?.id_repartidor);

        if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!esIdValido(id_repartidor)) return res.status(400).json({ success: false, message: "El ID del repartidor es obligatorio y válido." });

        await conexion.beginTransaction();

        const idEstadoEnPreparacion = await obtenerIdEstadoPedido(conexion, ESTADO_PEDIDO_EN_PREPARACION);
        const idEstadoOfertado = await obtenerIdEstadoPedidoRepartidor(conexion, ESTADO_PR_OFERTADO);

        if (!idEstadoEnPreparacion) throw new Error(`No existe el estado PEDIDO "${ESTADO_PEDIDO_EN_PREPARACION}".`);
        if (!idEstadoOfertado) throw new Error(`No existe el estado PEDIDO_REPARTIDOR "${ESTADO_PR_OFERTADO}".`);

        const pedido = await obtenerPedidoBloqueado(conexion, id_pedido);

        if (!pedido) {
            await conexion.rollback();
            return res.status(404).json({ success: false, message: "El pedido no existe." });
        }

        if (Number(pedido.id_estado) !== Number(idEstadoEnPreparacion)) {
            await conexion.rollback();
            return res.status(409).json({
                success: false,
                message: `El pedido debe estar en ${ESTADO_PEDIDO_EN_PREPARACION}.`,
                estado_actual: pedido.estado_nombre,
                id_estado_actual: pedido.id_estado
            });
        }

        if (pedido.id_repartidor !== null) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: "El pedido ya tiene un repartidor. Para cambiarlo debes utilizar la reasignación." });
        }

        const asignacionActiva = await obtenerAsignacionActiva(conexion, id_pedido);
        if (asignacionActiva) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: "El pedido ya tiene una asignación activa.", asignacion: asignacionActiva });
        }

        const repartidor = await obtenerRepartidorBloqueado(conexion, id_repartidor);

        if (!repartidor) {
            await conexion.rollback();
            return res.status(404).json({ success: false, message: "El repartidor no existe." });
        }

        if (!repartidorPuedeRecibirPedido(repartidor)) {
            await conexion.rollback();
            return res.status(409).json({
                success: false,
                message: "El repartidor seleccionado no puede recibir pedidos.",
                estado_repartidor: repartidor.estado_repartidor_nombre
            });
        }

        const idPedidoRepartidor = await crearAsignacion({ conexion, pedido, repartidor, idEstadoOfertado });
        const actualizacion = await asociarRepartidorAlPedido(conexion, id_pedido, id_repartidor, idEstadoEnPreparacion);

        if (!actualizacion.affectedRows) {
            await conexion.query(`DELETE FROM pedido_repartidores WHERE id_pedido_repartidor=?`, [idPedidoRepartidor]);
            await conexion.rollback();
            return res.status(409).json({ success: false, message: "El pedido fue modificado antes de completar la asignación." });
        }

        await conexion.commit();

        return res.status(201).json({
            success: true,
            message: "Repartidor asignado manualmente correctamente.",
            tipo_asignacion: "MANUAL",
            id_pedido,
            pedido_codigo: pedido.pedido_codigo,
            id_repartidor,
            repartidor_codigo: repartidor.repartidor_codigo,
            id_pedido_repartidor: idPedidoRepartidor,
            estado_pedido: ESTADO_PEDIDO_EN_PREPARACION,
            estado_asignacion: ESTADO_PR_OFERTADO,
            estado_repartidor: repartidor.estado_repartidor_nombre
        });
    } catch (error) {
        try { await conexion.rollback(); } catch (rollbackError) {
            console.error("[PedidoRepartidor] Error rollback:", rollbackError);
        }
        console.error("[PedidoRepartidor] Error asignación manual:", error);

        return res.status(500).json({
            success: false,
            message: "Error al asignar repartidor manualmente.",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    } finally {
        conexion.release();
    }
};

// Reasignación: conserva el historial y crea una nueva oferta.
export const reasignarRepartidor = async (req, res) => {
    const conexion = await conmysql.getConnection();

    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!puedeReasignar(req)) return res.status(403).json({ success: false, message: "Solo SOPORTE y ADMINISTRADOR pueden reasignar repartidores." });

        const id_pedido = Number(req.params.id_pedido);
        const id_repartidor = Number(req.body?.id_repartidor);
        const motivo = String(req.body?.motivo || "").trim();

        if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!esIdValido(id_repartidor)) return res.status(400).json({ success: false, message: "El ID del nuevo repartidor es obligatorio y válido." });
        if (!motivo) return res.status(400).json({ success: false, message: "Debes indicar el motivo de la reasignación." });

        await conexion.beginTransaction();

        const idEstadoOfertado = await obtenerIdEstadoPedidoRepartidor(conexion, ESTADO_PR_OFERTADO);
        if (!idEstadoOfertado) throw new Error(`No existe el estado PEDIDO_REPARTIDOR "${ESTADO_PR_OFERTADO}".`);

        const pedido = await obtenerPedidoBloqueado(conexion, id_pedido);

        if (!pedido) {
            await conexion.rollback();
            return res.status(404).json({ success: false, message: "El pedido no existe." });
        }

        const estadosNoReasignables = ["ENTREGADO", "NO_ENTREGADO"];
        const estadoPedido = String(pedido.estado_nombre || "").trim().toUpperCase();

        if (estadosNoReasignables.includes(estadoPedido)) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: "No se puede reasignar un pedido finalizado.", estado_actual: pedido.estado_nombre });
        }

        const repartidor = await obtenerRepartidorBloqueado(conexion, id_repartidor);

        if (!repartidor) {
            await conexion.rollback();
            return res.status(404).json({ success: false, message: "El nuevo repartidor no existe." });
        }

        if (!repartidorPuedeRecibirPedido(repartidor)) {
            await conexion.rollback();
            return res.status(409).json({
                success: false,
                message: "El nuevo repartidor no puede recibir pedidos.",
                estado_repartidor: repartidor.estado_repartidor_nombre
            });
        }

        if (Number(pedido.id_repartidor) === Number(id_repartidor)) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: "El repartidor seleccionado ya es el repartidor actual." });
        }

        const asignacionAnterior = await obtenerAsignacionActiva(conexion, id_pedido);
        const nuevoIdPedidoRepartidor = await crearAsignacion({ conexion, pedido, repartidor, idEstadoOfertado });

        const [actualizacion] = await conexion.query(
            `UPDATE pedidos SET id_repartidor=? WHERE id_pedido=?`,
            [id_repartidor, id_pedido]
        );

        if (!actualizacion.affectedRows) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: "No se pudo actualizar el repartidor del pedido." });
        }

        await conexion.commit();

        return res.status(200).json({
            success: true,
            message: "Repartidor reasignado correctamente.",
            tipo_asignacion: "REASIGNACION",
            id_pedido,
            pedido_codigo: pedido.pedido_codigo,
            repartidor_anterior: asignacionAnterior ? {
                id_repartidor: asignacionAnterior.id_repartidor,
                repartidor_codigo: asignacionAnterior.repartidor_codigo,
                id_pedido_repartidor: asignacionAnterior.id_pedido_repartidor
            } : pedido.id_repartidor ? { id_repartidor: pedido.id_repartidor } : null,
            nuevo_repartidor: {
                id_repartidor,
                repartidor_codigo: repartidor.repartidor_codigo,
                estado_repartidor: repartidor.estado_repartidor_nombre
            },
            id_pedido_repartidor: nuevoIdPedidoRepartidor,
            estado_pedido: estadoPedido,
            estado_asignacion: ESTADO_PR_OFERTADO,
            motivo
        });
    } catch (error) {
        try { await conexion.rollback(); } catch (rollbackError) {
            console.error("[PedidoRepartidor] Error rollback:", rollbackError);
        }
        console.error("[PedidoRepartidor] Error reasignación:", error);

        return res.status(500).json({
            success: false,
            message: "Error al reasignar repartidor.",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    } finally {
        conexion.release();
    }
};

// Historial de asignaciones.
export const getAsignacionesPedido = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        if (!tieneRol(req, ["ADMINISTRADOR", "CENTRAL", "SOPORTE", "LOCAL"])) {
            return res.status(403).json({ success: false, message: "No tienes permisos para consultar las asignaciones del pedido." });
        }

        const id_pedido = Number(req.params.id_pedido);
        if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });

        const asignaciones = await obtenerAsignacionesPedido(conmysql, id_pedido);
        return res.json({ success: true, asignaciones });
    } catch (error) {
        console.error("[PedidoRepartidor] Error historial:", error);
        return res.status(500).json({ success: false, message: "Error al consultar historial de asignaciones." });
    }
};

// Exportaciones
export {
    obtenerIdEstadoPedido,
    obtenerIdEstadoPedidoRepartidor,
    obtenerIdUsuario,
    obtenerRol,
    tieneRol,
    puedeAsignarManualmente,
    puedeReasignar,
    esIdValido,
    repartidorPuedeRecibirPedido,
    obtenerAsignacionActiva,
    obtenerAsignacionesPedido
};
