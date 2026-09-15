import { conmysql } from "../db.js";

// Comisión que se descuenta al repartidor (solo sobre la carrera).
const PORCENTAJE_COMISION_REPARTIDOR = 7.5;

// Utilidades
const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;

const obtenerIdUsuario = req => {
  const u = req.usuario || {};
  return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

const obtenerRol = req => {
  const u = req.usuario || {};
  const rol = u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.usuario_role ?? u.rol_nombre ?? u.nombre_rol;
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

const tieneRol = (req, rolesPermitidos = []) => {
  const rol = obtenerRol(req);
  return rolesPermitidos.map(r => String(r).trim().toUpperCase()).includes(rol);
};

/**
 * Obtiene los datos del pedido necesarios para generar el pago del repartidor.
 */
const obtenerPedidoParaPago = async (conexion, id_pedido, bloquear = false) => {
  const lock = bloquear ? " FOR UPDATE" : "";
  const [rows] = await conexion.query(`
    SELECT 
      p.id_pedido, p.pedido_codigo, p.id_repartidor, 
      p.pedido_carrera, p.pedido_propina, p.pedido_total, p.id_estado,
      e.estado_nombre, 
      r.repartidor_codigo, r.id_usuario AS repartidor_id_usuario,
      u.usuario_nombre, u.usuario_apellido, u.usuario_nombre_completo
    FROM pedidos p
    LEFT JOIN estados e ON p.id_estado = e.id_estado
    LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
    LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
    WHERE p.id_pedido = ?
    LIMIT 1
    ${lock}
  `, [id_pedido]);
  return rows.length ? rows[0] : null;
};

/**
 * Busca un pago existente para evitar duplicados (idempotencia).
 */
const obtenerPagoExistente = async (conexion, id_pedido, bloquear = false) => {
  const lock = bloquear ? " FOR UPDATE" : "";
  const [rows] = await conexion.query(`
    SELECT * FROM pagos_repartidores
    WHERE id_pedido = ?
    LIMIT 1
    ${lock}
  `, [id_pedido]);
  return rows.length ? rows[0] : null;
};

/**
 * Crea el pago del repartidor cuando el pedido pasa a ENTREGADO.
 * Es idempotente: no duplica pagos existentes.
 * Comisión 7.5 % solo sobre la carrera; la propina se entrega completa.
 */
export const crearPagoRepartidorDesdePedido = async (id_pedido, conexionExterna = null) => {
  if (!esIdValido(id_pedido)) {
    throw new Error("El ID del pedido no es válido.");
  }

  const idPedido = Number(id_pedido);
  const usaConexionExterna = !!conexionExterna;
  const conexion = conexionExterna || await conmysql.getConnection();

  try {
    if (!usaConexionExterna) {
      await conexion.beginTransaction();
    }

    // Verificar si ya existe pago (idempotencia)
    const pagoExistente = await obtenerPagoExistente(conexion, idPedido, true);
    if (pagoExistente) {
      if (!usaConexionExterna) await conexion.commit();
      console.log(`[PagosRepartidor] El pedido ${idPedido} ya tiene pago de repartidor. No se duplica.`);
      return {
        creado: false,
        existente: true,
        success: true,
        mensaje: "El pago del repartidor ya existe.",
        pago: pagoExistente
      };
    }

    // Obtener datos del pedido
    const pedido = await obtenerPedidoParaPago(conexion, idPedido, true);
    if (!pedido) {
      throw new Error("El pedido no existe.");
    }

    const estadoPedido = String(pedido.estado_nombre || "").trim().toUpperCase();
    if (estadoPedido !== "ENTREGADO") {
      throw new Error(
        `El pago del repartidor solo puede generarse cuando el pedido está ENTREGADO. Estado actual: ${estadoPedido || "DESCONOCIDO"}`
      );
    }

    if (!pedido.id_repartidor) {
      throw new Error(`El pedido ${idPedido} no tiene un repartidor asignado.`);
    }

    // Cálculos
    const carrera = Number(pedido.pedido_carrera ?? 0);
    const propina = Number(pedido.pedido_propina ?? 0);

    if (!Number.isFinite(carrera) || carrera < 0) {
      throw new Error(`El pedido ${idPedido} tiene un pedido_carrera inválido.`);
    }
    if (!Number.isFinite(propina) || propina < 0) {
      throw new Error(`El pedido ${idPedido} tiene un pedido_propina inválido.`);
    }

    const porcentajeComision = PORCENTAJE_COMISION_REPARTIDOR;
    const comision = Number(((carrera * porcentajeComision) / 100).toFixed(2));
    // El repartidor recibe: (carrera - comisión) + propina completa
    const montoRepartidor = Number((carrera - comision + propina).toFixed(2));

    if (!Number.isFinite(montoRepartidor) || montoRepartidor < 0) {
      throw new Error("El monto calculado para el repartidor no es válido.");
    }

    // Insertar pago
    const [resultado] = await conexion.query(`
      INSERT INTO pagos_repartidores (
        id_pedido,
        id_repartidor,
        pago_repartidor_monto,
        pago_repartidor_estado,
        pago_repartidor_fecha
      ) VALUES (?, ?, ?, 'PENDIENTE', NOW())
    `, [idPedido, pedido.id_repartidor, montoRepartidor]);

    if (!usaConexionExterna) {
      await conexion.commit();
    }

    const [pagoCreado] = await conexion.query(`
      SELECT * FROM pagos_repartidores
      WHERE id_pagos_repartidores = ?
      LIMIT 1
    `, [resultado.insertId]);

    console.log("[PagosRepartidor] Pago creado automáticamente:", {
      id_pagos_repartidores: resultado.insertId,
      id_pedido: pedido.id_pedido,
      id_repartidor: pedido.id_repartidor,
      carrera,
      propina,
      porcentajeComision,
      comision,
      montoRepartidor
    });

    return {
      creado: true,
      existente: false,
      success: true,
      mensaje: "Pago del repartidor creado correctamente.",
      pago: pagoCreado[0] || {
        id_pagos_repartidores: resultado.insertId,
        id_pedido: idPedido,
        id_repartidor: pedido.id_repartidor,
        pago_repartidor_monto: montoRepartidor,
        pago_repartidor_estado: "PENDIENTE"
      },
      // Datos de cálculo (útiles para depuración / respuesta)
      calculo: {
        carrera,
        propina,
        porcentaje_comision: porcentajeComision,
        comision,
        monto_repartidor: montoRepartidor
      }
    };
  } catch (error) {
    if (!usaConexionExterna) {
      try {
        await conexion.rollback();
      } catch (rollbackError) {
        console.error("[PagosRepartidor] Error rollback:", rollbackError);
      }
    }
    console.error("[PagosRepartidor] Error crearPagoRepartidorDesdePedido:", error);
    throw error;
  } finally {
    if (!usaConexionExterna) {
      conexion.release();
    }
  }
};

/**
 * Crea manualmente el pago de un pedido (ruta administrativa).
 */
export const postPagoRepartidor = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) {
      return res.status(403).json({ success: false, message: "No tienes permisos para crear pagos a repartidores." });
    }

    const { id_pedido } = req.params;
    if (!esIdValido(id_pedido)) {
      return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
    }

    const resultado = await crearPagoRepartidorDesdePedido(Number(id_pedido));
    return res.status(resultado.existente ? 200 : 201).json(resultado);
  } catch (error) {
    console.error("[PagosRepartidor] Error postPagoRepartidor:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error al crear el pago del repartidor."
    });
  }
};

/**
 * Obtiene el pago asociado a un pedido.
 */
export const getPagoRepartidorPorPedido = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }

    const { id_pedido } = req.params;
    if (!esIdValido(id_pedido)) {
      return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
    }

    const [rows] = await conmysql.query(`
      SELECT 
        pr.*, 
        p.pedido_codigo, p.id_repartidor, p.pedido_carrera, p.pedido_propina,
        r.repartidor_codigo,
        u.usuario_nombre, u.usuario_apellido, u.usuario_nombre_completo,
        r.id_usuario AS repartidor_id_usuario
      FROM pagos_repartidores pr
      INNER JOIN pedidos p ON pr.id_pedido = p.id_pedido
      LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      WHERE pr.id_pedido = ?
      LIMIT 1
    `, [id_pedido]);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "El pedido todavía no tiene un pago para el repartidor."
      });
    }

    const pago = rows[0];

    // El repartidor solo puede consultar sus propios pagos
    if (tieneRol(req, ["REPARTIDOR"])) {
      const id_usuario = obtenerIdUsuario(req);
      if (Number(pago.repartidor_id_usuario) !== Number(id_usuario)) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para consultar este pago."
        });
      }
    } else if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"])) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para consultar pagos de repartidores."
      });
    }

    return res.json({ success: true, pago });
  } catch (error) {
    console.error("[PagosRepartidor] Error getPagoRepartidorPorPedido:", error);
    return res.status(500).json({
      success: false,
      message: "Error al consultar el pago del repartidor."
    });
  }
};

/**
 * Lista los pagos del repartidor autenticado.
 */
export const getMisPagosRepartidor = async (req, res) => {
    try {
        console.log("[PagosRepartidor] Usuario autenticado:", req.usuario);

        // Validar autenticación y rol.
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!tieneRol(req, ["REPARTIDOR"])) return res.status(403).json({ success: false, message: "Esta ruta solamente está disponible para repartidores." });

        // Obtener y validar el ID del usuario autenticado.
        const idUsuario = Number(req.usuario?.id_usuario ?? req.usuario?.usuario_id ?? req.usuario?.idUsuario ?? req.usuario?.id ?? req.usuario?.usuarioId);
        if (!Number.isInteger(idUsuario) || idUsuario <= 0) return res.status(403).json({ success: false, message: "No se pudo identificar al usuario autenticado." });

        console.log(`[PagosRepartidor] Buscando repartidor asociado al usuario ${idUsuario}`);

        // Buscar el repartidor asociado al usuario.
        const [repartidores] = await conmysql.query(
            `SELECT id_repartidor, id_usuario FROM repartidores WHERE id_usuario = ? LIMIT 1`,
            [idUsuario]
        );

        if (repartidores.length === 0) return res.status(403).json({ success: false, message: "El usuario autenticado no tiene un repartidor asociado." });

        const idRepartidor = Number(repartidores[0].id_repartidor);
        if (!Number.isInteger(idRepartidor) || idRepartidor <= 0) return res.status(403).json({ success: false, message: "El repartidor asociado al usuario no es válido." });

        console.log(`[PagosRepartidor] Usuario ${idUsuario} pertenece al repartidor ${idRepartidor}`);

        // Consultar únicamente los pagos del repartidor autenticado.
        const [pagos] = await conmysql.query(
            `SELECT pr.*, p.pedido_codigo, p.pedido_fecha, p.pedido_fecha_entrega, p.pedido_carrera, p.pedido_propina, l.local_nombre_comercial
             FROM pagos_repartidores pr
             INNER JOIN pedidos p ON pr.id_pedido = p.id_pedido
             LEFT JOIN locales l ON p.id_local = l.id_local
             WHERE pr.id_repartidor = ?
             ORDER BY pr.id_pagos_repartidores DESC`,
            [idRepartidor]
        );

        console.log(`[PagosRepartidor] Se encontraron ${pagos.length} pagos para el repartidor ${idRepartidor}`);

        return res.json({ success: true, id_repartidor: idRepartidor, pagos });
    } catch (error) {
        console.error("[PagosRepartidor] Error getMisPagosRepartidor:", error);
        return res.status(500).json({ success: false, message: "Error al consultar los pagos del repartidor.", error: error.message });
    }
};


/**
 * Actualiza el estado de un pago.
 */
export const actualizarEstadoPagoRepartidor = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para actualizar pagos."
      });
    }

    const { id } = req.params;
    const { estado } = req.body;

    if (!esIdValido(id)) {
      return res.status(400).json({ success: false, message: "El ID del pago no es válido." });
    }

    const estadosPermitidos = ["PENDIENTE", "PAGADO", "CANCELADO"];
    const nuevoEstado = String(estado || "").trim().toUpperCase();

    if (!estadosPermitidos.includes(nuevoEstado)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Estados permitidos: ${estadosPermitidos.join(", ")}.`
      });
    }

    const [existente] = await conmysql.query(`
      SELECT * FROM pagos_repartidores
      WHERE id_pagos_repartidores = ?
      LIMIT 1
    `, [id]);

    if (!existente.length) {
      return res.status(404).json({ success: false, message: "Pago no encontrado." });
    }

    await conmysql.query(`
      UPDATE pagos_repartidores
      SET pago_repartidor_estado = ?
      WHERE id_pagos_repartidores = ?
    `, [nuevoEstado, id]);

    const [actualizado] = await conmysql.query(`
      SELECT * FROM pagos_repartidores
      WHERE id_pagos_repartidores = ?
      LIMIT 1
    `, [id]);

    return res.json({
      success: true,
      message: "Estado del pago actualizado correctamente.",
      pago: actualizado[0]
    });
  } catch (error) {
    console.error("[PagosRepartidor] Error actualizarEstadoPagoRepartidor:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar el estado del pago."
    });
  }
};

/**
 * Lista todos los pagos de repartidores (administrativo).
 */
export const getPagosRepartidores = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"])) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para consultar pagos de repartidores."
      });
    }

    const [pagos] = await conmysql.query(`
      SELECT 
        pr.*, 
        p.pedido_codigo, p.pedido_fecha, p.pedido_fecha_entrega,
        p.pedido_total, p.pedido_carrera, p.pedido_propina,
        r.repartidor_codigo, r.id_usuario AS repartidor_id_usuario,
        u.usuario_nombre, u.usuario_apellido, u.usuario_nombre_completo
      FROM pagos_repartidores pr
      INNER JOIN pedidos p ON pr.id_pedido = p.id_pedido
      INNER JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      ORDER BY pr.id_pagos_repartidores DESC
    `);

    return res.json({ success: true, pagos });
  } catch (error) {
    console.error("[PagosRepartidor] Error getPagosRepartidores:", error);
    return res.status(500).json({
      success: false,
      message: "Error al consultar los pagos de repartidores."
    });
  }
};

// Exportaciones
export default {
  crearPagoRepartidorDesdePedido,
  postPagoRepartidor,
  getPagoRepartidorPorPedido,
  getMisPagosRepartidor,
  actualizarEstadoPagoRepartidor,
  getPagosRepartidores
};
