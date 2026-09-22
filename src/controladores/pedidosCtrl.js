/* // src/controladores/pedidosCtrl.js

import { conmysql } from "../db.js";
import { asignarRepartidorAutomaticamente } from "./pedidorepartidoresCtrl.js";
import { crearPagoLocalDesdePedido } from "./pagoslocalesCtrl.js";
import { crearPagoRepartidorDesdePedido } from "./pagosrepartidorCtrl.js";
import { obtenerAsignacionActiva } from "./pedidorepartidoresCtrl.js";
import { crearNotificacion, crearNotificacionesMasivas } from "./notificacionesCtrl.js";

const ROLES_ADMINISTRATIVOS = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_MODIFICAR_PEDIDOS = ["LOCAL", "REPARTIDOR", "CLIENTE", "SOPORTE", "ADMINISTRADOR"];
const ESTADO_REPARTIDOR = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5 };
const TRANSICIONES_ESTADO = {
    PENDIENTE: { EN_PREPARACION: ["LOCAL", "SOPORTE", "ADMINISTRADOR"] },
    EN_PREPARACION: { LISTO: ["LOCAL", "SOPORTE", "ADMINISTRADOR"] },
    LISTO: { EN_CAMINO: ["REPARTIDOR", "SOPORTE", "ADMINISTRADOR"] },
    EN_CAMINO: { ENTREGADO: ["REPARTIDOR", "SOPORTE", "ADMINISTRADOR"], NO_ENTREGADO: ["REPARTIDOR", "CLIENTE", "SOPORTE", "ADMINISTRADOR"] }
};

const obtenerRol = req => {
    const u = req.usuario || {};
    const rol = u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.usuario_role ?? u.rol_nombre ?? u.nombre_rol;
    if (String(rol).trim()) return String(rol).trim().toUpperCase();
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

const obtenerRoles = req => {
    const u = req.usuario || {};
    return [obtenerRol(req), ...(Array.isArray(u.roles) ? u.roles : [])].filter(Boolean).map(r => String(r).trim().toUpperCase()).filter((r, i, a) => a.indexOf(r) === i);
};
const tieneRol = (req, rolesPermitidos = []) => {
    const roles = rolesPermitidos.map(r => String(r).trim().toUpperCase());
    return obtenerRoles(req).some(r => roles.includes(r));
};
const esAdministrativo = req => tieneRol(req, ROLES_ADMINISTRATIVOS);
const puedeModificarPedidos = req => tieneRol(req, ROLES_MODIFICAR_PEDIDOS);
const obtenerIdUsuario = req => {
    const u = req.usuario || {};
    return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

const obtenerClienteDelUsuario = async id_usuario => {
    if (!id_usuario) return null;
    const [rows] = await conmysql.query(`SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
    return rows.length ? rows[0].id_cliente : null;
};

const obtenerLocalDelUsuario = async req => {
    const u = req.usuario || {}, id_usuario = obtenerIdUsuario(req);
    if (id_usuario) {
        const [locales] = await conmysql.query(`SELECT id_local,id_usuario,local_codigo,local_nombre_comercial,local_razon_social,local_telefono,local_email,local_latitud,local_longitud FROM locales WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
        if (locales.length) return locales[0];
    }
    const id_local_token = Number(u.id_local ?? u.local_id ?? u.idLocal ?? u.localId);
    if (Number.isInteger(id_local_token) && id_local_token > 0) {
        const [locales] = await conmysql.query(`SELECT id_local,id_usuario,local_codigo,local_nombre_comercial,local_razon_social,local_telefono,local_email,local_latitud,local_longitud FROM locales WHERE id_local = ? LIMIT 1`, [id_local_token]);
        if (locales.length) return locales[0];
    }
    return null;
};

const obtenerRepartidorDelUsuario = async id_usuario => {
    if (!id_usuario) return null;
    const [rows] = await conmysql.query(`SELECT id_repartidor FROM repartidores WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
    return rows.length ? rows[0].id_repartidor : null;
};

const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;
const generarPedidoPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

const convertirFechaMySQL = fecha => {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) throw new Error("La fecha proporcionada no es válida");
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const obtenerIdEstadoPorNombre = async (nombreEstado, tipoEstado = null) => {
    let sql = `SELECT id_estado FROM estados WHERE UPPER(TRIM(estado_nombre)) = ?`;
    const valores = [String(nombreEstado).trim().toUpperCase()];
    if (tipoEstado) {
        sql += ` AND UPPER(TRIM(estado_tipo)) = ?`;
        valores.push(String(tipoEstado).trim().toUpperCase());
    }
    sql += ` AND estado_activo = 1 ORDER BY id_estado LIMIT 1`;
    const [rows] = await conmysql.query(sql, valores);
    return rows.length ? rows[0].id_estado : null;
};

const obtenerMetodoPagoPorId = async id_metodo_pago => {
    if (id_metodo_pago === undefined || id_metodo_pago === null) return null;
    const [rows] = await conmysql.query(`SELECT id_metodo_pago,metodo_pago_nombre,metodo_pago_descripcion,metodo_pago_estado FROM metodos_pago WHERE id_metodo_pago = ? LIMIT 1`, [id_metodo_pago]);
    return rows.length ? rows[0] : null;
};

const ID_METODO_PAGO_TARJETA = 3;
const esMetodoTransferencia = metodoPago => !!metodoPago && String(metodoPago.metodo_pago_nombre || "").trim().toUpperCase() === "TRANSFERENCIA";
const esMetodoTarjeta = metodoPago => Number(metodoPago?.id_metodo_pago) === ID_METODO_PAGO_TARJETA;
const esMetodoBilletera = metodoPago => Number(metodoPago?.id_metodo_pago) === 5;
const requierePagoConfirmado = metodoPago => esMetodoTransferencia(metodoPago) || esMetodoTarjeta(metodoPago);

// Libera al repartidor de EN_PEDIDO y respeta la vigencia de su turno actual.
const sincronizarEstadoRepartidorTrasEntrega = async id_repartidor => {
    if (!id_repartidor) return;
    const [rep] = await conmysql.query(`SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1`, [id_repartidor]);
    if (!rep.length || Number(rep[0].id_estado_repartidor) !== ESTADO_REPARTIDOR.EN_PEDIDO) return;
    const [turno] = await conmysql.query(`
        SELECT hr.id_reserva
        FROM horario_reservas hr
        INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
        WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1
          AND hd.horario_fecha = CURDATE() AND CURTIME() BETWEEN hd.horario_hora_inicio AND hd.horario_hora_fin
        LIMIT 1
    `, [id_repartidor]);
    const nuevoEstado = turno.length ? ESTADO_REPARTIDOR.REPARTIENDO : ESTADO_REPARTIDOR.DESCONECTADO;
    await conmysql.query(`UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?`, [nuevoEstado, id_repartidor]);
};

const validarTransicionEstado = async (req, pedido, nuevoIdEstado) => {
    const estadoActual = String(pedido.estado_nombre || "").trim().toUpperCase();
    const [estados] = await conmysql.query(`SELECT id_estado,estado_tipo,estado_nombre,estado_activo FROM estados WHERE id_estado = ? LIMIT 1`, [nuevoIdEstado]);
    if (!estados.length) return { valido: false, status: 400, message: "El estado solicitado no existe." };
    const estado = estados[0];
    if (String(estado.estado_tipo || "").trim().toUpperCase() !== "PEDIDO") return { valido: false, status: 400, message: "El estado solicitado no pertenece al flujo de estados de pedidos." };
    if (Number(estado.estado_activo) !== 1) return { valido: false, status: 400, message: "El estado solicitado está inactivo." };
    const nuevoEstado = String(estado.estado_nombre || "").trim().toUpperCase();
    if (Number(pedido.id_estado) === Number(nuevoIdEstado)) return { valido: true, mismoEstado: true, estadoActual, nuevoEstado };
    const transiciones = TRANSICIONES_ESTADO[estadoActual];
    if (!transiciones) return { valido: false, status: 403, message: `El pedido está en ${estadoActual} y no puede cambiarse a ${nuevoEstado}.` };
    const rolesPermitidos = transiciones[nuevoEstado];
    if (!rolesPermitidos) return { valido: false, status: 403, message: `No se permite cambiar el pedido de ${estadoActual} a ${nuevoEstado}.` };
    if (!tieneRol(req, rolesPermitidos)) return { valido: false, status: 403, message: `El rol ${obtenerRol(req) || "SIN_ROL"} no puede cambiar el estado de ${estadoActual} a ${nuevoEstado}.` };
    if (estadoActual === "PENDIENTE" && nuevoEstado === "EN_PREPARACION") {
      const esTransferencia = String(pedido.metodo_pago_nombre || "").trim().toUpperCase() === "TRANSFERENCIA";
      const esTarjeta = Number(pedido.id_metodo_pago) === ID_METODO_PAGO_TARJETA;
        if ((esTransferencia || esTarjeta) && Number(pedido.pedido_pago_confirmado) !== 1) {
            return {
                valido: false,
                status: 403,
                codigo: "PAGO_PENDIENTE_CONFIRMACION",
                message: `El pedido utiliza ${esTarjeta ? "TARJETA" : "TRANSFERENCIA"} y el pago todavía no ha sido confirmado por SOPORTE o ADMINISTRADOR.`
            };
        }
    }
    return { valido: true, mismoEstado: false, estadoActual, nuevoEstado };
};

const ocultarPedidoPin = (pedido, req) => {
    if (!pedido) return pedido;
    const copia = { ...pedido };
    if (!tieneRol(req, ["CLIENTE"])) delete copia.pedido_pin;
    return copia;
};
const ocultarPedidosPin = (pedidos, req) => Array.isArray(pedidos) ? pedidos.map(p => ocultarPedidoPin(p, req)) : pedidos;

const verificarAccesoCliente = async (req, res, id_cliente) => {
    if (!req.usuario) {
        res.status(401).json({ success: false, message: "Usuario no autenticado." });
        return false;
    }
    if (esAdministrativo(req)) return true;
    if (tieneRol(req, ["CLIENTE"])) {
        const id_usuario = obtenerIdUsuario(req);
        if (!id_usuario) {
            res.status(401).json({ success: false, message: "No se pudo identificar al usuario autenticado." });
            return false;
        }
        const clienteUsuario = await obtenerClienteDelUsuario(id_usuario);
        if (!clienteUsuario) {
            res.status(403).json({ success: false, message: "El usuario no tiene un cliente asociado." });
            return false;
        }
        if (Number(clienteUsuario) !== Number(id_cliente)) {
            res.status(403).json({ success: false, message: "No puedes acceder a información de otro cliente." });
            return false;
        }
        return true;
    }
    res.status(403).json({ success: false, message: "No tienes permisos para acceder a pedidos." });
    return false;
};

const obtenerPedidoPorIdInterno = async id_pedido => {
    const [pedidos] = await conmysql.query(`
        SELECT p.*,c.cliente_codigo,c.id_usuario AS cliente_id_usuario,u.usuario_cedula AS cliente_cedula,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
        l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,
        r.id_repartidor,r.id_usuario AS repartidor_id_usuario,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,r.repartidor_calificacion,r.repartidor_posicion_ranking,r.repartidor_total_pedidos,r.repartidor_pedidos_aceptados,r.repartidor_pedidos_rechazados,r.repartidor_porcentaje_aceptacion,
        ur.usuario_nombre AS repartidor_nombre,ur.usuario_apellido AS repartidor_apellido,ur.usuario_nombre_completo AS repartidor_nombre_completo,ur.usuario_telefono AS repartidor_telefono,ur.usuario_foto AS repartidor_foto
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
        LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
        LEFT JOIN locales l ON p.id_local=l.id_local
        LEFT JOIN estados e ON p.id_estado=e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
        LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
        LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
        WHERE p.id_pedido=? LIMIT 1
    `, [id_pedido]);
    return pedidos.length ? pedidos[0] : null;
};

const obtenerDetallesPedido = async id_pedido => {
    const [detalles] = await conmysql.query(`
        SELECT pd.*,p.pedido_codigo,lp.id_local,lp.id_producto,l.local_nombre_comercial,pr.producto_codigo,pr.producto_nombre,pr.producto_descripcion
        FROM pedido_detalles pd
        LEFT JOIN pedidos p ON pd.id_pedido=p.id_pedido
        LEFT JOIN local_productos lp ON pd.id_local_producto=lp.id_local_producto
        LEFT JOIN locales l ON lp.id_local=l.id_local
        LEFT JOIN productos pr ON lp.id_producto=pr.id_producto
        WHERE pd.id_pedido=? ORDER BY pd.id_pedido_detalle ASC
    `, [id_pedido]);
    return detalles;
};

export const getPedidos = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const roles = obtenerRoles(req), id_usuario = obtenerIdUsuario(req);
        if (esAdministrativo(req)) {
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,c.id_usuario AS cliente_id_usuario,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_cedula AS cliente_cedula,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
                l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor ORDER BY p.id_pedido DESC
            `);
            return res.json(ocultarPedidosPin(result, req));
        }
      
      if (tieneRol(req, ["LOCAL"])) {
        const local = await obtenerLocalDelUsuario(req);
        if (!local) return res.status(403).json({ success: false, message: "El usuario LOCAL no tiene un registro asociado en la tabla locales." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
            l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,
            r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,r.repartidor_calificacion,
            ur.usuario_nombre_completo AS repartidor_nombre_completo,ur.usuario_telefono AS repartidor_telefono,ur.usuario_foto AS repartidor_foto
            FROM pedidos p
            LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
            LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
            INNER JOIN locales l ON p.id_local=l.id_local
            LEFT JOIN estados e ON p.id_estado=e.id_estado
            LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
            LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
            WHERE p.id_local=?
              AND (
                p.pedido_pago_confirmado = 1
                OR (
                  UPPER(TRIM(COALESCE(mp.metodo_pago_nombre,''))) <> 'TRANSFERENCIA'
                  AND COALESCE(p.id_metodo_pago,0) <> 3
                )
              )
            ORDER BY p.id_pedido DESC
        `, [local.id_local]);
        return res.json(ocultarPedidosPin(result, req));
    }
        if (tieneRol(req, ["CLIENTE"])) {
            if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });
            const id_cliente = await obtenerClienteDelUsuario(id_usuario);
            if (!id_cliente) return res.json([]);
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
                WHERE p.id_cliente=? ORDER BY p.id_pedido DESC
            `, [id_cliente]);
            return res.json(ocultarPedidosPin(result, req));
        }
        if (tieneRol(req, ["REPARTIDOR"])) {
            if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });
            const id_repartidor = await obtenerRepartidorDelUsuario(id_usuario);
            if (!id_repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,u.usuario_nombre_completo AS cliente_nombre,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
                WHERE p.id_repartidor=? ORDER BY p.id_pedido DESC
            `, [id_repartidor]);
            return res.json(ocultarPedidosPin(result, req));
        }
        return res.status(403).json({ success: false, message: `Los roles [${roles.join(", ") || "SIN_ROL"}] no tienen permisos para consultar pedidos.` });
    } catch (error) {
        console.error("[Pedidos] Error getPedidos:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos" });
    }
};

export const getPedidosPorCliente = async (req, res) => {
    try {
        const { id_cliente } = req.params;
        if (!esIdValido(id_cliente)) return res.status(400).json({ success: false, message: "El ID del cliente no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!esAdministrativo(req) && tieneRol(req, ["CLIENTE"])) {
            if (!(await verificarAccesoCliente(req, res, id_cliente))) return;
        } else if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos del cliente." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.id_cliente=? ORDER BY p.id_pedido DESC
        `, [id_cliente]);
        return res.json(ocultarPedidosPin(result, req));
    } catch (error) {
        console.error("[Pedidos] Error getPedidosPorCliente:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos del cliente" });
    }
};

export const getPedidoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const pedido = await obtenerPedidoPorIdInterno(id);
        if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        if (esAdministrativo(req)) {
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["CLIENTE"])) {
            if (!(await verificarAccesoCliente(req, res, pedido.id_cliente))) return;
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(pedido.id_local) !== Number(local.id_local)) return res.status(403).json({ success: false, message: "No puedes acceder a pedidos de otro local." });
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        return res.status(403).json({ success: false, message: "No tienes permisos para acceder a este pedido." });
    } catch (error) {
        console.error("[Pedidos] Error getPedidoPorId:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedido" });
    }
};

export const getPedidoDetalles = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!await obtenerPedidoPorIdInterno(id)) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        return res.json({ success: true, detalles: await obtenerDetallesPedido(id) });
    } catch (error) {
        console.error("[Pedidos] Error getPedidoDetalles:", error);
        return res.status(500).json({ success: false, message: "Error al obtener los detalles del pedido." });
    }
};

export const getPedidosPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;
        if (!esIdValido(id_local)) return res.status(400).json({ success: false, message: "El ID del local no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(local.id_local) !== Number(id_local)) return res.status(403).json({ success: false, message: "No puedes consultar pedidos de otro local." });
        } else if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos de este local." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario INNER JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.id_local=?
              AND (
                p.pedido_pago_confirmado = 1
                OR (
                  UPPER(TRIM(COALESCE(mp.metodo_pago_nombre,''))) <> 'TRANSFERENCIA'
                  AND COALESCE(p.id_metodo_pago,0) <> 3
                )
              )
            ORDER BY p.id_pedido DESC
        `, [id_local]);
        return res.json(ocultarPedidosPin(result, req));
    } catch (error) {
        console.error("[Pedidos] Error getPedidosPorLocal:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos del local" });
    }
};

export const getPedidoPorCodigo = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const { codigo } = req.params;
        if (!codigo || !String(codigo).trim()) return res.status(400).json({ success: false, message: "El código del pedido es obligatorio." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.pedido_codigo=? LIMIT 1
        `, [String(codigo).trim()]);
        if (!result.length) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        const pedido = result[0];
        if (esAdministrativo(req)) return res.json(ocultarPedidoPin(pedido, req));
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(pedido.id_local) !== Number(local.id_local)) return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["CLIENTE"])) {
            if (!(await verificarAccesoCliente(req, res, pedido.id_cliente))) return;
            return res.json(ocultarPedidoPin(pedido, req));
        }
        return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos." });
    } catch (error) {
        console.error("[Pedidos] Error getPedidoPorCodigo:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedido" });
    }
};

export const getPedidosPorEstado = async (req, res) => {
    try {
        const { id_estado } = req.params;
        if (!esIdValido(id_estado)) return res.status(400).json({ success: false, message: "El ID del estado no es válido." });
        if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos por estado." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre_completo AS cliente_nombre,l.local_codigo,l.local_nombre_comercial,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.id_estado=? ORDER BY p.id_pedido DESC
        `, [id_estado]);
        return res.json(ocultarPedidosPin(result, req));
    } catch (error) {
        console.error("[Pedidos] Error getPedidosPorEstado:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos por estado" });
    }
};

export const postPedido = async (req, res) => {
    const conexion = await conmysql.getConnection();
    let id_pedido = null, pedido_pin = null, transaccionIniciada = false;
    try {
        if (!req.usuario) {
            conexion.release();
            return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        }
        if (!tieneRol(req, ["CLIENTE"])) {
            conexion.release();
            return res.status(403).json({ success: false, message: "Solo los clientes pueden crear pedidos." });
        }
        let { id_cliente, id_local, id_local_sucursal, id_metodo_pago, pedido_cantidad_productos, pedido_subtotal_local, pedido_subtotal_app, pedido_adicional_volumen, pedido_carrera, pedido_propina, pedido_total, pedido_distancia_km, pedido_tiempo_estimado, pedido_cliente_latitud, pedido_cliente_longitud, pedido_local_latitud, pedido_local_longitud, pedido_observacion, id_estado, pedido_fecha, pedido_fecha_entrega, productos, detalles } = req.body;
        const id_usuario = obtenerIdUsuario(req);
        if (!id_usuario) {
            conexion.release();
            return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });
        }
        const clienteUsuario = await obtenerClienteDelUsuario(id_usuario);
        if (!clienteUsuario) {
            conexion.release();
            return res.status(403).json({ success: false, message: "El usuario no tiene un cliente asociado." });
        }
        id_cliente = clienteUsuario;
        if (!id_local) {
            conexion.release();
            return res.status(400).json({ success: false, message: "El local es obligatorio." });
        }
        const listaDetalles = Array.isArray(detalles) ? detalles : productos;
        if (!Array.isArray(listaDetalles) || !listaDetalles.length) {
            conexion.release();
            return res.status(400).json({ success: false, message: "El pedido debe contener al menos un producto." });
        }

        await conexion.beginTransaction();
        transaccionIniciada = true;
        const [clientes] = await conexion.query(`SELECT id_cliente FROM clientes WHERE id_cliente=? FOR UPDATE`, [id_cliente]);
        if (!clientes.length) throw new Error("El cliente no existe");
        const [locales] = await conexion.query(`SELECT id_local,local_latitud,local_longitud FROM locales WHERE id_local=? FOR UPDATE`, [id_local]);
        if (!locales.length) throw new Error("El local no existe");
        const local = locales[0];
        if (pedido_local_latitud === undefined || pedido_local_latitud === null) pedido_local_latitud = local.local_latitud;
        if (pedido_local_longitud === undefined || pedido_local_longitud === null) pedido_local_longitud = local.local_longitud;

        const metodoPago = await obtenerMetodoPagoPorId(id_metodo_pago);
        if (!metodoPago) throw new Error("El método de pago no existe.");
        if (Number(metodoPago.metodo_pago_estado) !== 1) throw new Error("El método de pago está inactivo.");
        const esTransferencia = esMetodoTransferencia(metodoPago);
        const esTarjeta = esMetodoTarjeta(metodoPago);
        const esBilletera = esMetodoBilletera(metodoPago);
        //const pagoConfirmadoInicial = esTransferencia ? 0 : 1;
        const pagoConfirmadoInicial = requierePagoConfirmado(metodoPago) ? 0 : 1;
        const [ultimo] = await conexion.query(`SELECT pedido_codigo FROM pedidos ORDER BY id_pedido DESC LIMIT 1 FOR UPDATE`);
        let billeteraCliente = null;

        if (esBilletera) {
            const [billeteras] = await conexion.query(`SELECT id_billeteracliente,billeteracliente_saldo FROM billeteracliente WHERE id_usuario=? LIMIT 1 FOR UPDATE`, [id_usuario]);
            if (!billeteras.length) throw new Error("El cliente no tiene una billetera registrada.");
            billeteraCliente = billeteras[0];
            const saldo = Number(billeteraCliente.billeteracliente_saldo), totalPedido = Number(pedido_total ?? 0);
            if (totalPedido <= 0) throw new Error("El total del pedido debe ser mayor a cero.");
            if (saldo < totalPedido) throw new Error(`Saldo insuficiente en la billetera. Saldo disponible: ${saldo.toFixed(2)}`);
        }

        let numero = 1;
        if (ultimo.length && ultimo[0].pedido_codigo) {
            const match = String(ultimo[0].pedido_codigo).match(/(\d+)$/);
            if (match) numero = parseInt(match[1], 10) + 1;
        }
        const pedido_codigo = `PED-${String(numero).padStart(5, "0")}`;
        pedido_pin = generarPedidoPin();
        const estadoInicial = await obtenerIdEstadoPorNombre("PENDIENTE", "PEDIDO");
        if (!estadoInicial) throw new Error('No existe el estado "PENDIENTE" en la tabla estados.');

        const [result] = await conexion.query(`
            INSERT INTO pedidos (pedido_codigo,pedido_pin,id_cliente,id_local,id_repartidor,id_local_sucursal,id_metodo_pago,pedido_fecha,pedido_cantidad_productos,pedido_subtotal_local,pedido_subtotal_app,pedido_adicional_volumen,pedido_carrera,pedido_propina,pedido_total,pedido_distancia_km,pedido_tiempo_estimado,pedido_cliente_latitud,pedido_cliente_longitud,pedido_local_latitud,pedido_local_longitud,pedido_observacion,id_estado,pedido_fecha_entrega,pedido_pago_confirmado)
            VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [pedido_codigo, pedido_pin, id_cliente, id_local, id_local_sucursal ?? null, id_metodo_pago, convertirFechaMySQL(pedido_fecha ?? new Date()), Number(pedido_cantidad_productos ?? 0), Number(pedido_subtotal_local ?? 0), Number(pedido_subtotal_app ?? 0), Number(pedido_adicional_volumen ?? 0), Number(pedido_carrera ?? 0), Number(pedido_propina ?? 0), Number(pedido_total ?? 0), Number(pedido_distancia_km ?? 0), Number(pedido_tiempo_estimado ?? 0), pedido_cliente_latitud ?? null, pedido_cliente_longitud ?? null, pedido_local_latitud ?? null, pedido_local_longitud ?? null, pedido_observacion ?? null, estadoInicial, pedido_fecha_entrega ?? null, pagoConfirmadoInicial]);

        id_pedido = result.insertId;
        const detallesRegistrados = [];

        for (const detalle of listaDetalles) {
            const id_local_producto = Number(detalle.id_local_producto), cantidad = Number(detalle.pedido_detalle_cantidad ?? detalle.cantidad ?? 0);
            if (!id_local_producto || cantidad <= 0) throw new Error("Datos inválidos en los detalles del producto.");
            const [productosLocal] = await conexion.query(`SELECT lp.id_local_producto,pr.producto_nombre,pr.producto_estado FROM local_productos lp INNER JOIN productos pr ON lp.id_producto=pr.id_producto WHERE lp.id_local_producto=? AND lp.id_local=? FOR UPDATE`, [id_local_producto, id_local]);
            if (!productosLocal.length) throw new Error("El producto no pertenece al local especificado.");
            const precioLocal = Number(detalle.pedido_detalle_precio_local ?? detalle.precioLocal ?? 0), precioApp = Number(detalle.pedido_detalle_precio_app ?? detalle.precioApp ?? 0);
            const subtotalLocal = Number(detalle.pedido_detalle_subtotal_local ?? precioLocal * cantidad), subtotalApp = Number(detalle.pedido_detalle_subtotal_app ?? precioApp * cantidad);
            const [detalleResult] = await conexion.query(`INSERT INTO pedido_detalles (id_pedido,id_local_producto,pedido_detalle_cantidad,pedido_detalle_precio_local,pedido_detalle_precio_app,pedido_detalle_subtotal_local,pedido_detalle_subtotal_app,pedido_detalle_observacion) VALUES (?,?,?,?,?,?,?,?)`, [id_pedido, id_local_producto, cantidad, precioLocal, precioApp, subtotalLocal, subtotalApp, detalle.pedido_detalle_observacion ?? detalle.observacion ?? null]);
            detallesRegistrados.push({ id_pedido_detalle: detalleResult.insertId, id_local_producto, cantidad, subtotalApp });
        }

        let movimientoBilletera = null;
        if (esBilletera) {
            const montoDebito = Number(pedido_total ?? 0), saldoAnterior = Number(billeteraCliente.billeteracliente_saldo), saldoNuevo = saldoAnterior - montoDebito;
            const [movimientoResult] = await conexion.query(`INSERT INTO billeteracliente_movimiento (id_billeteracliente,billeteracliente_movimiento_tipo,billeteracliente_movimiento_monto,billeteracliente_movimiento_saldo_anterior,billeteracliente_movimiento_saldo_nuevo,billeteracliente_movimiento_concepto,billeteracliente_movimiento_referencia,id_pedido) VALUES (?,'DEBITO',?,?,?,?,?,?)`, [billeteraCliente.id_billeteracliente, montoDebito, saldoAnterior, saldoNuevo, `Pago de pedido ${pedido_codigo}`, pedido_codigo, id_pedido]);
            await conexion.query(`UPDATE billeteracliente SET billeteracliente_saldo=? WHERE id_billeteracliente=?`, [saldoNuevo, billeteraCliente.id_billeteracliente]);
            movimientoBilletera = { id_billeteracliente_movimiento: movimientoResult.insertId, id_billeteracliente: billeteraCliente.id_billeteracliente, tipo: "DEBITO", monto: montoDebito, saldo_anterior: saldoAnterior, saldo_nuevo: saldoNuevo };
        }

        await conexion.commit();
        transaccionIniciada = false;
        const pedidoFinal = await obtenerPedidoPorIdInterno(id_pedido);
        return res.status(201).json({
            success: true,
            id_pedido,
            pedido_codigo,
            id_cliente,
            id_local,
            id_repartidor: pedidoFinal?.id_repartidor ?? null,
            id_estado: pedidoFinal?.id_estado ?? estadoInicial,
            estado_nombre: pedidoFinal?.estado_nombre ?? null,
            id_metodo_pago: pedidoFinal?.id_metodo_pago ?? id_metodo_pago,
            metodo_pago_nombre: pedidoFinal?.metodo_pago_nombre ?? null,
            pedido_pago_confirmado: Number(pedidoFinal?.pedido_pago_confirmado ?? pagoConfirmadoInicial),
            //message: esTransferencia ? "Pedido registrado. La transferencia queda pendiente de confirmación por SOPORTE o ADMINISTRADOR." : esBilletera ? "Pedido registrado y pagado con Billetera." : "Pedido registrado con éxito",
            message: esTransferencia
                ? "Pedido registrado. La transferencia queda pendiente de confirmación por SOPORTE o ADMINISTRADOR."
                : esTarjeta
                    ? "Pedido registrado. El pago con tarjeta queda pendiente de confirmación por SOPORTE o ADMINISTRADOR."
                    : esBilletera
                        ? "Pedido registrado y pagado con Billetera."
                        : "Pedido registrado con éxito",
            detalles: detallesRegistrados,
            pedido_pin
        });
    } catch (error) {
        if (transaccionIniciada) {
            try { await conexion.rollback(); } catch (e) { console.error("[Pedidos] Error rollback:", e); }
        }
        console.error("[Pedidos] Error postPedido:", error);
        return res.status(500).json({ success: false, message: error.message || "Error al registrar pedido" });
    } finally {
        conexion.release();
    }
};

export const putPedido = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const pedido = await obtenerPedidoPorIdInterno(id);
        if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        if (tieneRol(req, ["CENTRAL", "SUPERVISOR"])) return res.status(403).json({ success: false, message: "CENTRAL y SUPERVISOR no tienen permisos para modificar pedidos." });

        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes modificar este pedido." });
        }
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(pedido.id_local) !== Number(local.id_local)) return res.status(403).json({ success: false, message: "No puedes modificar pedidos de otro local." });
        }
        if (!puedeModificarPedidos(req)) return res.status(403).json({ success: false, message: "No tienes permisos para modificar este pedido." });

        let transicionAEnPreparacion = false, liberaRepartidor = false;
        if (req.body.id_estado !== undefined && req.body.id_estado !== null) {
            const validacionEstado = await validarTransicionEstado(req, pedido, req.body.id_estado);
            if (!validacionEstado.valido) return res.status(validacionEstado.status).json({ success: false, message: validacionEstado.message, codigo: validacionEstado.codigo ?? undefined });

            transicionAEnPreparacion = !validacionEstado.mismoEstado && validacionEstado.estadoActual === "PENDIENTE" && validacionEstado.nuevoEstado === "EN_PREPARACION";
            liberaRepartidor = !validacionEstado.mismoEstado && validacionEstado.estadoActual === "EN_CAMINO" && ["ENTREGADO", "NO_ENTREGADO"].includes(validacionEstado.nuevoEstado);
        }

        const campos = [], valores = [];
        for (const campo of ["id_estado", "pedido_observacion", "pedido_fecha_entrega"]) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo}=?`);
                valores.push(req.body[campo]);
            }
        }
        if (campos.length) {
            valores.push(id);
            await conmysql.query(`UPDATE pedidos SET ${campos.join(",")} WHERE id_pedido=?`, valores);
        }

        let asignacion = null, pagoLocal = null, pagoRepartidor = null;
        if (transicionAEnPreparacion) {
            try { asignacion = await asignarRepartidorAutomaticamente(Number(id)); }
            catch (error) { console.error("[Pedidos] Error asignando repartidor:", error); }
        }

        if (liberaRepartidor) {
            // Los pagos solo corresponden a una entrega completada.
            if (req.body.id_estado !== undefined) {
                const estadoDestino = await conmysql.query(`SELECT estado_nombre FROM estados WHERE id_estado=? LIMIT 1`, [req.body.id_estado]);
                const nombreEstadoDestino = String(estadoDestino[0]?.[0]?.estado_nombre || "").trim().toUpperCase();
                if (nombreEstadoDestino === "ENTREGADO") {
                    try { pagoLocal = await crearPagoLocalDesdePedido(Number(id)); }
                    catch (error) { console.error("[Pedidos] Error creando pago local:", error); }
                    try { pagoRepartidor = await crearPagoRepartidorDesdePedido(Number(id)); }
                    catch (error) { console.error("[Pedidos] Error creando pago repartidor:", error); }
                }
            }
            try { await sincronizarEstadoRepartidorTrasEntrega(pedido.id_repartidor); }
            catch (error) { console.error("[Pedidos] Error sincronizando estado del repartidor:", error); }
        }

        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        return res.json({ success: true, ...ocultarPedidoPin(pedidoActualizado, req), pago_local: pagoLocal, pago_repartidor: pagoRepartidor, asignacion });
    } catch (error) {
        console.error("[Pedidos] Error putPedido:", error);
        return res.status(500).json({ success: false, message: "Error al actualizar pedido" });
    }
};

export const patchPedido = async (req, res) => putPedido(req, res);

export const confirmarPagoPedido = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "ID no válido." });
        if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "No tienes permisos para confirmar pagos." });
        const [resultado] = await conmysql.query(`UPDATE pedidos SET pedido_pago_confirmado=1 WHERE id_pedido=?`, [id]);
        if (!resultado.affectedRows) return res.status(404).json({ success: false, message: "Pedido no encontrado." });
        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        return res.json({ success: true, message: "Pago confirmado correctamente.", ...ocultarPedidoPin(pedidoActualizado, req) });
    } catch (error) {
        console.error("[Pedidos] Error confirmarPagoPedido:", error);
        return res.status(500).json({ success: false, message: "Error al confirmar pago del pedido." });
    }
};

// Entrega mediante PIN y libera al repartidor de EN_PEDIDO.
export const entregarPedidoConPin = async (req, res) => {
    try {
        const { id } = req.params, { pedido_pin } = req.body;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "ID no válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const pedido = await obtenerPedidoPorIdInterno(id);
        if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado." });

        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes entregar este pedido." });
        } else if (!esAdministrativo(req)) {
            return res.status(403).json({ success: false, message: "No tienes permisos para entregar este pedido." });
        }

        if (String(pedido.pedido_pin).trim() !== String(pedido_pin ?? "").trim()) return res.status(400).json({ success: false, message: "El PIN de entrega es incorrecto." });

        const idEstadoEntregado = await obtenerIdEstadoPorNombre("ENTREGADO", "PEDIDO");
        if (!idEstadoEntregado) return res.status(500).json({ success: false, message: 'No existe el estado "ENTREGADO" para pedidos.' });
        if (Number(pedido.id_estado) === Number(idEstadoEntregado)) return res.status(409).json({ success: false, message: "El pedido ya se encuentra ENTREGADO." });

        await conmysql.query(`UPDATE pedidos SET id_estado=?,pedido_fecha_entrega=NOW() WHERE id_pedido=?`, [idEstadoEntregado, id]);

        let pagoLocal = null, pagoRepartidor = null;
        try { pagoLocal = await crearPagoLocalDesdePedido(Number(id)); }
        catch (error) { console.error("[Pedidos] Error creando pago local al entregar por PIN:", error); }
        try { pagoRepartidor = await crearPagoRepartidorDesdePedido(Number(id)); }
        catch (error) { console.error("[Pedidos] Error creando pago repartidor al entregar por PIN:", error); }

        // Después de la entrega, el repartidor deja EN_PEDIDO.
        try { await sincronizarEstadoRepartidorTrasEntrega(pedido.id_repartidor); }
        catch (error) { console.error("[Pedidos] Error sincronizando estado del repartidor tras PIN:", error); }

        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        return res.json({ success: true, message: "Pedido entregado con éxito.", pedido: ocultarPedidoPin(pedidoActualizado, req), pago_local: pagoLocal, pago_repartidor: pagoRepartidor });
    } catch (error) {
        console.error("[Pedidos] Error entregarPedidoConPin:", error);
        return res.status(500).json({ success: false, message: "Error al entregar pedido." });
    }
};

const ESTADOS_PEDIDO_NO_CANCELABLES = ["ENTREGADO", "NO_ENTREGADO", "CANCELADO"];

// Cancelación con reglas por rol: CLIENTE/LOCAL/REPARTIDOR solo antes de ser aceptado; SOPORTE/ADMINISTRATIVOS siempre.
export const cancelarPedido = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        const { id } = req.params;
        const motivo = req.body?.motivo ? String(req.body.motivo).trim() : null;

        if (!esIdValido(id)) { conexion.release(); return res.status(400).json({ success: false, message: "El ID del pedido no es válido." }); }
        if (!req.usuario) { conexion.release(); return res.status(401).json({ success: false, message: "Usuario no autenticado." }); }

        await conexion.beginTransaction();

        const [pedidos] = await conexion.query(`
            SELECT p.*, e.estado_nombre
            FROM pedidos p LEFT JOIN estados e ON p.id_estado = e.id_estado
            WHERE p.id_pedido = ? LIMIT 1 FOR UPDATE
        `, [id]);

        if (!pedidos.length) { await conexion.rollback(); return res.status(404).json({ success: false, message: "Pedido no encontrado." }); }

        const pedido = pedidos[0];
        const estadoActual = String(pedido.estado_nombre || "").trim().toUpperCase();

        if (ESTADOS_PEDIDO_NO_CANCELABLES.includes(estadoActual)) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: `El pedido está en ${estadoActual} y no puede cancelarse.`, codigo: "PEDIDO_NO_CANCELABLE" });
        }

        let autorizado = false;

        if (esAdministrativo(req)) {
            autorizado = true;
        } else if (tieneRol(req, ["CLIENTE"])) {
            const id_usuario = obtenerIdUsuario(req);
            const clienteUsuario = id_usuario ? await obtenerClienteDelUsuario(id_usuario) : null;
            if (!clienteUsuario || Number(clienteUsuario) !== Number(pedido.id_cliente)) {
                await conexion.rollback();
                return res.status(403).json({ success: false, message: "No puedes cancelar el pedido de otro cliente." });
            }
            // El LOCAL aún no lo aceptó mientras esté PENDIENTE.
            autorizado = estadoActual === "PENDIENTE";
        } else if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(local.id_local) !== Number(pedido.id_local)) {
                await conexion.rollback();
                return res.status(403).json({ success: false, message: "No puedes cancelar pedidos de otro local." });
            }
            autorizado = estadoActual === "PENDIENTE";
        } else if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (!id_repartidor || Number(pedido.id_repartidor) !== Number(id_repartidor)) {
                await conexion.rollback();
                return res.status(403).json({ success: false, message: "No puedes cancelar un pedido que no tienes asignado." });
            }
            // Solo si aún no aceptó la oferta (sigue OFERTADO) o no hay asignación activa registrada.
            const asignacion = await obtenerAsignacionActiva(conexion, id);
            const estadoAsignacion = String(asignacion?.estado_nombre || "").trim().toUpperCase();
            autorizado = !asignacion || estadoAsignacion === "OFERTADO";
        } else {
            await conexion.rollback();
            return res.status(403).json({ success: false, message: "Tu rol no tiene permisos para cancelar pedidos." });
        }

        if (!autorizado) {
            await conexion.rollback();
            return res.status(403).json({
                success: false,
                codigo: "CANCELACION_NO_PERMITIDA",
                message: "Ya no puedes cancelar este pedido en este punto del proceso. Contacta a SOPORTE."
            });
        }

        const idEstadoCancelado = await obtenerIdEstadoPorNombre("CANCELADO", "PEDIDO");
        if (!idEstadoCancelado) {
            await conexion.rollback();
            return res.status(500).json({ success: false, message: 'No existe el estado "CANCELADO" en la tabla estados. Ejecuta la migración.' });
        }

        await conexion.query(`
            UPDATE pedidos
            SET id_estado=?, pedido_cancelado_motivo=?, pedido_cancelado_por_rol=?, pedido_cancelado_por_usuario=?, pedido_cancelado_fecha=NOW()
            WHERE id_pedido=?
        `, [idEstadoCancelado, motivo, obtenerRol(req) || null, obtenerIdUsuario(req) || null, id]);

        await conexion.commit();

        // Libera al repartidor si tenía uno EN_PEDIDO asignado.
        if (pedido.id_repartidor) {
            try { await sincronizarEstadoRepartidorTrasEntrega(pedido.id_repartidor); }
            catch (error) { console.error("[Pedidos] Error liberando repartidor tras cancelación:", error); }
        }

        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        // TODO (paso 5): emitir notificación a cliente/local/repartidor involucrados.
        return res.json({ success: true, message: "Pedido cancelado correctamente.", ...ocultarPedidoPin(pedidoActualizado, req) });
    } catch (error) {
        try { await conexion.rollback(); } catch (e) { console.error("[Pedidos] Error rollback cancelarPedido:", e); }
        console.error("[Pedidos] Error cancelarPedido:", error);
        return res.status(500).json({ success: false, message: "Error al cancelar el pedido." });
    } finally {
        conexion.release();
    }
};

// Lista pedidos cancelados con filtros, solo para roles administrativos.
export const getPedidosCancelados = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos cancelados." });

        const idEstadoCancelado = await obtenerIdEstadoPorNombre("CANCELADO", "PEDIDO");
        if (!idEstadoCancelado) return res.json({ success: true, total: 0, pedidos: [] });

        const { fecha_desde, fecha_hasta, id_local, id_cliente, id_repartidor, motivo, cancelado_por_rol } = req.query;
        const condiciones = ["p.id_estado = ?"];
        const valores = [idEstadoCancelado];

        if (fecha_desde) { condiciones.push("p.pedido_cancelado_fecha >= ?"); valores.push(`${fecha_desde} 00:00:00`); }
        if (fecha_hasta) { condiciones.push("p.pedido_cancelado_fecha <= ?"); valores.push(`${fecha_hasta} 23:59:59`); }
        if (esIdValido(id_local)) { condiciones.push("p.id_local = ?"); valores.push(id_local); }
        if (esIdValido(id_cliente)) { condiciones.push("p.id_cliente = ?"); valores.push(id_cliente); }
        if (esIdValido(id_repartidor)) { condiciones.push("p.id_repartidor = ?"); valores.push(id_repartidor); }
        if (motivo && String(motivo).trim()) { condiciones.push("p.pedido_cancelado_motivo LIKE ?"); valores.push(`%${String(motivo).trim()}%`); }
        if (cancelado_por_rol && String(cancelado_por_rol).trim()) { condiciones.push("UPPER(p.pedido_cancelado_por_rol) = ?"); valores.push(String(cancelado_por_rol).trim().toUpperCase()); }

        const [result] = await conmysql.query(`
            SELECT p.*,
                   c.cliente_codigo, u.usuario_nombre_completo AS cliente_nombre, u.usuario_telefono AS cliente_telefono,
                   l.local_codigo, l.local_nombre_comercial,
                   e.estado_nombre, mp.metodo_pago_nombre,
                   r.repartidor_codigo, ur.usuario_nombre_completo AS repartidor_nombre_completo,
                   uc.usuario_nombre_completo AS cancelado_por_nombre
            FROM pedidos p
            LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
            LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
            LEFT JOIN locales l ON p.id_local=l.id_local
            LEFT JOIN estados e ON p.id_estado=e.id_estado
            LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
            LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
            LEFT JOIN usuarios uc ON p.pedido_cancelado_por_usuario=uc.id_usuario
            WHERE ${condiciones.join(" AND ")}
            ORDER BY p.pedido_cancelado_fecha DESC, p.id_pedido DESC
        `, valores);

        return res.json({ success: true, total: result.length, pedidos: ocultarPedidosPin(result, req) });
    } catch (error) {
        console.error("[Pedidos] Error getPedidosCancelados:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos cancelados." });
    }
};

export const deletePedido = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "ID no válido." });
        if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "No tienes permisos para eliminar pedidos." });
        await conexion.beginTransaction();
        await conexion.query(`DELETE FROM pedido_repartidores WHERE id_pedido=?`, [id]);
        await conexion.query(`DELETE FROM pedido_detalles WHERE id_pedido=?`, [id]);
        const [resultado] = await conexion.query(`DELETE FROM pedidos WHERE id_pedido=?`, [id]);
        if (!resultado.affectedRows) {
            await conexion.rollback();
            return res.status(404).json({ success: false, message: "Pedido no encontrado." });
        }
        await conexion.commit();
        return res.status(204).send();
    } catch (error) {
        await conexion.rollback();
        console.error("[Pedidos] Error deletePedido:", error);
        return res.status(500).json({ success: false, message: "Error al eliminar pedido." });
    } finally {
        conexion.release();
    }
};

export {
    obtenerRol, obtenerRoles, obtenerIdUsuario, obtenerClienteDelUsuario, obtenerLocalDelUsuario, obtenerRepartidorDelUsuario,
    verificarAccesoCliente, obtenerPedidoPorIdInterno, generarPedidoPin, ocultarPedidoPin, ocultarPedidosPin, esAdministrativo, tieneRol,
    sincronizarEstadoRepartidorTrasEntrega
};
 */

import { conmysql } from "../db.js";
import { asignarRepartidorAutomaticamente } from "./pedidorepartidoresCtrl.js";
import { crearPagoLocalDesdePedido } from "./pagoslocalesCtrl.js";
import { crearPagoRepartidorDesdePedido } from "./pagosrepartidorCtrl.js";
import { obtenerAsignacionActiva } from "./pedidorepartidoresCtrl.js";
//import { crearNotificacion, crearNotificacionesMasivas } from "./notificacionesCtrl.js";
//import { notificarNuevoPedidoAlLocal } from "./pushCtrl.js";
import { crearNotificacion, crearNotificacionesMasivas } from "./notificacionesCtrl.js";
import { notificationService } from "../notifications/notification.service.js";

const emitirEventoPedido = (evento, pedido) => {
  const io = global._io;
  if (!io || !pedido) return;

  if (pedido.id_local) {
    io.to(`local_${pedido.id_local}`).emit(`${evento}_local`, pedido);
  }
  if (pedido.id_pedido) {
    io.to(`pedido_${pedido.id_pedido}`).emit(evento, pedido);
  }
  io.emit(evento, pedido);
};

const ROLES_ADMINISTRATIVOS = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_MODIFICAR_PEDIDOS = ["LOCAL", "REPARTIDOR", "CLIENTE", "SOPORTE", "ADMINISTRADOR"];
const ESTADO_REPARTIDOR = { LISTO: 1, REPARTIENDO: 2, EN_PEDIDO: 3, EN_PAUSA: 4, DESCONECTADO: 5 };
const TRANSICIONES_ESTADO = {
    PENDIENTE: { EN_PREPARACION: ["LOCAL", "SOPORTE", "ADMINISTRADOR"] },
    EN_PREPARACION: { LISTO: ["LOCAL", "SOPORTE", "ADMINISTRADOR"] },
    LISTO: { EN_CAMINO: ["REPARTIDOR", "SOPORTE", "ADMINISTRADOR"] },
    EN_CAMINO: { ENTREGADO: ["REPARTIDOR", "SOPORTE", "ADMINISTRADOR"], NO_ENTREGADO: ["REPARTIDOR", "CLIENTE", "SOPORTE", "ADMINISTRADOR"] }
};

const obtenerRol = req => {
    const u = req.usuario || {};
    const rol = u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.usuario_role ?? u.rol_nombre ?? u.nombre_rol;
    if (String(rol).trim()) return String(rol).trim().toUpperCase();
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

const obtenerRoles = req => {
    const u = req.usuario || {};
    return [obtenerRol(req), ...(Array.isArray(u.roles) ? u.roles : [])].filter(Boolean).map(r => String(r).trim().toUpperCase()).filter((r, i, a) => a.indexOf(r) === i);
};
const tieneRol = (req, rolesPermitidos = []) => {
    const roles = rolesPermitidos.map(r => String(r).trim().toUpperCase());
    return obtenerRoles(req).some(r => roles.includes(r));
};
const esAdministrativo = req => tieneRol(req, ROLES_ADMINISTRATIVOS);
const puedeModificarPedidos = req => tieneRol(req, ROLES_MODIFICAR_PEDIDOS);
const obtenerIdUsuario = req => {
    const u = req.usuario || {};
    return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

const obtenerClienteDelUsuario = async id_usuario => {
    if (!id_usuario) return null;
    const [rows] = await conmysql.query(`SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
    return rows.length ? rows[0].id_cliente : null;
};

const obtenerLocalDelUsuario = async req => {
    const u = req.usuario || {}, id_usuario = obtenerIdUsuario(req);
    if (id_usuario) {
        const [locales] = await conmysql.query(`SELECT id_local,id_usuario,local_codigo,local_nombre_comercial,local_razon_social,local_telefono,local_email,local_latitud,local_longitud FROM locales WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
        if (locales.length) return locales[0];
    }
    const id_local_token = Number(u.id_local ?? u.local_id ?? u.idLocal ?? u.localId);
    if (Number.isInteger(id_local_token) && id_local_token > 0) {
        const [locales] = await conmysql.query(`SELECT id_local,id_usuario,local_codigo,local_nombre_comercial,local_razon_social,local_telefono,local_email,local_latitud,local_longitud FROM locales WHERE id_local = ? LIMIT 1`, [id_local_token]);
        if (locales.length) return locales[0];
    }
    return null;
};

const obtenerRepartidorDelUsuario = async id_usuario => {
    if (!id_usuario) return null;
    const [rows] = await conmysql.query(`SELECT id_repartidor FROM repartidores WHERE id_usuario = ? LIMIT 1`, [id_usuario]);
    return rows.length ? rows[0].id_repartidor : null;
};

const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;
const generarPedidoPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

const convertirFechaMySQL = fecha => {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) throw new Error("La fecha proporcionada no es válida");
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const obtenerIdEstadoPorNombre = async (nombreEstado, tipoEstado = null) => {
    let sql = `SELECT id_estado FROM estados WHERE UPPER(TRIM(estado_nombre)) = ?`;
    const valores = [String(nombreEstado).trim().toUpperCase()];
    if (tipoEstado) {
        sql += ` AND UPPER(TRIM(estado_tipo)) = ?`;
        valores.push(String(tipoEstado).trim().toUpperCase());
    }
    sql += ` AND estado_activo = 1 ORDER BY id_estado LIMIT 1`;
    const [rows] = await conmysql.query(sql, valores);
    return rows.length ? rows[0].id_estado : null;
};

const obtenerMetodoPagoPorId = async id_metodo_pago => {
    if (id_metodo_pago === undefined || id_metodo_pago === null) return null;
    const [rows] = await conmysql.query(`SELECT id_metodo_pago,metodo_pago_nombre,metodo_pago_descripcion,metodo_pago_estado FROM metodos_pago WHERE id_metodo_pago = ? LIMIT 1`, [id_metodo_pago]);
    return rows.length ? rows[0] : null;
};

const ID_METODO_PAGO_TARJETA = 3;
const esMetodoTransferencia = metodoPago => !!metodoPago && String(metodoPago.metodo_pago_nombre || "").trim().toUpperCase() === "TRANSFERENCIA";
const esMetodoTarjeta = metodoPago => Number(metodoPago?.id_metodo_pago) === ID_METODO_PAGO_TARJETA;
const esMetodoBilletera = metodoPago => Number(metodoPago?.id_metodo_pago) === 5;
const requierePagoConfirmado = metodoPago => esMetodoTransferencia(metodoPago) || esMetodoTarjeta(metodoPago);

// Libera al repartidor de EN_PEDIDO y respeta la vigencia de su turno actual.
const sincronizarEstadoRepartidorTrasEntrega = async id_repartidor => {
    if (!id_repartidor) return;
    const [rep] = await conmysql.query(`SELECT id_estado_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1`, [id_repartidor]);
    if (!rep.length || Number(rep[0].id_estado_repartidor) !== ESTADO_REPARTIDOR.EN_PEDIDO) return;
    const [turno] = await conmysql.query(`
        SELECT hr.id_reserva
        FROM horario_reservas hr
        INNER JOIN horarios_disponibles hd ON hd.id_horario_disponible = hr.id_horario_disponible
        WHERE hr.id_repartidor = ? AND hr.reserva_estado = 1
          AND hd.horario_fecha = CURDATE() AND CURTIME() BETWEEN hd.horario_hora_inicio AND hd.horario_hora_fin
        LIMIT 1
    `, [id_repartidor]);
    const nuevoEstado = turno.length ? ESTADO_REPARTIDOR.REPARTIENDO : ESTADO_REPARTIDOR.DESCONECTADO;
    await conmysql.query(`UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?`, [nuevoEstado, id_repartidor]);
};

const validarTransicionEstado = async (req, pedido, nuevoIdEstado) => {
    const estadoActual = String(pedido.estado_nombre || "").trim().toUpperCase();
    const [estados] = await conmysql.query(`SELECT id_estado,estado_tipo,estado_nombre,estado_activo FROM estados WHERE id_estado = ? LIMIT 1`, [nuevoIdEstado]);
    if (!estados.length) return { valido: false, status: 400, message: "El estado solicitado no existe." };
    const estado = estados[0];
    if (String(estado.estado_tipo || "").trim().toUpperCase() !== "PEDIDO") return { valido: false, status: 400, message: "El estado solicitado no pertenece al flujo de estados de pedidos." };
    if (Number(estado.estado_activo) !== 1) return { valido: false, status: 400, message: "El estado solicitado está inactivo." };
    const nuevoEstado = String(estado.estado_nombre || "").trim().toUpperCase();
    if (Number(pedido.id_estado) === Number(nuevoIdEstado)) return { valido: true, mismoEstado: true, estadoActual, nuevoEstado };
    const transiciones = TRANSICIONES_ESTADO[estadoActual];
    if (!transiciones) return { valido: false, status: 403, message: `El pedido está en ${estadoActual} y no puede cambiarse a ${nuevoEstado}.` };
    const rolesPermitidos = transiciones[nuevoEstado];
    if (!rolesPermitidos) return { valido: false, status: 403, message: `No se permite cambiar el pedido de ${estadoActual} a ${nuevoEstado}.` };
    if (!tieneRol(req, rolesPermitidos)) return { valido: false, status: 403, message: `El rol ${obtenerRol(req) || "SIN_ROL"} no puede cambiar el estado de ${estadoActual} a ${nuevoEstado}.` };
/*     if (estadoActual === "PENDIENTE" && nuevoEstado === "EN_PREPARACION") {
        const esTransferencia = String(pedido.metodo_pago_nombre || "").trim().toUpperCase() === "TRANSFERENCIA";
        if (esTransferencia && Number(pedido.pedido_pago_confirmado) !== 1) return { valido: false, status: 403, codigo: "PAGO_TRANSFERENCIA_PENDIENTE", message: "El pedido utiliza TRANSFERENCIA y el pago todavía no ha sido confirmado por SOPORTE o ADMINISTRADOR." };
    } */
    if (estadoActual === "PENDIENTE" && nuevoEstado === "EN_PREPARACION") {
      const esTransferencia = String(pedido.metodo_pago_nombre || "").trim().toUpperCase() === "TRANSFERENCIA";
      const esTarjeta = Number(pedido.id_metodo_pago) === ID_METODO_PAGO_TARJETA;
        if ((esTransferencia || esTarjeta) && Number(pedido.pedido_pago_confirmado) !== 1) {
            return {
                valido: false,
                status: 403,
                codigo: "PAGO_PENDIENTE_CONFIRMACION",
                message: `El pedido utiliza ${esTarjeta ? "TARJETA" : "TRANSFERENCIA"} y el pago todavía no ha sido confirmado por SOPORTE o ADMINISTRADOR.`
            };
        }
    }
    return { valido: true, mismoEstado: false, estadoActual, nuevoEstado };
};

const ocultarPedidoPin = (pedido, req) => {
    if (!pedido) return pedido;
    const copia = { ...pedido };
    if (!tieneRol(req, ["CLIENTE"])) delete copia.pedido_pin;
    return copia;
};
const ocultarPedidosPin = (pedidos, req) => Array.isArray(pedidos) ? pedidos.map(p => ocultarPedidoPin(p, req)) : pedidos;

const verificarAccesoCliente = async (req, res, id_cliente) => {
    if (!req.usuario) {
        res.status(401).json({ success: false, message: "Usuario no autenticado." });
        return false;
    }
    if (esAdministrativo(req)) return true;
    if (tieneRol(req, ["CLIENTE"])) {
        const id_usuario = obtenerIdUsuario(req);
        if (!id_usuario) {
            res.status(401).json({ success: false, message: "No se pudo identificar al usuario autenticado." });
            return false;
        }
        const clienteUsuario = await obtenerClienteDelUsuario(id_usuario);
        if (!clienteUsuario) {
            res.status(403).json({ success: false, message: "El usuario no tiene un cliente asociado." });
            return false;
        }
        if (Number(clienteUsuario) !== Number(id_cliente)) {
            res.status(403).json({ success: false, message: "No puedes acceder a información de otro cliente." });
            return false;
        }
        return true;
    }
    res.status(403).json({ success: false, message: "No tienes permisos para acceder a pedidos." });
    return false;
};

/* const obtenerPedidoPorIdInterno = async id_pedido => {
    const [pedidos] = await conmysql.query(`
        SELECT p.*,c.cliente_codigo,c.id_usuario AS cliente_id_usuario,u.usuario_cedula AS cliente_cedula,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
        l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,
        r.id_repartidor,r.id_usuario AS repartidor_id_usuario,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,r.repartidor_calificacion,r.repartidor_posicion_ranking,r.repartidor_total_pedidos,r.repartidor_pedidos_aceptados,r.repartidor_pedidos_rechazados,r.repartidor_porcentaje_aceptacion,
        ur.usuario_nombre AS repartidor_nombre,ur.usuario_apellido AS repartidor_apellido,ur.usuario_nombre_completo AS repartidor_nombre_completo,ur.usuario_telefono AS repartidor_telefono
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
        LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
        LEFT JOIN locales l ON p.id_local=l.id_local
        LEFT JOIN estados e ON p.id_estado=e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
        LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
        LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
        WHERE p.id_pedido=? LIMIT 1
    `, [id_pedido]);
    return pedidos.length ? pedidos[0] : null;
}; */

const obtenerPedidoPorIdInterno = async id_pedido => {
    const [pedidos] = await conmysql.query(`
        SELECT p.*,c.cliente_codigo,c.id_usuario AS cliente_id_usuario,u.usuario_cedula AS cliente_cedula,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
        l.local_codigo,l.id_usuario AS local_id_usuario,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,
        r.id_repartidor,r.id_usuario AS repartidor_id_usuario,r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,r.repartidor_calificacion,r.repartidor_posicion_ranking,r.repartidor_total_pedidos,r.repartidor_pedidos_aceptados,r.repartidor_pedidos_rechazados,r.repartidor_porcentaje_aceptacion,
        ur.usuario_nombre AS repartidor_nombre,ur.usuario_apellido AS repartidor_apellido,ur.usuario_nombre_completo AS repartidor_nombre_completo,ur.usuario_telefono AS repartidor_telefono,ur.usuario_foto AS repartidor_foto
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
        LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
        LEFT JOIN locales l ON p.id_local=l.id_local
        LEFT JOIN estados e ON p.id_estado=e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
        LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
        LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
        WHERE p.id_pedido=? LIMIT 1
    `, [id_pedido]);
    return pedidos.length ? pedidos[0] : null;
};

const obtenerDetallesPedido = async id_pedido => {
    const [detalles] = await conmysql.query(`
        SELECT pd.*,p.pedido_codigo,lp.id_local,lp.id_producto,l.local_nombre_comercial,pr.producto_codigo,pr.producto_nombre,pr.producto_descripcion
        FROM pedido_detalles pd
        LEFT JOIN pedidos p ON pd.id_pedido=p.id_pedido
        LEFT JOIN local_productos lp ON pd.id_local_producto=lp.id_local_producto
        LEFT JOIN locales l ON lp.id_local=l.id_local
        LEFT JOIN productos pr ON lp.id_producto=pr.id_producto
        WHERE pd.id_pedido=? ORDER BY pd.id_pedido_detalle ASC
    `, [id_pedido]);
    return detalles;
};

export const getPedidos = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const roles = obtenerRoles(req), id_usuario = obtenerIdUsuario(req);
        if (esAdministrativo(req)) {
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,c.id_usuario AS cliente_id_usuario,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_cedula AS cliente_cedula,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
                l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor ORDER BY p.id_pedido DESC
            `);
            return res.json(ocultarPedidosPin(result, req));
        }
/*         if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local) return res.status(403).json({ success: false, message: "El usuario LOCAL no tiene un registro asociado en la tabla locales." });
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
                l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario INNER JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
                WHERE p.id_local=? ORDER BY p.id_pedido DESC
            `, [local.id_local]);
            return res.json(ocultarPedidosPin(result, req));
        } */
      if (tieneRol(req, ["LOCAL"])) {
        const local = await obtenerLocalDelUsuario(req);
        if (!local) return res.status(403).json({ success: false, message: "El usuario LOCAL no tiene un registro asociado en la tabla locales." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,
            l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,
            r.repartidor_codigo,r.repartidor_placa,r.repartidor_tipo_vehiculo,r.repartidor_calificacion,
            ur.usuario_nombre_completo AS repartidor_nombre_completo,ur.usuario_telefono AS repartidor_telefono,ur.usuario_foto AS repartidor_foto
            FROM pedidos p
            LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
            LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
            INNER JOIN locales l ON p.id_local=l.id_local
            LEFT JOIN estados e ON p.id_estado=e.id_estado
            LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
            LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
            WHERE p.id_local=?
              AND (
                p.pedido_pago_confirmado = 1
                OR (
                  UPPER(TRIM(COALESCE(mp.metodo_pago_nombre,''))) <> 'TRANSFERENCIA'
                  AND COALESCE(p.id_metodo_pago,0) <> 3
                )
              )
            ORDER BY p.id_pedido DESC
        `, [local.id_local]);
        return res.json(ocultarPedidosPin(result, req));
    }
        if (tieneRol(req, ["CLIENTE"])) {
            if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });
            const id_cliente = await obtenerClienteDelUsuario(id_usuario);
            if (!id_cliente) return res.json([]);
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
                WHERE p.id_cliente=? ORDER BY p.id_pedido DESC
            `, [id_cliente]);
            return res.json(ocultarPedidosPin(result, req));
        }
        if (tieneRol(req, ["REPARTIDOR"])) {
            if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });
            const id_repartidor = await obtenerRepartidorDelUsuario(id_usuario);
            if (!id_repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });
            const [result] = await conmysql.query(`
                SELECT p.*,c.cliente_codigo,u.usuario_nombre_completo AS cliente_nombre,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion
                FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
                WHERE p.id_repartidor=? ORDER BY p.id_pedido DESC
            `, [id_repartidor]);
            return res.json(ocultarPedidosPin(result, req));
        }
        return res.status(403).json({ success: false, message: `Los roles [${roles.join(", ") || "SIN_ROL"}] no tienen permisos para consultar pedidos.` });
    } catch (error) {
        console.error("[Pedidos] Error getPedidos:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos" });
    }
};

export const getPedidosPorCliente = async (req, res) => {
    try {
        const { id_cliente } = req.params;
        if (!esIdValido(id_cliente)) return res.status(400).json({ success: false, message: "El ID del cliente no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!esAdministrativo(req) && tieneRol(req, ["CLIENTE"])) {
            if (!(await verificarAccesoCliente(req, res, id_cliente))) return;
        } else if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos del cliente." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.id_cliente=? ORDER BY p.id_pedido DESC
        `, [id_cliente]);
        return res.json(ocultarPedidosPin(result, req));
    } catch (error) {
        console.error("[Pedidos] Error getPedidosPorCliente:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos del cliente" });
    }
};

export const getPedidoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const pedido = await obtenerPedidoPorIdInterno(id);
        if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        if (esAdministrativo(req)) {
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["CLIENTE"])) {
            if (!(await verificarAccesoCliente(req, res, pedido.id_cliente))) return;
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(pedido.id_local) !== Number(local.id_local)) return res.status(403).json({ success: false, message: "No puedes acceder a pedidos de otro local." });
            pedido.detalles = await obtenerDetallesPedido(id);
            return res.json(ocultarPedidoPin(pedido, req));
        }
        return res.status(403).json({ success: false, message: "No tienes permisos para acceder a este pedido." });
    } catch (error) {
        console.error("[Pedidos] Error getPedidoPorId:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedido" });
    }
};

export const getPedidoDetalles = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!await obtenerPedidoPorIdInterno(id)) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        return res.json({ success: true, detalles: await obtenerDetallesPedido(id) });
    } catch (error) {
        console.error("[Pedidos] Error getPedidoDetalles:", error);
        return res.status(500).json({ success: false, message: "Error al obtener los detalles del pedido." });
    }
};

export const getPedidosPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;
        if (!esIdValido(id_local)) return res.status(400).json({ success: false, message: "El ID del local no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(local.id_local) !== Number(id_local)) return res.status(403).json({ success: false, message: "No puedes consultar pedidos de otro local." });
        } else if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos de este local." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_email AS cliente_email,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,l.local_telefono,l.local_email,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario INNER JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.id_local=?
              AND (
                p.pedido_pago_confirmado = 1
                OR (
                  UPPER(TRIM(COALESCE(mp.metodo_pago_nombre,''))) <> 'TRANSFERENCIA'
                  AND COALESCE(p.id_metodo_pago,0) <> 3
                )
              )
            ORDER BY p.id_pedido DESC
        `, [id_local]);
        return res.json(ocultarPedidosPin(result, req));
    } catch (error) {
        console.error("[Pedidos] Error getPedidosPorLocal:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos del local" });
    }
};

export const getPedidoPorCodigo = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        const { codigo } = req.params;
        if (!codigo || !String(codigo).trim()) return res.status(400).json({ success: false, message: "El código del pedido es obligatorio." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre AS cliente_nombre,u.usuario_apellido AS cliente_apellido,u.usuario_nombre_completo AS cliente_nombre_completo,u.usuario_telefono AS cliente_telefono,l.local_codigo,l.local_nombre_comercial,l.local_razon_social,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.pedido_codigo=? LIMIT 1
        `, [String(codigo).trim()]);
        if (!result.length) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        const pedido = result[0];
        if (esAdministrativo(req)) return res.json(ocultarPedidoPin(pedido, req));
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(pedido.id_local) !== Number(local.id_local)) return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
            return res.json(ocultarPedidoPin(pedido, req));
        }
        if (tieneRol(req, ["CLIENTE"])) {
            if (!(await verificarAccesoCliente(req, res, pedido.id_cliente))) return;
            return res.json(ocultarPedidoPin(pedido, req));
        }
        return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos." });
    } catch (error) {
        console.error("[Pedidos] Error getPedidoPorCodigo:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedido" });
    }
};

export const getPedidosPorEstado = async (req, res) => {
    try {
        const { id_estado } = req.params;
        if (!esIdValido(id_estado)) return res.status(400).json({ success: false, message: "El ID del estado no es válido." });
        if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos por estado." });
        const [result] = await conmysql.query(`
            SELECT p.*,c.cliente_codigo,u.usuario_nombre_completo AS cliente_nombre,l.local_codigo,l.local_nombre_comercial,e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_descripcion,r.repartidor_codigo
            FROM pedidos p LEFT JOIN clientes c ON p.id_cliente=c.id_cliente LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario LEFT JOIN locales l ON p.id_local=l.id_local LEFT JOIN estados e ON p.id_estado=e.id_estado LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            WHERE p.id_estado=? ORDER BY p.id_pedido DESC
        `, [id_estado]);
        return res.json(ocultarPedidosPin(result, req));
    } catch (error) {
        console.error("[Pedidos] Error getPedidosPorEstado:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos por estado" });
    }
};

// Recalcula y persiste los totales del pedido a partir de sus detalles reales.
// Se ejecuta tras cualquier alta/edición/baja de un detalle para que
// pedidos.pedido_cantidad_productos y los subtotales nunca queden desincronizados.
const recalcularTotalesPedido = async (id_pedido) => {
    const [[totales]] = await conmysql.query(`
        SELECT
            COALESCE(SUM(pedido_detalle_cantidad), 0)        AS cantidad_total,
            COALESCE(SUM(pedido_detalle_subtotal_local), 0)  AS subtotal_local,
            COALESCE(SUM(pedido_detalle_subtotal_app), 0)    AS subtotal_app
        FROM pedido_detalles
        WHERE id_pedido = ?
    `, [id_pedido]);

    await conmysql.query(`
        UPDATE pedidos
        SET pedido_cantidad_productos = ?,
            pedido_subtotal_local = ?,
            pedido_subtotal_app = ?
        WHERE id_pedido = ?
    `, [totales.cantidad_total, totales.subtotal_local, totales.subtotal_app, id_pedido]);
};

export const postPedido = async (req, res) => {
    const conexion = await conmysql.getConnection();
    let id_pedido = null, pedido_pin = null, transaccionIniciada = false;
    try {
        if (!req.usuario) {
            conexion.release();
            return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        }
        if (!tieneRol(req, ["CLIENTE"])) {
            conexion.release();
            return res.status(403).json({ success: false, message: "Solo los clientes pueden crear pedidos." });
        }
        let { id_cliente, id_local, id_local_sucursal, id_metodo_pago, pedido_cantidad_productos, pedido_subtotal_local, pedido_subtotal_app, pedido_adicional_volumen, pedido_carrera, pedido_propina, pedido_total, pedido_distancia_km, pedido_tiempo_estimado, pedido_cliente_latitud, pedido_cliente_longitud, pedido_local_latitud, pedido_local_longitud, pedido_observacion, id_estado, pedido_fecha, pedido_fecha_entrega, productos, detalles } = req.body;
        const id_usuario = obtenerIdUsuario(req);
        if (!id_usuario) {
            conexion.release();
            return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });
        }
        const clienteUsuario = await obtenerClienteDelUsuario(id_usuario);
        if (!clienteUsuario) {
            conexion.release();
            return res.status(403).json({ success: false, message: "El usuario no tiene un cliente asociado." });
        }
        id_cliente = clienteUsuario;
        if (!id_local) {
            conexion.release();
            return res.status(400).json({ success: false, message: "El local es obligatorio." });
        }
        const listaDetalles = Array.isArray(detalles) ? detalles : productos;
        if (!Array.isArray(listaDetalles) || !listaDetalles.length) {
            conexion.release();
            return res.status(400).json({ success: false, message: "El pedido debe contener al menos un producto." });
        }

        await conexion.beginTransaction();
        transaccionIniciada = true;
        const [clientes] = await conexion.query(`SELECT id_cliente FROM clientes WHERE id_cliente=? FOR UPDATE`, [id_cliente]);
        if (!clientes.length) throw new Error("El cliente no existe");
        const [locales] = await conexion.query(`SELECT id_local,local_latitud,local_longitud FROM locales WHERE id_local=? FOR UPDATE`, [id_local]);
        if (!locales.length) throw new Error("El local no existe");
        const local = locales[0];
        if (pedido_local_latitud === undefined || pedido_local_latitud === null) pedido_local_latitud = local.local_latitud;
        if (pedido_local_longitud === undefined || pedido_local_longitud === null) pedido_local_longitud = local.local_longitud;

        const metodoPago = await obtenerMetodoPagoPorId(id_metodo_pago);
        if (!metodoPago) throw new Error("El método de pago no existe.");
        if (Number(metodoPago.metodo_pago_estado) !== 1) throw new Error("El método de pago está inactivo.");
        const esTransferencia = esMetodoTransferencia(metodoPago);
        const esTarjeta = esMetodoTarjeta(metodoPago);
        const esBilletera = esMetodoBilletera(metodoPago);
        //const pagoConfirmadoInicial = esTransferencia ? 0 : 1;
        const pagoConfirmadoInicial = requierePagoConfirmado(metodoPago) ? 0 : 1;
        const [ultimo] = await conexion.query(`SELECT pedido_codigo FROM pedidos ORDER BY id_pedido DESC LIMIT 1 FOR UPDATE`);
        let billeteraCliente = null;

        if (esBilletera) {
            const [billeteras] = await conexion.query(`SELECT id_billeteracliente,billeteracliente_saldo FROM billeteracliente WHERE id_usuario=? LIMIT 1 FOR UPDATE`, [id_usuario]);
            if (!billeteras.length) throw new Error("El cliente no tiene una billetera registrada.");
            billeteraCliente = billeteras[0];
            const saldo = Number(billeteraCliente.billeteracliente_saldo), totalPedido = Number(pedido_total ?? 0);
            if (totalPedido <= 0) throw new Error("El total del pedido debe ser mayor a cero.");
            if (saldo < totalPedido) throw new Error(`Saldo insuficiente en la billetera. Saldo disponible: ${saldo.toFixed(2)}`);
        }

        let numero = 1;
        if (ultimo.length && ultimo[0].pedido_codigo) {
            const match = String(ultimo[0].pedido_codigo).match(/(\d+)$/);
            if (match) numero = parseInt(match[1], 10) + 1;
        }
        const pedido_codigo = `PED-${String(numero).padStart(5, "0")}`;
        pedido_pin = generarPedidoPin();
        const estadoInicial = await obtenerIdEstadoPorNombre("PENDIENTE", "PEDIDO");
        if (!estadoInicial) throw new Error('No existe el estado "PENDIENTE" en la tabla estados.');

        const [result] = await conexion.query(`
            INSERT INTO pedidos (pedido_codigo,pedido_pin,id_cliente,id_local,id_repartidor,id_local_sucursal,id_metodo_pago,pedido_fecha,pedido_cantidad_productos,pedido_subtotal_local,pedido_subtotal_app,pedido_adicional_volumen,pedido_carrera,pedido_propina,pedido_total,pedido_distancia_km,pedido_tiempo_estimado,pedido_cliente_latitud,pedido_cliente_longitud,pedido_local_latitud,pedido_local_longitud,pedido_observacion,id_estado,pedido_fecha_entrega,pedido_pago_confirmado)
            VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [pedido_codigo, pedido_pin, id_cliente, id_local, id_local_sucursal ?? null, id_metodo_pago, convertirFechaMySQL(pedido_fecha ?? new Date()), Number(pedido_cantidad_productos ?? 0), Number(pedido_subtotal_local ?? 0), Number(pedido_subtotal_app ?? 0), Number(pedido_adicional_volumen ?? 0), Number(pedido_carrera ?? 0), Number(pedido_propina ?? 0), Number(pedido_total ?? 0), Number(pedido_distancia_km ?? 0), Number(pedido_tiempo_estimado ?? 0), pedido_cliente_latitud ?? null, pedido_cliente_longitud ?? null, pedido_local_latitud ?? null, pedido_local_longitud ?? null, pedido_observacion ?? null, estadoInicial, pedido_fecha_entrega ?? null, pagoConfirmadoInicial]);

        id_pedido = result.insertId;
        const detallesRegistrados = [];

        for (const detalle of listaDetalles) {
            const id_local_producto = Number(detalle.id_local_producto), cantidad = Number(detalle.pedido_detalle_cantidad ?? detalle.cantidad ?? 0);
            if (!id_local_producto || cantidad <= 0) throw new Error("Datos inválidos en los detalles del producto.");
            const [productosLocal] = await conexion.query(`SELECT lp.id_local_producto,pr.producto_nombre,pr.producto_estado FROM local_productos lp INNER JOIN productos pr ON lp.id_producto=pr.id_producto WHERE lp.id_local_producto=? AND lp.id_local=? FOR UPDATE`, [id_local_producto, id_local]);
            if (!productosLocal.length) throw new Error("El producto no pertenece al local especificado.");
            const precioLocal = Number(detalle.pedido_detalle_precio_local ?? detalle.precioLocal ?? 0), precioApp = Number(detalle.pedido_detalle_precio_app ?? detalle.precioApp ?? 0);
            const subtotalLocal = Number(detalle.pedido_detalle_subtotal_local ?? precioLocal * cantidad), subtotalApp = Number(detalle.pedido_detalle_subtotal_app ?? precioApp * cantidad);
            const [detalleResult] = await conexion.query(`INSERT INTO pedido_detalles (id_pedido,id_local_producto,pedido_detalle_cantidad,pedido_detalle_precio_local,pedido_detalle_precio_app,pedido_detalle_subtotal_local,pedido_detalle_subtotal_app,pedido_detalle_observacion) VALUES (?,?,?,?,?,?,?,?)`, [id_pedido, id_local_producto, cantidad, precioLocal, precioApp, subtotalLocal, subtotalApp, detalle.pedido_detalle_observacion ?? detalle.observacion ?? null]);
            detallesRegistrados.push({ id_pedido_detalle: detalleResult.insertId, id_local_producto, cantidad, subtotalApp });
        }

        let movimientoBilletera = null;
        if (esBilletera) {
            const montoDebito = Number(pedido_total ?? 0), saldoAnterior = Number(billeteraCliente.billeteracliente_saldo), saldoNuevo = saldoAnterior - montoDebito;
            const [movimientoResult] = await conexion.query(`INSERT INTO billeteracliente_movimiento (id_billeteracliente,billeteracliente_movimiento_tipo,billeteracliente_movimiento_monto,billeteracliente_movimiento_saldo_anterior,billeteracliente_movimiento_saldo_nuevo,billeteracliente_movimiento_concepto,billeteracliente_movimiento_referencia,id_pedido) VALUES (?,'DEBITO',?,?,?,?,?,?)`, [billeteraCliente.id_billeteracliente, montoDebito, saldoAnterior, saldoNuevo, `Pago de pedido ${pedido_codigo}`, pedido_codigo, id_pedido]);
            await conexion.query(`UPDATE billeteracliente SET billeteracliente_saldo=? WHERE id_billeteracliente=?`, [saldoNuevo, billeteraCliente.id_billeteracliente]);
            movimientoBilletera = { id_billeteracliente_movimiento: movimientoResult.insertId, id_billeteracliente: billeteraCliente.id_billeteracliente, tipo: "DEBITO", monto: montoDebito, saldo_anterior: saldoAnterior, saldo_nuevo: saldoNuevo };
        }

        await conexion.commit();
        transaccionIniciada = false;
        const pedidoFinal = await obtenerPedidoPorIdInterno(id_pedido);
        emitirEventoPedido("nuevo_pedido", pedidoFinal);
        //void notificarNuevoPedidoAlLocal(pedidoFinal).catch(error => console.error("[Pedidos] Error enviando push de nuevo pedido:", error));
        void notificationService.notifyOrderCreated(pedidoFinal).catch(error => console.error("[Pedidos] Error notificando nuevo pedido:", error));
        return res.status(201).json({
            success: true,
            id_pedido,
            pedido_codigo,
            id_cliente,
            id_local,
            id_repartidor: pedidoFinal?.id_repartidor ?? null,
            id_estado: pedidoFinal?.id_estado ?? estadoInicial,
            estado_nombre: pedidoFinal?.estado_nombre ?? null,
            id_metodo_pago: pedidoFinal?.id_metodo_pago ?? id_metodo_pago,
            metodo_pago_nombre: pedidoFinal?.metodo_pago_nombre ?? null,
            pedido_pago_confirmado: Number(pedidoFinal?.pedido_pago_confirmado ?? pagoConfirmadoInicial),
            //message: esTransferencia ? "Pedido registrado. La transferencia queda pendiente de confirmación por SOPORTE o ADMINISTRADOR." : esBilletera ? "Pedido registrado y pagado con Billetera." : "Pedido registrado con éxito",
            message: esTransferencia
                ? "Pedido registrado. La transferencia queda pendiente de confirmación por SOPORTE o ADMINISTRADOR."
                : esTarjeta
                    ? "Pedido registrado. El pago con tarjeta queda pendiente de confirmación por SOPORTE o ADMINISTRADOR."
                    : esBilletera
                        ? "Pedido registrado y pagado con Billetera."
                        : "Pedido registrado con éxito",
            detalles: detallesRegistrados,
            pedido_pin
        });
    } catch (error) {
        if (transaccionIniciada) {
            try { await conexion.rollback(); } catch (e) { console.error("[Pedidos] Error rollback:", e); }
        }
        console.error("[Pedidos] Error postPedido:", error);
        return res.status(500).json({ success: false, message: error.message || "Error al registrar pedido" });
    } finally {
        conexion.release();
    }
};

export const putPedido = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const pedido = await obtenerPedidoPorIdInterno(id);
        if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado" });
        if (tieneRol(req, ["CENTRAL", "SUPERVISOR"])) return res.status(403).json({ success: false, message: "CENTRAL y SUPERVISOR no tienen permisos para modificar pedidos." });

        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes modificar este pedido." });
        }
        if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(pedido.id_local) !== Number(local.id_local)) return res.status(403).json({ success: false, message: "No puedes modificar pedidos de otro local." });
        }
        if (!puedeModificarPedidos(req)) return res.status(403).json({ success: false, message: "No tienes permisos para modificar este pedido." });

        let transicionAEnPreparacion = false, liberaRepartidor = false;
        let nuevoEstadoNombre = null;
        if (req.body.id_estado !== undefined && req.body.id_estado !== null) {
            const validacionEstado = await validarTransicionEstado(req, pedido, req.body.id_estado);
            if (!validacionEstado.valido) return res.status(validacionEstado.status).json({ success: false, message: validacionEstado.message, codigo: validacionEstado.codigo ?? undefined });

            transicionAEnPreparacion = !validacionEstado.mismoEstado && validacionEstado.estadoActual === "PENDIENTE" && validacionEstado.nuevoEstado === "EN_PREPARACION";
            liberaRepartidor = !validacionEstado.mismoEstado && validacionEstado.estadoActual === "EN_CAMINO" && ["ENTREGADO", "NO_ENTREGADO"].includes(validacionEstado.nuevoEstado);
            if (!validacionEstado.mismoEstado) nuevoEstadoNombre = validacionEstado.nuevoEstado;
        }

        const campos = [], valores = [];
        for (const campo of ["id_estado", "pedido_observacion", "pedido_fecha_entrega"]) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo}=?`);
                valores.push(req.body[campo]);
            }
        }
        if (campos.length) {
            valores.push(id);
            await conmysql.query(`UPDATE pedidos SET ${campos.join(",")} WHERE id_pedido=?`, valores);
        }

        let asignacion = null, pagoLocal = null, pagoRepartidor = null;
        if (transicionAEnPreparacion) {
            try { asignacion = await asignarRepartidorAutomaticamente(Number(id)); }
            catch (error) { console.error("[Pedidos] Error asignando repartidor:", error); }
        }

        if (liberaRepartidor) {
            // Los pagos solo corresponden a una entrega completada.
            if (req.body.id_estado !== undefined) {
                const estadoDestino = await conmysql.query(`SELECT estado_nombre FROM estados WHERE id_estado=? LIMIT 1`, [req.body.id_estado]);
                const nombreEstadoDestino = String(estadoDestino[0]?.[0]?.estado_nombre || "").trim().toUpperCase();
                if (nombreEstadoDestino === "ENTREGADO") {
                    try { pagoLocal = await crearPagoLocalDesdePedido(Number(id)); }
                    catch (error) { console.error("[Pedidos] Error creando pago local:", error); }
                    try { pagoRepartidor = await crearPagoRepartidorDesdePedido(Number(id)); }
                    catch (error) { console.error("[Pedidos] Error creando pago repartidor:", error); }
                }
            }
            try { await sincronizarEstadoRepartidorTrasEntrega(pedido.id_repartidor); }
            catch (error) { console.error("[Pedidos] Error sincronizando estado del repartidor:", error); }
        }

        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        if (campos.length) {
          emitirEventoPedido("pedido_actualizado", pedidoActualizado);
          //void notificarNuevoPedidoAlLocal(pedidoActualizado, "pedido_actualizado").catch(error => console.error("[Pedidos] Error enviando push de pedido actualizado:", error));
        if (nuevoEstadoNombre) {
            void notificationService.notifyOrderStatusChanged(pedidoActualizado, nuevoEstadoNombre, obtenerIdUsuario(req))
              .catch(error => console.error("[Pedidos] Error notificando cambio de estado:", error));
          }
        }
        return res.json({ success: true, ...ocultarPedidoPin(pedidoActualizado, req), pago_local: pagoLocal, pago_repartidor: pagoRepartidor, asignacion });
    } catch (error) {
        console.error("[Pedidos] Error putPedido:", error);
        return res.status(500).json({ success: false, message: "Error al actualizar pedido" });
    }
};

export const patchPedido = async (req, res) => putPedido(req, res);

export const confirmarPagoPedido = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "ID no válido." });
        if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "No tienes permisos para confirmar pagos." });
        const [resultado] = await conmysql.query(`UPDATE pedidos SET pedido_pago_confirmado=1 WHERE id_pedido=?`, [id]);

/*             if (pedidoActualizado?.cliente_id_usuario) {
                await crearNotificacion({
                    id_usuario_destino: pedidoActualizado.cliente_id_usuario,
                    tipo: "PEDIDO",
                    titulo: "Pago confirmado",
                    mensaje: `Tu pago del pedido ${pedidoActualizado.pedido_codigo} fue confirmado. Tu pedido continúa en proceso.`,
                    referencia_tipo: "PEDIDO",
                    referencia_id: pedidoActualizado.id_pedido
                });
            } */
        
        if (!resultado.affectedRows) return res.status(404).json({ success: false, message: "Pedido no encontrado." });
        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        void notificationService.notifyPaymentConfirmed(pedidoActualizado, obtenerIdUsuario(req))
            .catch(error => console.error("[Pedidos] Error notificando pago confirmado:", error));
        return res.json({ success: true, message: "Pago confirmado correctamente.", ...ocultarPedidoPin(pedidoActualizado, req) });
    } catch (error) {
        console.error("[Pedidos] Error confirmarPagoPedido:", error);
        return res.status(500).json({ success: false, message: "Error al confirmar pago del pedido." });
    }
};

// Entrega mediante PIN y libera al repartidor de EN_PEDIDO.
export const entregarPedidoConPin = async (req, res) => {
    try {
        const { id } = req.params, { pedido_pin } = req.body;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "ID no válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const pedido = await obtenerPedidoPorIdInterno(id);
        if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado." });

        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (Number(pedido.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes entregar este pedido." });
        } else if (!esAdministrativo(req)) {
            return res.status(403).json({ success: false, message: "No tienes permisos para entregar este pedido." });
        }

        if (String(pedido.pedido_pin).trim() !== String(pedido_pin ?? "").trim()) return res.status(400).json({ success: false, message: "El PIN de entrega es incorrecto." });

        const idEstadoEntregado = await obtenerIdEstadoPorNombre("ENTREGADO", "PEDIDO");
        if (!idEstadoEntregado) return res.status(500).json({ success: false, message: 'No existe el estado "ENTREGADO" para pedidos.' });
        if (Number(pedido.id_estado) === Number(idEstadoEntregado)) return res.status(409).json({ success: false, message: "El pedido ya se encuentra ENTREGADO." });

        await conmysql.query(`UPDATE pedidos SET id_estado=?,pedido_fecha_entrega=NOW() WHERE id_pedido=?`, [idEstadoEntregado, id]);

        let pagoLocal = null, pagoRepartidor = null;
        try { pagoLocal = await crearPagoLocalDesdePedido(Number(id)); }
        catch (error) { console.error("[Pedidos] Error creando pago local al entregar por PIN:", error); }
        try { pagoRepartidor = await crearPagoRepartidorDesdePedido(Number(id)); }
        catch (error) { console.error("[Pedidos] Error creando pago repartidor al entregar por PIN:", error); }

        // Después de la entrega, el repartidor deja EN_PEDIDO.
        try { await sincronizarEstadoRepartidorTrasEntrega(pedido.id_repartidor); }
        catch (error) { console.error("[Pedidos] Error sincronizando estado del repartidor tras PIN:", error); }

        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        void notificationService.notifyOrderDelivered(pedidoActualizado, obtenerIdUsuario(req))
            .catch(error => console.error("[Pedidos] Error notificando entrega:", error));
        return res.json({ success: true, message: "Pedido entregado con éxito.", pedido: ocultarPedidoPin(pedidoActualizado, req), pago_local: pagoLocal, pago_repartidor: pagoRepartidor });
    } catch (error) {
        console.error("[Pedidos] Error entregarPedidoConPin:", error);
        return res.status(500).json({ success: false, message: "Error al entregar pedido." });
    }
};

const ESTADOS_PEDIDO_NO_CANCELABLES = ["ENTREGADO", "NO_ENTREGADO", "CANCELADO"];

// Cancelación con reglas por rol: CLIENTE/LOCAL/REPARTIDOR solo antes de ser aceptado; SOPORTE/ADMINISTRATIVOS siempre.
export const cancelarPedido = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        const { id } = req.params;
        const motivo = req.body?.motivo ? String(req.body.motivo).trim() : null;

        if (!esIdValido(id)) { conexion.release(); return res.status(400).json({ success: false, message: "El ID del pedido no es válido." }); }
        if (!req.usuario) { conexion.release(); return res.status(401).json({ success: false, message: "Usuario no autenticado." }); }

        await conexion.beginTransaction();

        const [pedidos] = await conexion.query(`
            SELECT p.*, e.estado_nombre
            FROM pedidos p LEFT JOIN estados e ON p.id_estado = e.id_estado
            WHERE p.id_pedido = ? LIMIT 1 FOR UPDATE
        `, [id]);

        if (!pedidos.length) { await conexion.rollback(); return res.status(404).json({ success: false, message: "Pedido no encontrado." }); }

        const pedido = pedidos[0];
        const estadoActual = String(pedido.estado_nombre || "").trim().toUpperCase();

        if (ESTADOS_PEDIDO_NO_CANCELABLES.includes(estadoActual)) {
            await conexion.rollback();
            return res.status(409).json({ success: false, message: `El pedido está en ${estadoActual} y no puede cancelarse.`, codigo: "PEDIDO_NO_CANCELABLE" });
        }

        let autorizado = false;

        if (esAdministrativo(req)) {
            autorizado = true;
        } else if (tieneRol(req, ["CLIENTE"])) {
            const id_usuario = obtenerIdUsuario(req);
            const clienteUsuario = id_usuario ? await obtenerClienteDelUsuario(id_usuario) : null;
            if (!clienteUsuario || Number(clienteUsuario) !== Number(pedido.id_cliente)) {
                await conexion.rollback();
                return res.status(403).json({ success: false, message: "No puedes cancelar el pedido de otro cliente." });
            }
            // El LOCAL aún no lo aceptó mientras esté PENDIENTE.
            autorizado = estadoActual === "PENDIENTE";
        } else if (tieneRol(req, ["LOCAL"])) {
            const local = await obtenerLocalDelUsuario(req);
            if (!local || Number(local.id_local) !== Number(pedido.id_local)) {
                await conexion.rollback();
                return res.status(403).json({ success: false, message: "No puedes cancelar pedidos de otro local." });
            }
            autorizado = estadoActual === "PENDIENTE";
        } else if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (!id_repartidor || Number(pedido.id_repartidor) !== Number(id_repartidor)) {
                await conexion.rollback();
                return res.status(403).json({ success: false, message: "No puedes cancelar un pedido que no tienes asignado." });
            }
            // Solo si aún no aceptó la oferta (sigue OFERTADO) o no hay asignación activa registrada.
            const asignacion = await obtenerAsignacionActiva(conexion, id);
            const estadoAsignacion = String(asignacion?.estado_nombre || "").trim().toUpperCase();
            autorizado = !asignacion || estadoAsignacion === "OFERTADO";
        } else {
            await conexion.rollback();
            return res.status(403).json({ success: false, message: "Tu rol no tiene permisos para cancelar pedidos." });
        }

        if (!autorizado) {
            await conexion.rollback();
            return res.status(403).json({
                success: false,
                codigo: "CANCELACION_NO_PERMITIDA",
                message: "Ya no puedes cancelar este pedido en este punto del proceso. Contacta a SOPORTE."
            });
        }

        const idEstadoCancelado = await obtenerIdEstadoPorNombre("CANCELADO", "PEDIDO");
        if (!idEstadoCancelado) {
            await conexion.rollback();
            return res.status(500).json({ success: false, message: 'No existe el estado "CANCELADO" en la tabla estados. Ejecuta la migración.' });
        }

        await conexion.query(`
            UPDATE pedidos
            SET id_estado=?, pedido_cancelado_motivo=?, pedido_cancelado_por_rol=?, pedido_cancelado_por_usuario=?, pedido_cancelado_fecha=NOW()
            WHERE id_pedido=?
        `, [idEstadoCancelado, motivo, obtenerRol(req) || null, obtenerIdUsuario(req) || null, id]);

        await conexion.commit();

        // Libera al repartidor si tenía uno EN_PEDIDO asignado.
        if (pedido.id_repartidor) {
            try { await sincronizarEstadoRepartidorTrasEntrega(pedido.id_repartidor); }
            catch (error) { console.error("[Pedidos] Error liberando repartidor tras cancelación:", error); }
        }

        const pedidoActualizado = await obtenerPedidoPorIdInterno(id);
        const destinatarios = [pedido.cliente_id_usuario, pedidoActualizado?.local_id_usuario, pedidoActualizado?.repartidor_id_usuario].filter(Boolean);
        emitirEventoPedido("pedido_cancelado", pedidoActualizado);
        void notificationService.notifyOrderCancelled(pedidoActualizado, motivo, obtenerIdUsuario(req))
            .catch(error => console.error("[Pedidos] Error notificando cancelación:", error));
        void notificarNuevoPedidoAlLocal(pedidoActualizado, "pedido_cancelado").catch(error => console.error("[Pedidos] Error enviando push de pedido cancelado:", error));
        return res.json({ success: true, message: "Pedido cancelado correctamente.", ...ocultarPedidoPin(pedidoActualizado, req) });
    } catch (error) {
        try { await conexion.rollback(); } catch (e) { console.error("[Pedidos] Error rollback cancelarPedido:", e); }
        console.error("[Pedidos] Error cancelarPedido:", error);
        return res.status(500).json({ success: false, message: "Error al cancelar el pedido." });
    } finally {
        conexion.release();
    }
};

// Lista pedidos cancelados con filtros, solo para roles administrativos.
export const getPedidosCancelados = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos cancelados." });

        const idEstadoCancelado = await obtenerIdEstadoPorNombre("CANCELADO", "PEDIDO");
        if (!idEstadoCancelado) return res.json({ success: true, total: 0, pedidos: [] });

        const { fecha_desde, fecha_hasta, id_local, id_cliente, id_repartidor, motivo, cancelado_por_rol } = req.query;
        const condiciones = ["p.id_estado = ?"];
        const valores = [idEstadoCancelado];

        if (fecha_desde) { condiciones.push("p.pedido_cancelado_fecha >= ?"); valores.push(`${fecha_desde} 00:00:00`); }
        if (fecha_hasta) { condiciones.push("p.pedido_cancelado_fecha <= ?"); valores.push(`${fecha_hasta} 23:59:59`); }
        if (esIdValido(id_local)) { condiciones.push("p.id_local = ?"); valores.push(id_local); }
        if (esIdValido(id_cliente)) { condiciones.push("p.id_cliente = ?"); valores.push(id_cliente); }
        if (esIdValido(id_repartidor)) { condiciones.push("p.id_repartidor = ?"); valores.push(id_repartidor); }
        if (motivo && String(motivo).trim()) { condiciones.push("p.pedido_cancelado_motivo LIKE ?"); valores.push(`%${String(motivo).trim()}%`); }
        if (cancelado_por_rol && String(cancelado_por_rol).trim()) { condiciones.push("UPPER(p.pedido_cancelado_por_rol) = ?"); valores.push(String(cancelado_por_rol).trim().toUpperCase()); }

        const [result] = await conmysql.query(`
            SELECT p.*,
                   c.cliente_codigo, u.usuario_nombre_completo AS cliente_nombre, u.usuario_telefono AS cliente_telefono,
                   l.local_codigo, l.local_nombre_comercial,
                   e.estado_nombre, mp.metodo_pago_nombre,
                   r.repartidor_codigo, ur.usuario_nombre_completo AS repartidor_nombre_completo,
                   uc.usuario_nombre_completo AS cancelado_por_nombre
            FROM pedidos p
            LEFT JOIN clientes c ON p.id_cliente=c.id_cliente
            LEFT JOIN usuarios u ON c.id_usuario=u.id_usuario
            LEFT JOIN locales l ON p.id_local=l.id_local
            LEFT JOIN estados e ON p.id_estado=e.id_estado
            LEFT JOIN metodos_pago mp ON p.id_metodo_pago=mp.id_metodo_pago
            LEFT JOIN repartidores r ON p.id_repartidor=r.id_repartidor
            LEFT JOIN usuarios ur ON r.id_usuario=ur.id_usuario
            LEFT JOIN usuarios uc ON p.pedido_cancelado_por_usuario=uc.id_usuario
            WHERE ${condiciones.join(" AND ")}
            ORDER BY p.pedido_cancelado_fecha DESC, p.id_pedido DESC
        `, valores);

        return res.json({ success: true, total: result.length, pedidos: ocultarPedidosPin(result, req) });
    } catch (error) {
        console.error("[Pedidos] Error getPedidosCancelados:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pedidos cancelados." });
    }
};

export const deletePedido = async (req, res) => {
    const conexion = await conmysql.getConnection();
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "ID no válido." });
        if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "No tienes permisos para eliminar pedidos." });
        await conexion.beginTransaction();
        await conexion.query(`DELETE FROM pedido_repartidores WHERE id_pedido=?`, [id]);
        await conexion.query(`DELETE FROM pedido_detalles WHERE id_pedido=?`, [id]);
        const [resultado] = await conexion.query(`DELETE FROM pedidos WHERE id_pedido=?`, [id]);
        if (!resultado.affectedRows) {
            await conexion.rollback();
            return res.status(404).json({ success: false, message: "Pedido no encontrado." });
        }
        await conexion.commit();
        return res.status(204).send();
    } catch (error) {
        await conexion.rollback();
        console.error("[Pedidos] Error deletePedido:", error);
        return res.status(500).json({ success: false, message: "Error al eliminar pedido." });
    } finally {
        conexion.release();
    }
};

export {
    obtenerRol, obtenerRoles, obtenerIdUsuario, obtenerClienteDelUsuario, obtenerLocalDelUsuario, obtenerRepartidorDelUsuario,
    verificarAccesoCliente, obtenerPedidoPorIdInterno, generarPedidoPin, ocultarPedidoPin, ocultarPedidosPin, esAdministrativo, tieneRol,
    sincronizarEstadoRepartidorTrasEntrega
};


