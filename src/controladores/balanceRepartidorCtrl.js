import { conmysql } from "../db.js";

// =====================================================================
// Balance/deuda de efectivo del repartidor. Concepto INDEPENDIENTE de
// pagos_repartidor (ganancias). Nunca se debe modificar desde el flujo
// de confirmación de ganancias, ni viceversa.
// =====================================================================

const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;

const obtenerIdUsuario = req => {
  const u = req.usuario || {};
  return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

const obtenerRol = req => {
  const u = req.usuario || {};
  const rol = u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.rol_nombre;
  return String(rol || "").trim().toUpperCase();
};

const tieneRol = (req, roles = []) => roles.map(r => r.toUpperCase()).includes(obtenerRol(req));

/**
 * Balance actual (deuda de efectivo) + historial de movimientos.
 * El repartidor solo ve el suyo; roles administrativos ven cualquiera.
 * GET /repartidores/:id_repartidor/balance
 */
export const getBalanceRepartidor = async (req, res) => {
  try {
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

    const id_repartidor = Number(req.params.id_repartidor);
    if (!esIdValido(id_repartidor)) return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." });

    if (tieneRol(req, ["REPARTIDOR"])) {
      const idUsuario = obtenerIdUsuario(req);
      const [propio] = await conmysql.query(`SELECT id_repartidor FROM repartidores WHERE id_repartidor = ? AND id_usuario = ? LIMIT 1`, [id_repartidor, idUsuario]);
      if (!propio.length) return res.status(403).json({ success: false, message: "No puedes consultar el balance de otro repartidor." });
    } else if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR", "CENTRAL", "SUPERVISOR"])) {
      return res.status(403).json({ success: false, message: "No tienes permisos para consultar este balance." });
    }

    const [repartidores] = await conmysql.query(
      `SELECT id_repartidor, repartidor_codigo, repartidor_balance_efectivo FROM repartidores WHERE id_repartidor = ? LIMIT 1`,
      [id_repartidor]
    );
    if (!repartidores.length) return res.status(404).json({ success: false, message: "Repartidor no encontrado." });

    const [movimientos] = await conmysql.query(
      `SELECT * FROM repartidor_balance_movimientos WHERE id_repartidor = ? ORDER BY movimiento_fecha DESC, id_movimiento DESC`,
      [id_repartidor]
    );

    return res.json({
      success: true,
      repartidor: repartidores[0],
      balance_pendiente: Number(repartidores[0].repartidor_balance_efectivo || 0),
      movimientos
    });
  } catch (error) {
    console.error("[BalanceRepartidor] Error getBalanceRepartidor:", error);
    return res.status(500).json({ success: false, message: "Error al consultar el balance del repartidor.", error: error.message });
  }
};

/**
 * Registra un depósito/pago de efectivo del repartidor hacia la plataforma.
 * Disminuye repartidor_balance_efectivo y deja constancia en el historial.
 * No lee ni modifica pagos_repartidor (ganancias) en absoluto.
 * POST /repartidores/:id_repartidor/balance/pagos  body: { monto, observacion? }
 */
export const registrarPagoBalance = async (req, res) => {
  const conexion = await conmysql.getConnection();
  try {
    if (!req.usuario) { conexion.release(); return res.status(401).json({ success: false, message: "Usuario no autenticado." }); }
    if (!tieneRol(req, ["SOPORTE", "ADMINISTRADOR"])) { conexion.release(); return res.status(403).json({ success: false, message: "Solo SOPORTE y ADMINISTRADOR pueden registrar pagos de balance." }); }

    const id_repartidor = Number(req.params.id_repartidor);
    const monto = Number(req.body?.monto);
    const observacion = req.body?.observacion ? String(req.body.observacion).trim() : null;

    if (!esIdValido(id_repartidor)) { conexion.release(); return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." }); }
    if (!Number.isFinite(monto) || monto <= 0) { conexion.release(); return res.status(400).json({ success: false, message: "El monto debe ser un número mayor a cero." }); }

    const idUsuario = obtenerIdUsuario(req);
    await conexion.beginTransaction();

    const [repartidores] = await conexion.query(
      `SELECT id_repartidor, repartidor_balance_efectivo FROM repartidores WHERE id_repartidor = ? LIMIT 1 FOR UPDATE`,
      [id_repartidor]
    );
    if (!repartidores.length) { await conexion.rollback(); return res.status(404).json({ success: false, message: "Repartidor no encontrado." }); }

    const balanceAnterior = Number(repartidores[0].repartidor_balance_efectivo || 0);
    if (monto > balanceAnterior) {
      await conexion.rollback();
      return res.status(409).json({
        success: false,
        message: `El monto (${monto.toFixed(2)}) supera el balance pendiente (${balanceAnterior.toFixed(2)}).`,
        codigo: "MONTO_SUPERA_BALANCE"
      });
    }

    const balanceNuevo = Number((balanceAnterior - monto).toFixed(2));

    await conexion.query(`UPDATE repartidores SET repartidor_balance_efectivo = ? WHERE id_repartidor = ?`, [balanceNuevo, id_repartidor]);

    const [insertado] = await conexion.query(
      `INSERT INTO repartidor_balance_movimientos
       (id_repartidor, movimiento_tipo, movimiento_monto, movimiento_balance_anterior, movimiento_balance_nuevo, movimiento_observacion, id_usuario_registro)
       VALUES (?, 'PAGO_BALANCE', ?, ?, ?, ?, ?)`,
      [id_repartidor, monto, balanceAnterior, balanceNuevo, observacion, idUsuario]
    );

    await conexion.commit();

    return res.status(201).json({
      success: true,
      message: "Pago de balance registrado correctamente.",
      id_movimiento: insertado.insertId,
      id_repartidor,
      balance_anterior: balanceAnterior,
      monto,
      balance_nuevo: balanceNuevo,
      registrado_por: idUsuario
    });
  } catch (error) {
    try { await conexion.rollback(); } catch (_) { }
    console.error("[BalanceRepartidor] Error registrarPagoBalance:", error);
    return res.status(500).json({ success: false, message: "Error al registrar el pago de balance.", error: error.message });
  } finally {
    conexion.release();
  }
};