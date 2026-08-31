// src/controladores/pedidosCtrl.js
import { conmysql } from "../db.js";
import { asignarRepartidorAutomaticamente } from "./pedidorepartidoresCtrl.js";
import { crearPagoLocalDesdePedido } from "./pagoslocalesCtrl.js";

// ROLES Y TRANSICIONES
const ROLES_ADMINISTRATIVOS = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];
const ROLES_MODIFICAR_PEDIDOS = ["LOCAL", "REPARTIDOR", "CLIENTE", "SOPORTE", "ADMINISTRADOR"];

const TRANSICIONES_ESTADO = {
  PENDIENTE: { EN_PREPARACION: ["LOCAL", "SOPORTE", "ADMINISTRADOR"] },
  EN_PREPARACION: { LISTO: ["LOCAL", "SOPORTE", "ADMINISTRADOR"] },
  LISTO: { EN_CAMINO: ["REPARTIDOR", "SOPORTE", "ADMINISTRADOR"] },
  EN_CAMINO: {
    ENTREGADO: ["REPARTIDOR", "SOPORTE", "ADMINISTRADOR"],
    NO_ENTREGADO: ["CLIENTE", "SOPORTE", "ADMINISTRADOR"]
  }
};

// AUTH Y ROLES
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
  return [obtenerRol(req), ...(Array.isArray(u.roles) ? u.roles : [])]
    .filter(Boolean)
    .map(r => String(r).trim().toUpperCase())
    .filter((r, i, a) => a.indexOf(r) === i);
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

// RELACIONES USUARIO - ENTIDAD
const obtenerClienteDelUsuario = async id_usuario => {
  if (!id_usuario) return null;
  const [rows] = await conmysql.query(
    `SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1`,
    [id_usuario]
  );
  return rows.length ? rows[0].id_cliente : null;
};

const obtenerLocalDelUsuario = async req => {
  const u = req.usuario || {};
  const id_usuario = obtenerIdUsuario(req);

  console.log("[Pedidos][LOCAL] Usuario autenticado:", u, "id_usuario:", id_usuario);

  if (id_usuario) {
    const [locales] = await conmysql.query(
      `SELECT id_local, id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_telefono, local_email, local_latitud, local_longitud FROM locales WHERE id_usuario = ? LIMIT 1`,
      [id_usuario]
    );
    if (locales.length) {
      console.log("[Pedidos][LOCAL] Local por id_usuario:", locales[0]);
      return locales[0];
    }
  }

  const id_local_token = Number(u.id_local ?? u.local_id ?? u.idLocal ?? u.localId);

  if (Number.isInteger(id_local_token) && id_local_token > 0) {
    const [locales] = await conmysql.query(
      `SELECT id_local, id_usuario, local_codigo, local_nombre_comercial, local_razon_social, local_telefono, local_email, local_latitud, local_longitud FROM locales WHERE id_local = ? LIMIT 1`,
      [id_local_token]
    );
    if (locales.length) {
      console.log("[Pedidos][LOCAL] Local por id_local token:", locales[0]);
      return locales[0];
    }
  }

  console.warn("[Pedidos][LOCAL] NO se encontró local:", { id_usuario, id_local_token, usuario: u });
  return null;
};

const obtenerRepartidorDelUsuario = async id_usuario => {
  if (!id_usuario) return null;
  const [rows] = await conmysql.query(
    `SELECT id_repartidor FROM repartidores WHERE id_usuario = ? LIMIT 1`,
    [id_usuario]
  );
  return rows.length ? rows[0].id_repartidor : null;
};

// UTILIDADES
const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;
const generarPedidoPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

const convertirFechaMySQL = fecha => {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) throw new Error("La fecha proporcionada no es válida");
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const obtenerIdEstadoPorNombre = async nombreEstado => {
  const [rows] = await conmysql.query(
    `SELECT id_estado FROM estados WHERE UPPER(TRIM(estado_nombre)) = ? LIMIT 1`,
    [String(nombreEstado).trim().toUpperCase()]
  );
  return rows.length ? rows[0].id_estado : null;
};

// VALIDAR TRANSICIÓN
const validarTransicionEstado = async (req, pedido, nuevoIdEstado) => {
  const estadoActual = String(pedido.estado_nombre || "").trim().toUpperCase();
  const [estados] = await conmysql.query(
    `SELECT id_estado, estado_nombre FROM estados WHERE id_estado = ? LIMIT 1`,
    [nuevoIdEstado]
  );

  if (!estados.length) return { valido: false, status: 400, message: "El estado solicitado no existe." };

  const nuevoEstado = String(estados[0].estado_nombre || "").trim().toUpperCase();

  if (Number(pedido.id_estado) === Number(nuevoIdEstado)) {
    return { valido: true, mismoEstado: true, estadoActual, nuevoEstado };
  }

  const transiciones = TRANSICIONES_ESTADO[estadoActual];
  if (!transiciones) {
    return { valido: false, status: 403, message: `El pedido está en ${estadoActual} y no puede cambiarse a ${nuevoEstado}.` };
  }

  const rolesPermitidos = transiciones[nuevoEstado];
  if (!rolesPermitidos) {
    return { valido: false, status: 403, message: `No se permite cambiar el pedido de ${estadoActual} a ${nuevoEstado}.` };
  }

  if (!tieneRol(req, rolesPermitidos)) {
    return {
      valido: false,
      status: 403,
      message: `El rol ${obtenerRol(req) || "SIN_ROL"} no puede cambiar el estado de ${estadoActual} a ${nuevoEstado}.`
    };
  }

  return { valido: true, mismoEstado: false, estadoActual, nuevoEstado };
};

// OCULTAR PIN
const ocultarPedidoPin = (pedido, req) => {
  if (!pedido) return pedido;
  const copia = { ...pedido };
  if (!tieneRol(req, ["CLIENTE"])) delete copia.pedido_pin;
  return copia;
};

const ocultarPedidosPin = (pedidos, req) => Array.isArray(pedidos) ? pedidos.map(p => ocultarPedidoPin(p, req)) : pedidos;

// ACCESO CLIENTE
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

// OBTENER PEDIDO INTERNO
const obtenerPedidoPorIdInterno = async id_pedido => {
  const [pedidos] = await conmysql.query(
    `SELECT
      p.*,
      c.cliente_codigo,
      c.id_usuario AS cliente_id_usuario,
      u.usuario_cedula AS cliente_cedula,
      u.usuario_nombre AS cliente_nombre,
      u.usuario_apellido AS cliente_apellido,
      u.usuario_nombre_completo AS cliente_nombre_completo,
      u.usuario_email AS cliente_email,
      u.usuario_telefono AS cliente_telefono,
      l.local_codigo,
      l.local_nombre_comercial,
      l.local_razon_social,
      l.local_telefono,
      l.local_email,
      e.estado_nombre,
      mp.metodo_pago_nombre,
      mp.metodo_pago_descripcion,
      r.id_repartidor,
      r.id_usuario AS repartidor_id_usuario,
      r.repartidor_codigo,
      r.repartidor_placa,
      r.repartidor_tipo_vehiculo,
      r.repartidor_calificacion,
      r.repartidor_posicion_ranking,
      r.repartidor_total_pedidos,
      r.repartidor_pedidos_aceptados,
      r.repartidor_pedidos_rechazados,
      r.repartidor_porcentaje_aceptacion,
      ur.usuario_nombre AS repartidor_nombre,
      ur.usuario_apellido AS repartidor_apellido,
      ur.usuario_nombre_completo AS repartidor_nombre_completo,
      ur.usuario_telefono AS repartidor_telefono
    FROM pedidos p
    LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
    LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
    LEFT JOIN locales l ON p.id_local = l.id_local
    LEFT JOIN estados e ON p.id_estado = e.id_estado
    LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
    LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
    LEFT JOIN usuarios ur ON r.id_usuario = ur.id_usuario
    WHERE p.id_pedido = ?
    LIMIT 1`,
    [id_pedido]
  );
  return pedidos.length ? pedidos[0] : null;
};

// GET PEDIDOS
export const getPedidos = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    const roles = obtenerRoles(req);
    const id_usuario = obtenerIdUsuario(req);

    console.log("=================================================");
    console.log("[Pedidos] GET /pedidos", { usuario: req.usuario, id_usuario, roles, rol: obtenerRol(req) });

    if (esAdministrativo(req)) {
      const [result] = await conmysql.query(
        `SELECT
          p.*,
          c.cliente_codigo,
          c.id_usuario AS cliente_id_usuario,
          u.usuario_nombre AS cliente_nombre,
          u.usuario_apellido AS cliente_apellido,
          u.usuario_nombre_completo AS cliente_nombre_completo,
          u.usuario_cedula AS cliente_cedula,
          u.usuario_email AS cliente_email,
          u.usuario_telefono AS cliente_telefono,
          l.local_codigo,
          l.local_nombre_comercial,
          l.local_razon_social,
          l.local_telefono,
          l.local_email,
          e.estado_nombre,
          mp.metodo_pago_nombre,
          mp.metodo_pago_descripcion,
          r.repartidor_codigo
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
        LEFT JOIN locales l ON p.id_local = l.id_local
        LEFT JOIN estados e ON p.id_estado = e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
        LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
        ORDER BY p.id_pedido DESC`
      );
      return res.json(ocultarPedidosPin(result, req));
    }

    if (tieneRol(req, ["LOCAL"])) {
      const local = await obtenerLocalDelUsuario(req);
      if (!local) return res.status(403).json({ success: false, message: "El usuario LOCAL no tiene un registro asociado en la tabla locales." });

      const id_local = Number(local.id_local);
      if (!Number.isInteger(id_local) || id_local <= 0) {
        return res.status(403).json({ success: false, message: "El local asociado al usuario no tiene un id_local válido." });
      }

      const [result] = await conmysql.query(
        `SELECT
          p.*,
          c.cliente_codigo,
          u.usuario_nombre AS cliente_nombre,
          u.usuario_apellido AS cliente_apellido,
          u.usuario_nombre_completo AS cliente_nombre_completo,
          u.usuario_email AS cliente_email,
          u.usuario_telefono AS cliente_telefono,
          l.local_codigo,
          l.local_nombre_comercial,
          l.local_razon_social,
          l.local_telefono,
          l.local_email,
          e.estado_nombre,
          mp.metodo_pago_nombre,
          mp.metodo_pago_descripcion,
          r.repartidor_codigo
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
        INNER JOIN locales l ON p.id_local = l.id_local
        LEFT JOIN estados e ON p.id_estado = e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
        LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
        WHERE p.id_local = ?
        ORDER BY p.id_pedido DESC`,
        [id_local]
      );
      return res.json(ocultarPedidosPin(result, req));
    }

    if (tieneRol(req, ["CLIENTE"])) {
      if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });

      const id_cliente = await obtenerClienteDelUsuario(id_usuario);
      if (!id_cliente) return res.json([]);

      const [result] = await conmysql.query(
        `SELECT
          p.*,
          c.cliente_codigo,
          l.local_codigo,
          l.local_nombre_comercial,
          l.local_razon_social,
          l.local_telefono,
          e.estado_nombre,
          mp.metodo_pago_nombre,
          mp.metodo_pago_descripcion
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
        LEFT JOIN locales l ON p.id_local = l.id_local
        LEFT JOIN estados e ON p.id_estado = e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
        WHERE p.id_cliente = ?
        ORDER BY p.id_pedido DESC`,
        [id_cliente]
      );
      return res.json(ocultarPedidosPin(result, req));
    }

    if (tieneRol(req, ["REPARTIDOR"])) {
      if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });

      const id_repartidor = await obtenerRepartidorDelUsuario(id_usuario);
      if (!id_repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });

      const [result] = await conmysql.query(
        `SELECT
          p.*,
          c.cliente_codigo,
          u.usuario_nombre_completo AS cliente_nombre,
          u.usuario_telefono AS cliente_telefono,
          l.local_codigo,
          l.local_nombre_comercial,
          e.estado_nombre,
          mp.metodo_pago_nombre,
          mp.metodo_pago_descripcion
        FROM pedidos p
        LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
        LEFT JOIN locales l ON p.id_local = l.id_local
        LEFT JOIN estados e ON p.id_estado = e.id_estado
        LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
        WHERE p.id_repartidor = ?
        ORDER BY p.id_pedido DESC`,
        [id_repartidor]
      );
      return res.json(ocultarPedidosPin(result, req));
    }

    return res.status(403).json({
      success: false,
      message: `Los roles [${roles.join(", ") || "SIN_ROL"}] no tienen permisos para consultar pedidos.`,
      debug: { id_usuario, roles, usuario: req.usuario }
    });
  } catch (error) {
    console.error("[Pedidos] Error getPedidos:", error);
    return res.status(500).json({
      success: false,
      message: "Error al consultar pedidos",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// GET PEDIDOS POR CLIENTE
export const getPedidosPorCliente = async (req, res) => {
  try {
    const { id_cliente } = req.params;
    if (!esIdValido(id_cliente)) return res.status(400).json({ success: false, message: "El ID del cliente no es válido." });
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    if (!esAdministrativo(req) && tieneRol(req, ["CLIENTE"])) {
      if (!(await verificarAccesoCliente(req, res, id_cliente))) return;
    } else if (!esAdministrativo(req) && !tieneRol(req, ["CLIENTE"])) {
      return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos del cliente." });
    }

    const [result] = await conmysql.query(
      `SELECT
        p.*,
        c.cliente_codigo,
        u.usuario_nombre AS cliente_nombre,
        u.usuario_apellido AS cliente_apellido,
        u.usuario_nombre_completo AS cliente_nombre_completo,
        u.usuario_email AS cliente_email,
        u.usuario_telefono AS cliente_telefono,
        l.local_codigo,
        l.local_nombre_comercial,
        l.local_razon_social,
        e.estado_nombre,
        mp.metodo_pago_nombre,
        mp.metodo_pago_descripcion,
        r.repartidor_codigo
      FROM pedidos p
      LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN locales l ON p.id_local = l.id_local
      LEFT JOIN estados e ON p.id_estado = e.id_estado
      LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
      LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
      WHERE p.id_cliente = ?
      ORDER BY p.id_pedido DESC`,
      [id_cliente]
    );

    return res.json(ocultarPedidosPin(result, req));
  } catch (error) {
    console.error("[Pedidos] Error getPedidosPorCliente:", error);
    return res.status(500).json({ success: false, message: "Error al consultar pedidos del cliente" });
  }
};

// GET PEDIDO POR ID
export const getPedidoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    const pedido = await obtenerPedidoPorIdInterno(id);
    if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado" });

    if (esAdministrativo(req)) return res.json(ocultarPedidoPin(pedido, req));

    if (tieneRol(req, ["CLIENTE"])) {
      if (!(await verificarAccesoCliente(req, res, pedido.id_cliente))) return;

      const [detalles] = await conmysql.query(
        `SELECT
          pd.*,
          p.pedido_codigo,
          lp.id_local,
          lp.id_producto,
          l.local_nombre_comercial,
          pr.producto_codigo,
          pr.producto_nombre
        FROM pedido_detalles pd
        LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
        LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
        LEFT JOIN locales l ON lp.id_local = l.id_local
        LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
        WHERE pd.id_pedido = ?
        ORDER BY pd.id_pedido_detalle ASC`,
        [id]
      );

      pedido.detalles = detalles;
      return res.json(ocultarPedidoPin(pedido, req));
    }

    if (tieneRol(req, ["REPARTIDOR"])) {
      const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
      if (Number(pedido.id_repartidor) !== Number(id_repartidor)) {
        return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
      }
      return res.json(ocultarPedidoPin(pedido, req));
    }

    if (tieneRol(req, ["LOCAL"])) {
      const local = await obtenerLocalDelUsuario(req);
      if (!local) return res.status(403).json({ success: false, message: "El usuario LOCAL no tiene un local asociado." });
      if (Number(pedido.id_local) !== Number(local.id_local)) {
        return res.status(403).json({ success: false, message: "No puedes acceder a pedidos de otro local." });
      }

      const [detalles] = await conmysql.query(
        `SELECT
          pd.*,
          p.pedido_codigo,
          lp.id_local,
          lp.id_producto,
          l.local_nombre_comercial,
          pr.producto_codigo,
          pr.producto_nombre
        FROM pedido_detalles pd
        LEFT JOIN pedidos p ON pd.id_pedido = p.id_pedido
        LEFT JOIN local_productos lp ON pd.id_local_producto = lp.id_local_producto
        LEFT JOIN locales l ON lp.id_local = l.id_local
        LEFT JOIN productos pr ON lp.id_producto = pr.id_producto
        WHERE pd.id_pedido = ?
        ORDER BY pd.id_pedido_detalle ASC`,
        [id]
      );

      pedido.detalles = detalles;
      return res.json(ocultarPedidoPin(pedido, req));
    }

    return res.status(403).json({ success: false, message: "No tienes permisos para acceder a este pedido." });
  } catch (error) {
    console.error("[Pedidos] Error getPedidoPorId:", error);
    return res.status(500).json({ success: false, message: "Error al consultar pedido" });
  }
};

// PEDIDOS POR LOCAL
export const getPedidosPorLocal = async (req, res) => {
  try {
    const { id_local } = req.params;
    if (!esIdValido(id_local)) return res.status(400).json({ success: false, message: "El ID del local no es válido." });
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    if (tieneRol(req, ["LOCAL"])) {
      const local = await obtenerLocalDelUsuario(req);
      if (!local) return res.status(403).json({ success: false, message: "El usuario no tiene un local asociado." });
      if (Number(local.id_local) !== Number(id_local)) {
        return res.status(403).json({ success: false, message: "No puedes consultar pedidos de otro local." });
      }
    } else if (!esAdministrativo(req)) {
      return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos de este local." });
    }

    const [result] = await conmysql.query(
      `SELECT
        p.*,
        c.cliente_codigo,
        u.usuario_nombre AS cliente_nombre,
        u.usuario_apellido AS cliente_apellido,
        u.usuario_nombre_completo AS cliente_nombre_completo,
        u.usuario_email AS cliente_email,
        u.usuario_telefono AS cliente_telefono,
        l.local_codigo,
        l.local_nombre_comercial,
        l.local_razon_social,
        l.local_telefono,
        l.local_email,
        e.estado_nombre,
        mp.metodo_pago_nombre,
        mp.metodo_pago_descripcion,
        r.repartidor_codigo
      FROM pedidos p
      LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      INNER JOIN locales l ON p.id_local = l.id_local
      LEFT JOIN estados e ON p.id_estado = e.id_estado
      LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
      LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
      WHERE p.id_local = ?
      ORDER BY p.id_pedido DESC`,
      [id_local]
    );

    return res.json(ocultarPedidosPin(result, req));
  } catch (error) {
    console.error("[Pedidos] Error getPedidosPorLocal:", error);
    return res.status(500).json({ success: false, message: "Error al consultar pedidos del local" });
  }
};

// GET PEDIDO POR CÓDIGO
export const getPedidoPorCodigo = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    const { codigo } = req.params;
    if (!codigo || !String(codigo).trim()) {
      return res.status(400).json({ success: false, message: "El código del pedido es obligatorio." });
    }

    const [result] = await conmysql.query(
      `SELECT
        p.*,
        c.cliente_codigo,
        u.usuario_nombre AS cliente_nombre,
        u.usuario_apellido AS cliente_apellido,
        u.usuario_nombre_completo AS cliente_nombre_completo,
        u.usuario_telefono AS cliente_telefono,
        l.local_codigo,
        l.local_nombre_comercial,
        l.local_razon_social,
        e.estado_nombre,
        mp.metodo_pago_nombre,
        mp.metodo_pago_descripcion,
        r.repartidor_codigo
      FROM pedidos p
      LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN locales l ON p.id_local = l.id_local
      LEFT JOIN estados e ON p.id_estado = e.id_estado
      LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
      LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
      WHERE p.pedido_codigo = ?
      LIMIT 1`,
      [String(codigo).trim()]
    );

    if (!result.length) return res.status(404).json({ success: false, message: "Pedido no encontrado" });

    const pedido = result[0];

    if (esAdministrativo(req)) return res.json(ocultarPedidoPin(pedido, req));

    if (tieneRol(req, ["LOCAL"])) {
      const local = await obtenerLocalDelUsuario(req);
      if (!local) return res.status(403).json({ success: false, message: "El usuario no tiene un local asociado." });
      if (Number(pedido.id_local) !== Number(local.id_local)) {
        return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
      }
      return res.json(ocultarPedidoPin(pedido, req));
    }

    if (tieneRol(req, ["REPARTIDOR"])) {
      const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
      if (Number(pedido.id_repartidor) !== Number(id_repartidor)) {
        return res.status(403).json({ success: false, message: "No puedes acceder a este pedido." });
      }
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

// PEDIDOS POR ESTADO
export const getPedidosPorEstado = async (req, res) => {
  try {
    const { id_estado } = req.params;
    if (!esIdValido(id_estado)) return res.status(400).json({ success: false, message: "El ID del estado no es válido." });
    if (!esAdministrativo(req)) {
      return res.status(403).json({ success: false, message: "No tienes permisos para consultar pedidos por estado." });
    }

    const [result] = await conmysql.query(
      `SELECT
        p.*,
        c.cliente_codigo,
        u.usuario_nombre_completo AS cliente_nombre,
        l.local_codigo,
        l.local_nombre_comercial,
        e.estado_nombre,
        mp.metodo_pago_nombre,
        r.repartidor_codigo
      FROM pedidos p
      LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN locales l ON p.id_local = l.id_local
      LEFT JOIN estados e ON p.id_estado = e.id_estado
      LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
      LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
      WHERE p.id_estado = ?
      ORDER BY p.id_pedido DESC`,
      [id_estado]
    );

    return res.json(ocultarPedidosPin(result, req));
  } catch (error) {
    console.error("[Pedidos] Error getPedidosPorEstado:", error);
    return res.status(500).json({ success: false, message: "Error al consultar pedidos por estado" });
  }
};

// CREAR PEDIDO
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

    let {
      id_cliente, id_local, id_local_sucursal, id_metodo_pago,
      pedido_cantidad_productos, pedido_subtotal_local, pedido_subtotal_app,
      pedido_adicional_volumen, pedido_carrera, pedido_propina, pedido_total,
      pedido_distancia_km, pedido_tiempo_estimado, pedido_cliente_latitud,
      pedido_cliente_longitud, pedido_local_latitud, pedido_local_longitud,
      pedido_observacion, id_estado, pedido_fecha, pedido_fecha_entrega,
      productos, detalles
    } = req.body;

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
      return res.status(400).json({ success: false, message: "El local es obligatorio" });
    }

    const listaDetalles = Array.isArray(detalles) ? detalles : productos;
    if (!Array.isArray(listaDetalles) || !listaDetalles.length) {
      conexion.release();
      return res.status(400).json({ success: false, message: "El pedido debe contener al menos un producto" });
    }

    await conexion.beginTransaction();
    transaccionIniciada = true;

    const [clientes] = await conexion.query(
      `SELECT id_cliente FROM clientes WHERE id_cliente = ? FOR UPDATE`,
      [id_cliente]
    );
    if (!clientes.length) throw new Error("El cliente no existe");

    const [locales] = await conexion.query(
      `SELECT id_local, local_latitud, local_longitud FROM locales WHERE id_local = ? FOR UPDATE`,
      [id_local]
    );
    if (!locales.length) throw new Error("El local no existe");

    const local = locales[0];
    if (pedido_local_latitud === undefined || pedido_local_latitud === null) pedido_local_latitud = local.local_latitud;
    if (pedido_local_longitud === undefined || pedido_local_longitud === null) pedido_local_longitud = local.local_longitud;

    if (id_metodo_pago !== undefined && id_metodo_pago !== null) {
      const [metodos] = await conexion.query(
        `SELECT id_metodo_pago FROM metodos_pago WHERE id_metodo_pago = ? AND metodo_pago_estado = 1`,
        [id_metodo_pago]
      );
      if (!metodos.length) throw new Error("El método de pago no existe o está inactivo");
    }

    const [ultimo] = await conexion.query(
      `SELECT pedido_codigo FROM pedidos ORDER BY id_pedido DESC LIMIT 1 FOR UPDATE`
    );

    let numero = 1;
    if (ultimo.length && ultimo[0].pedido_codigo) {
      const match = String(ultimo[0].pedido_codigo).match(/(\d+)$/);
      if (match) numero = parseInt(match[1], 10) + 1;
    }

    const pedido_codigo = `PED-${String(numero).padStart(5, "0")}`;
    pedido_pin = generarPedidoPin();

    const estadoInicial = await obtenerIdEstadoPorNombre("PENDIENTE");
    if (!estadoInicial) throw new Error('No existe el estado "PENDIENTE" en la tabla estados.');

    const [result] = await conexion.query(
      `INSERT INTO pedidos (
        pedido_codigo, pedido_pin, id_cliente, id_local, id_repartidor,
        id_local_sucursal, id_metodo_pago, pedido_fecha,
        pedido_cantidad_productos, pedido_subtotal_local, pedido_subtotal_app,
        pedido_adicional_volumen, pedido_carrera, pedido_propina, pedido_total,
        pedido_distancia_km, pedido_tiempo_estimado,
        pedido_cliente_latitud, pedido_cliente_longitud,
        pedido_local_latitud, pedido_local_longitud,
        pedido_observacion, id_estado, pedido_fecha_entrega
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pedido_codigo, pedido_pin, id_cliente, id_local, id_local_sucursal ?? null,
        id_metodo_pago ?? null, convertirFechaMySQL(pedido_fecha ?? new Date()),
        Number(pedido_cantidad_productos ?? 0), Number(pedido_subtotal_local ?? 0),
        Number(pedido_subtotal_app ?? 0), Number(pedido_adicional_volumen ?? 0),
        Number(pedido_carrera ?? 0), Number(pedido_propina ?? 0), Number(pedido_total ?? 0),
        Number(pedido_distancia_km ?? 0), Number(pedido_tiempo_estimado ?? 0),
        pedido_cliente_latitud ?? null, pedido_cliente_longitud ?? null,
        pedido_local_latitud ?? null, pedido_local_longitud ?? null,
        pedido_observacion ?? null, estadoInicial, pedido_fecha_entrega ?? null
      ]
    );

    id_pedido = result.insertId;
    const detallesRegistrados = [];

    for (const detalle of listaDetalles) {
      const id_local_producto = Number(detalle.id_local_producto);
      const cantidad = Number(detalle.pedido_detalle_cantidad ?? detalle.cantidad ?? 0);

      if (!id_local_producto) throw new Error("Cada producto debe tener id_local_producto");
      if (!Number.isInteger(cantidad) || cantidad <= 0) throw new Error("La cantidad de cada producto debe ser un entero mayor que 0");

      const [productosLocal] = await conexion.query(
        `SELECT
          lp.id_local_producto, lp.id_local, lp.id_producto,
          pr.producto_codigo, pr.producto_nombre, pr.producto_estado
        FROM local_productos lp
        INNER JOIN productos pr ON lp.id_producto = pr.id_producto
        WHERE lp.id_local_producto = ? AND lp.id_local = ?
        FOR UPDATE`,
        [id_local_producto, id_local]
      );

      if (!productosLocal.length) {
        throw new Error(`El producto del local ${id_local_producto} no existe o no pertenece al local del pedido`);
      }

      const producto = productosLocal[0];
      if (
        producto.producto_estado === null ||
        producto.producto_estado === undefined ||
        String(producto.producto_estado).trim().toUpperCase() !== "ACTIVO"
      ) {
        throw new Error(`El producto "${producto.producto_nombre}" no está disponible para comprar`);
      }

      const precioLocal = Number(detalle.pedido_detalle_precio_local ?? detalle.precioLocal ?? 0);
      const precioApp = Number(detalle.pedido_detalle_precio_app ?? detalle.precioApp ?? 0);
      const subtotalLocal = Number(detalle.pedido_detalle_subtotal_local ?? detalle.subtotalLocal ?? precioLocal * cantidad);
      const subtotalApp = Number(detalle.pedido_detalle_subtotal_app ?? detalle.subtotalApp ?? precioApp * cantidad);

      const [detalleResult] = await conexion.query(
        `INSERT INTO pedido_detalles (
          id_pedido, id_local_producto, pedido_detalle_cantidad,
          pedido_detalle_precio_local, pedido_detalle_precio_app,
          pedido_detalle_subtotal_local, pedido_detalle_subtotal_app,
          pedido_detalle_observacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_pedido, id_local_producto, cantidad, precioLocal, precioApp,
          subtotalLocal, subtotalApp,
          detalle.pedido_detalle_observacion ?? detalle.observacion ?? null
        ]
      );

      detallesRegistrados.push({
        id_pedido_detalle: detalleResult.insertId,
        id_local_producto, cantidad, precioLocal, precioApp,
        subtotalLocal, subtotalApp
      });
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
      message: "Pedido registrado con éxito",
      asignacion: {
        asignado: false,
        motivo: "La asignación se realizará cuando el local acepte el pedido y lo ponga EN_PREPARACION."
      },
      detalles: detallesRegistrados,
      pedido_pin
    });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await conexion.rollback();
      } catch (e) {
        console.error("[Pedidos] Error rollback:", e);
      }
    }

    console.error("[Pedidos] Error postPedido:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error al registrar pedido"
    });
  } finally {
    conexion.release();
  }
};

// CAMPOS MODIFICABLES
const CAMPOS_PEDIDO_ADMIN = [
  "pedido_codigo", "id_cliente", "id_local", "id_repartidor",
  "id_local_sucursal", "id_metodo_pago", "pedido_fecha",
  "pedido_cantidad_productos", "pedido_subtotal_local", "pedido_subtotal_app",
  "pedido_adicional_volumen", "pedido_carrera", "pedido_propina", "pedido_total",
  "pedido_distancia_km", "pedido_tiempo_estimado",
  "pedido_cliente_latitud", "pedido_cliente_longitud",
  "pedido_local_latitud", "pedido_local_longitud",
  "pedido_observacion", "id_estado", "pedido_fecha_entrega"
];

const CAMPOS_PEDIDO_LOCAL = ["pedido_observacion", "id_estado", "pedido_fecha_entrega"];

const CAMPOS_PEDIDO_CLIENTE = [
  "pedido_observacion", "id_estado",
  "pedido_cliente_latitud", "pedido_cliente_longitud",
  "pedido_fecha_entrega"
];

// ACTUALIZAR PEDIDO
export const putPedido = async (req, res) => {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    const pedido = await obtenerPedidoPorIdInterno(id);
    if (!pedido) return res.status(404).json({ success: false, message: "Pedido no encontrado" });

    const rol = obtenerRol(req);

    if (tieneRol(req, ["CENTRAL", "SUPERVISOR"])) {
      return res.status(403).json({ success: false, message: "CENTRAL y SUPERVISOR no tienen permisos para modificar pedidos." });
    }

    if (tieneRol(req, ["REPARTIDOR"])) {
      const id_repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));

      if (Number(pedido.id_repartidor) !== Number(id_repartidor)) {
        return res.status(403).json({ success: false, message: "No puedes modificar este pedido." });
      }

      const camposNoPermitidos = Object.keys(req.body).filter(campo => campo !== "id_estado");
      if (camposNoPermitidos.length) {
        return res.status(403).json({ success: false, message: "El repartidor solo puede modificar el estado del pedido." });
      }
    }

    if (tieneRol(req, ["CLIENTE"])) {
      if (!(await verificarAccesoCliente(req, res, pedido.id_cliente))) return;

      const permitidos = ["id_estado", "pedido_observacion", "pedido_cliente_latitud", "pedido_cliente_longitud", "pedido_fecha_entrega"];
      const noPermitidos = Object.keys(req.body).filter(campo => !permitidos.includes(campo));

      if (noPermitidos.length) {
        return res.status(403).json({ success: false, message: "El cliente no puede modificar esos campos del pedido." });
      }
    }

    if (tieneRol(req, ["LOCAL"])) {
      const local = await obtenerLocalDelUsuario(req);
      if (!local) return res.status(403).json({ success: false, message: "El usuario no tiene un local asociado." });

      if (Number(pedido.id_local) !== Number(local.id_local)) {
        return res.status(403).json({ success: false, message: "No puedes modificar pedidos de otro local." });
      }

      if (req.body.id_repartidor !== undefined) {
        return res.status(403).json({ success: false, message: "El local no puede asignar manualmente un repartidor." });
      }

      const permitidos = ["id_estado", "pedido_observacion", "pedido_fecha_entrega"];
      const noPermitidos = Object.keys(req.body).filter(campo => !permitidos.includes(campo));

      if (noPermitidos.length) {
        return res.status(403).json({ success: false, message: "El local no puede modificar esos campos del pedido." });
      }
    }

    if (!puedeModificarPedidos(req)) {
      return res.status(403).json({
        success: false,
        message: `El rol ${rol || "SIN_ROL"} no tiene permisos para modificar pedidos.`
      });
    }

    let camposPermitidos = [];
    if (tieneRol(req, ["CLIENTE"])) camposPermitidos = CAMPOS_PEDIDO_CLIENTE;
    else if (tieneRol(req, ["LOCAL"])) camposPermitidos = CAMPOS_PEDIDO_LOCAL;
    else if (tieneRol(req, ["REPARTIDOR"])) camposPermitidos = ["id_estado"];
    else if (tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) camposPermitidos = CAMPOS_PEDIDO_ADMIN;

    let transicionAEnPreparacion = false;
    let transicionAEntregado = false;

    if (req.body.id_estado !== undefined && req.body.id_estado !== null) {
      const validacionEstado = await validarTransicionEstado(req, pedido, req.body.id_estado);

      if (!validacionEstado.valido) {
        return res.status(validacionEstado.status).json({
          success: false,
          message: validacionEstado.message
        });
      }

      transicionAEnPreparacion =
        !validacionEstado.mismoEstado &&
        validacionEstado.estadoActual === "PENDIENTE" &&
        validacionEstado.nuevoEstado === "EN_PREPARACION";

      transicionAEntregado =
        !validacionEstado.mismoEstado &&
        validacionEstado.estadoActual === "EN_CAMINO" &&
        validacionEstado.nuevoEstado === "ENTREGADO";
    }

    const campos = [], valores = [];

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        let valor = req.body[campo];
        if (campo === "pedido_fecha" && valor) valor = convertirFechaMySQL(valor);
        campos.push(`${campo} = ?`);
        valores.push(valor);
      }
    }

    if (!campos.length) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionaron campos válidos para actualizar."
      });
    }

    valores.push(id);

    const [result] = await conmysql.query(
      `UPDATE pedidos SET ${campos.join(", ")} WHERE id_pedido = ?`,
      valores
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "No se encontró el pedido para actualizar." });
    }

    let pagoLocal = null, asignacion = null;

    // Asignación automática al aceptar el pedido
    if (transicionAEnPreparacion) {
      console.log("[Pedidos] PENDIENTE -> EN_PREPARACION. Asignando repartidor automáticamente:", {
        id_pedido: Number(id), id_local: pedido.id_local
      });

      try {
        asignacion = await asignarRepartidorAutomaticamente(Number(id));
        console.log("[Pedidos] Asignación procesada:", asignacion);
      } catch (errorAsignacion) {
        console.error("[Pedidos] Error asignando repartidor:", errorAsignacion);
        asignacion = {
          asignado: false,
          existente: false,
          error: true,
          motivo: "El pedido quedó EN_PREPARACION, pero no se pudo realizar la asignación automática."
        };
      }
    }

    // Generar pago local al entregar
    if (transicionAEntregado) {
      console.log("[Pedidos] EN_CAMINO -> ENTREGADO. Generando pago local:", {
        id_pedido: Number(id), id_local: pedido.id_local
      });

      try {
        pagoLocal = await crearPagoLocalDesdePedido(Number(id));
        console.log("[Pedidos] Pago local procesado:", pagoLocal);
      } catch (errorPago) {
        console.error("[Pedidos] Error creando pago local:", errorPago);
        pagoLocal = {
          creado: false,
          existente: false,
          error: true,
          motivo: "El pedido quedó ENTREGADO, pero no se pudo generar el pago local.",
          error_detalle: process.env.NODE_ENV === "development" ? errorPago.message : undefined
        };
      }
    }

    const pedidoActualizado = await obtenerPedidoPorIdInterno(id);

    return res.json({
      success: true,
      ...ocultarPedidoPin(pedidoActualizado, req),
      pago_local: pagoLocal,
      asignacion
    });
  } catch (error) {
    console.error("[Pedidos] Error putPedido:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar pedido",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// PATCH usa la misma lógica
export const patchPedido = async (req, res) => putPedido(req, res);

// ELIMINAR PEDIDO
export const deletePedido = async (req, res) => {
  const conexion = await conmysql.getConnection();
  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    if (!esIdValido(id)) {
      conexion.release();
      return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
    }

    if (!req.usuario) {
      conexion.release();
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }

    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) {
      conexion.release();
      return res.status(403).json({
        success: false,
        message: "Solo SOPORTE y ADMINISTRADOR pueden eliminar pedidos."
      });
    }

    const pedido = await obtenerPedidoPorIdInterno(id);

    if (!pedido) {
      conexion.release();
      return res.status(404).json({ success: false, message: "Pedido no encontrado" });
    }

    await conexion.beginTransaction();
    transaccionIniciada = true;

    await conexion.query(`DELETE FROM pedido_repartidores WHERE id_pedido = ?`, [id]);
    await conexion.query(`DELETE FROM pedido_detalles WHERE id_pedido = ?`, [id]);

    const [result] = await conexion.query(`DELETE FROM pedidos WHERE id_pedido = ?`, [id]);

    if (!result.affectedRows) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ success: false, message: "No se pudo eliminar el pedido" });
    }

    await conexion.commit();
    transaccionIniciada = false;
    return res.status(204).send();
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await conexion.rollback();
      } catch (e) {
        console.error("[Pedidos] Error rollback:", e);
      }
    }

    console.error("[Pedidos] Error deletePedido:", error);
    return res.status(500).json({ success: false, message: "Error al eliminar pedido" });
  } finally {
    conexion.release();
  }
};

// EXPORTACIONES AUXILIARES
export {
  obtenerRol,
  obtenerRoles,
  obtenerIdUsuario,
  obtenerClienteDelUsuario,
  obtenerLocalDelUsuario,
  obtenerRepartidorDelUsuario,
  verificarAccesoCliente,
  obtenerPedidoPorIdInterno,
  generarPedidoPin,
  ocultarPedidoPin,
  ocultarPedidosPin,
  esAdministrativo,
  tieneRol
};
