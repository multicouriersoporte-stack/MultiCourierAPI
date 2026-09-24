import { conmysql } from "../db.js";
import { clasificarMetodoPago, calcularPagoRepartidor as calcularPago } from "../servicios/finanzasCalculos.js";

// CONFIGURACIÓN
const PORCENTAJE_COMISION_REPARTIDOR = 7.5;

// UTILIDADES
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

// Fragmentos SQL compartidos por las consultas de lectura (evita errores de comas/JOIN).
const CAMPOS_PAGO_EXTRA = `
  mp.metodo_pago_nombre,
  pr.pago_repartidor_metodo_tipo,
  COALESCE((SELECT SUM(a.pago_ajuste_monto) FROM pagos_ajustes a
            WHERE a.pago_ajuste_beneficiario='REPARTIDOR' AND a.id_pago=pr.id_pago_repartidor),0) AS pago_repartidor_ajustes,
  (pr.pago_repartidor_carrera + pr.pago_repartidor_comision) AS pago_repartidor_carrera_bruta`;
const JOIN_METODO_PAGO = `LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago`;

// CONSULTAS AUXILIARES
const obtenerPedidoParaPago = async (conexion, id_pedido, bloquear = false) => {
  const lock = bloquear ? " FOR UPDATE" : "";
  const [rows] = await conexion.query(`
    SELECT p.id_pedido,p.pedido_codigo,p.id_repartidor,p.id_metodo_pago,p.pedido_carrera,p.pedido_propina,p.pedido_total,p.id_estado,
           e.estado_nombre,mp.metodo_pago_nombre,mp.metodo_pago_es_efectivo,
           r.repartidor_codigo,r.id_usuario AS repartidor_id_usuario,u.usuario_nombre,u.usuario_apellido,u.usuario_nombre_completo
    FROM pedidos p
    LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
    LEFT JOIN estados e ON p.id_estado = e.id_estado
    LEFT JOIN repartidores r ON p.id_repartidor = r.id_repartidor
    LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
    WHERE p.id_pedido = ? LIMIT 1${lock}
  `, [id_pedido]);
  return rows.length ? rows[0] : null;
};

const obtenerPagoExistente = async (conexion, id_pedido, bloquear = false) => {
  const lock = bloquear ? " FOR UPDATE" : "";
  const [rows] = await conexion.query(`SELECT * FROM pagos_repartidor WHERE id_pedido = ? LIMIT 1${lock}`, [id_pedido]);
  return rows.length ? rows[0] : null;
};

// CREA EL PAGO AUTOMÁTICO DEL REPARTIDOR AL ENTREGAR EL PEDIDO
export const crearPagoRepartidorDesdePedido = async (id_pedido, conexionExterna = null) => {
  if (!esIdValido(id_pedido)) throw new Error("El ID del pedido no es válido.");

  const idPedido = Number(id_pedido), usaConexionExterna = !!conexionExterna;
  const conexion = conexionExterna || await conmysql.getConnection();

  try {
    if (!usaConexionExterna) await conexion.beginTransaction();

    // Evita pagos duplicados.
    const pagoExistente = await obtenerPagoExistente(conexion, idPedido, true);
    if (pagoExistente) {
      if (!usaConexionExterna) await conexion.commit();
      console.log(`[PagosRepartidor] El pedido ${idPedido} ya tiene pago.`);
      return { creado: false, existente: true, success: true, mensaje: "El pago del repartidor ya existe.", pago: pagoExistente };
    }

    // Obtiene y valida el pedido.
    const pedido = await obtenerPedidoParaPago(conexion, idPedido, true);
    if (!pedido) throw new Error("El pedido no existe.");

    const estadoPedido = String(pedido.estado_nombre || "").trim().toUpperCase();
    if (estadoPedido !== "ENTREGADO") throw new Error(`El pago del repartidor solo puede generarse cuando el pedido está ENTREGADO. Estado actual: ${estadoPedido || "DESCONOCIDO"}`);
    if (!pedido.id_repartidor) throw new Error(`El pedido ${idPedido} no tiene un repartidor asignado.`);

    const carrera = Number(pedido.pedido_carrera ?? 0), propina = Number(pedido.pedido_propina ?? 0);
    if (!Number.isFinite(carrera) || carrera < 0) throw new Error(`El pedido ${idPedido} tiene un pedido_carrera inválido.`);
    if (!Number.isFinite(propina) || propina < 0) throw new Error(`El pedido ${idPedido} tiene un pedido_propina inválido.`);

    // Clasifica el método y calcula el pago neto del repartidor.
    const tipoPago = clasificarMetodoPago(pedido);
    if (!tipoPago) throw new Error("El método de pago del pedido no está clasificado como ONLINE/EFECTIVO.");

    const { porcentajeComision, comision, carreraNeta: carreraRepartidor, propina: propinaRepartidor, total: montoRepartidor } =
      calcularPago({ carrera, propina, porcentajeComision: PORCENTAJE_COMISION_REPARTIDOR });

    // pago_repartidor_total es GENERATED; MySQL lo calcula automáticamente.
    const [resultado] = await conexion.query(`
      INSERT INTO pagos_repartidor (
        id_pedido,id_repartidor,pago_repartidor_fecha,pago_repartidor_carrera,pago_repartidor_propina,
        pago_repartidor_otros,pago_repartidor_comision_porcentaje,pago_repartidor_comision,pago_repartidor_estado,
        id_metodo_pago,pago_repartidor_metodo_tipo
      ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?)
    `, [idPedido, pedido.id_repartidor, carreraRepartidor, propinaRepartidor, 0, porcentajeComision, comision, pedido.id_metodo_pago, tipoPago]);

    // Verifica que el total GENERATED coincida con el cálculo de la aplicación.
    const [chk] = await conexion.query(`SELECT pago_repartidor_total FROM pagos_repartidor WHERE id_pago_repartidor = ?`, [resultado.insertId]);
    if (Math.abs(Number(chk[0].pago_repartidor_total) - montoRepartidor) > 0.005)
      throw new Error(`pago_repartidor_total (${chk[0].pago_repartidor_total}) no coincide con el cálculo esperado (${montoRepartidor}). Revisar la fórmula de la columna generada.`);

    if (!usaConexionExterna) await conexion.commit();

    const [pagoCreado] = await conexion.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ? LIMIT 1`, [resultado.insertId]);

    console.log("[PagosRepartidor] Pago creado:", {
      id_pago_repartidor: resultado.insertId, id_pedido: pedido.id_pedido, id_repartidor: pedido.id_repartidor,
      tipo_pago: tipoPago, carrera, propina, pago_repartidor_carrera: carreraRepartidor, pago_repartidor_propina: propinaRepartidor,
      pago_repartidor_comision_porcentaje: porcentajeComision, pago_repartidor_comision: comision, pago_repartidor_total: montoRepartidor
    });

    return {
      creado: true,
      existente: false,
      success: true,
      mensaje: "Pago del repartidor creado correctamente.",
      pago: pagoCreado[0] || null,
      calculo: { carrera, propina, porcentaje_comision: porcentajeComision, comision, carrera_repartidor: carreraRepartidor, propina_repartidor: propinaRepartidor, monto_repartidor: montoRepartidor }
    };
  } catch (error) {
    if (!usaConexionExterna) {
      try { await conexion.rollback(); }
      catch (rollbackError) { console.error("[PagosRepartidor] Error rollback:", rollbackError); }
    }
    console.error("[PagosRepartidor] Error crearPagoRepartidorDesdePedido:", error);
    throw error;
  } finally {
    if (!usaConexionExterna) conexion.release();
  }
};

// CREA UN PAGO MANUALMENTE: SOLO SOPORTE Y ADMINISTRADOR
// Pasa por el servicio financiero para que, si el pedido fue en efectivo, el cobro también quede en Balance.
// (import dinámico: finanzasService importa este archivo; así se evita el ciclo de módulos)
export const postPagoRepartidor = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "No tienes permisos para crear pagos a repartidores." });

    const { id_pedido } = req.params;
    if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });

    const { procesarEntregaFinanciera } = await import("../servicios/finanzasService.js");
    const finanzas = await procesarEntregaFinanciera(Number(id_pedido));
    const resultado = finanzas.pago_repartidor;

    return res.status(resultado.existente ? 200 : 201).json({
      ...resultado, tipo_pago: finanzas.tipo_pago, balance: finanzas.balance, efectivo: finanzas.efectivo
    });
  } catch (error) {
    console.error("[PagosRepartidor] Error postPagoRepartidor:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message || "Error al crear el pago del repartidor.", codigo: error.codigo });
  }
};

// CONSULTA EL PAGO ASOCIADO A UN PEDIDO
export const getPagoRepartidorPorPedido = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    const { id_pedido } = req.params;
    if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });

    const [rows] = await conmysql.query(`
      SELECT pr.*,p.pedido_codigo,p.pedido_carrera,p.pedido_propina,
             r.repartidor_codigo,u.usuario_nombre,u.usuario_apellido,u.usuario_nombre_completo,r.id_usuario AS repartidor_id_usuario,
             ${CAMPOS_PAGO_EXTRA}
      FROM pagos_repartidor pr
      INNER JOIN pedidos p ON pr.id_pedido = p.id_pedido
      ${JOIN_METODO_PAGO}
      LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      WHERE pr.id_pedido = ? LIMIT 1
    `, [id_pedido]);

    if (!rows.length) return res.status(404).json({ success: false, message: "El pedido todavía no tiene un pago para el repartidor." });

    const pago = rows[0];

    // El repartidor únicamente puede consultar sus propios pagos.
    if (tieneRol(req, ["REPARTIDOR"])) {
      const id_usuario = obtenerIdUsuario(req);
      if (Number(pago.repartidor_id_usuario) !== Number(id_usuario)) return res.status(403).json({ success: false, message: "No tienes permisos para consultar este pago." });
    } else if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"])) {
      return res.status(403).json({ success: false, message: "No tienes permisos para consultar pagos de repartidores." });
    }

    return res.json({ success: true, pago });
  } catch (error) {
    console.error("[PagosRepartidor] Error getPagoRepartidorPorPedido:", error);
    return res.status(500).json({ success: false, message: "Error al consultar el pago del repartidor.", error: error.message });
  }
};

// OBTIENE TODOS LOS PAGOS DEL REPARTIDOR AUTENTICADO
export const getMisPagosRepartidor = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    if (!tieneRol(req, ["REPARTIDOR"])) return res.status(403).json({ success: false, message: "Esta ruta solamente está disponible para repartidores." });

    const idUsuario = Number(obtenerIdUsuario(req));
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) return res.status(403).json({ success: false, message: "No se pudo identificar al usuario autenticado." });

    const [repartidores] = await conmysql.query(`SELECT id_repartidor,id_usuario FROM repartidores WHERE id_usuario = ? LIMIT 1`, [idUsuario]);
    if (!repartidores.length) return res.status(403).json({ success: false, message: "El usuario autenticado no tiene un repartidor asociado." });

    const idRepartidor = Number(repartidores[0].id_repartidor);
    if (!Number.isInteger(idRepartidor) || idRepartidor <= 0) return res.status(403).json({ success: false, message: "El repartidor asociado al usuario no es válido." });

    const [pagos] = await conmysql.query(`
      SELECT pr.*,p.pedido_codigo,p.pedido_fecha,p.pedido_fecha_entrega,p.pedido_carrera,p.pedido_propina,
             l.local_nombre_comercial,
             ${CAMPOS_PAGO_EXTRA}
      FROM pagos_repartidor pr
      INNER JOIN pedidos p ON pr.id_pedido = p.id_pedido
      ${JOIN_METODO_PAGO}
      LEFT JOIN locales l ON p.id_local = l.id_local
      WHERE pr.id_repartidor = ?
      ORDER BY pr.id_pago_repartidor DESC
    `, [idRepartidor]);

    return res.json({ success: true, id_repartidor: idRepartidor, pagos });
  } catch (error) {
    console.error("[PagosRepartidor] Error getMisPagosRepartidor:", error);
    return res.status(500).json({ success: false, message: "Error al consultar los pagos del repartidor.", error: error.message });
  }
};

// ACTUALIZA EL ESTADO DEL PAGO
export const actualizarEstadoPagoRepartidor = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "No tienes permisos para actualizar pagos." });

    const { id } = req.params;
    const { estado } = req.body;
    if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pago no es válido." });

    const estadosPermitidos = ["PENDIENTE", "PAGADO", "CANCELADO"];
    const nuevoEstado = String(estado || "").trim().toUpperCase();
    if (!estadosPermitidos.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, message: `Estado inválido. Estados permitidos: ${estadosPermitidos.join(", ")}.` });
    }

    const [existente] = await conmysql.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ? LIMIT 1`, [id]);
    if (!existente.length) return res.status(404).json({ success: false, message: "Pago no encontrado." });

    await conmysql.query(`UPDATE pagos_repartidor SET pago_repartidor_estado = ? WHERE id_pago_repartidor = ?`, [nuevoEstado, id]);
    const [actualizado] = await conmysql.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ? LIMIT 1`, [id]);

    return res.json({ success: true, message: "Estado del pago actualizado correctamente.", pago: actualizado[0] });
  } catch (error) {
    console.error("[PagosRepartidor] Error actualizarEstadoPagoRepartidor:", error);
    return res.status(500).json({ success: false, message: "Error al actualizar el estado del pago.", error: error.message });
  }
};

// LISTA TODOS LOS PAGOS PARA ROLES ADMINISTRATIVOS
export const getPagosRepartidores = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"])) {
      return res.status(403).json({ success: false, message: "No tienes permisos para consultar pagos de repartidores." });
    }

    const [pagos] = await conmysql.query(`
      SELECT pr.*,p.pedido_codigo,p.pedido_fecha,p.pedido_fecha_entrega,p.pedido_total,p.pedido_carrera,p.pedido_propina,
             r.repartidor_codigo,r.id_usuario AS repartidor_id_usuario,u.usuario_nombre,u.usuario_apellido,u.usuario_nombre_completo,
             ${CAMPOS_PAGO_EXTRA}
      FROM pagos_repartidor pr
      INNER JOIN pedidos p ON pr.id_pedido = p.id_pedido
      ${JOIN_METODO_PAGO}
      INNER JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      ORDER BY pr.id_pago_repartidor DESC
    `);

    return res.json({ success: true, pagos });
  } catch (error) {
    console.error("[PagosRepartidor] Error getPagosRepartidores:", error);
    return res.status(500).json({ success: false, message: "Error al consultar pagos de repartidores.", error: error.message });
  }
};

// EXPORTACIONES
export default {
  crearPagoRepartidorDesdePedido,
  postPagoRepartidor,
  getPagoRepartidorPorPedido,
  getMisPagosRepartidor,
  actualizarEstadoPagoRepartidor,
  getPagosRepartidores
};
