// billeteraService.js — Operaciones sobre la tabla billeteras + billetera_transacciones.
// Capa de persistencia: solo lectura/escritura de billetera y transacciones.
import { conmysql } from "../db.js";

// ─── Billetera ──────────────────────────────────────────────────────────────

/**
 * Obtener la billetera de un repartidor. Si `bloquear = true` usa FOR UPDATE.
 * Crea la billetera automáticamente si no existe (estado habilitado, saldo 0).
 */
export async function obtenerOAsegurarBilletera(conexion, id_repartidor, bloquear = false) {
    const lock = bloquear ? " FOR UPDATE" : "";
    const [rows] = await (
        conexion || conmysql
    ).query(`SELECT * FROM billeteras WHERE id_repartidor = ? LIMIT 1${lock}`, [id_repartidor]);
    if (rows.length) return rows[0];

    // Crear billetera nueva con valores por defecto del esquema.
    const [result] = await (conexion || conmysql).query(
        `INSERT INTO billeteras (id_repartidor, billetera_saldo, billetera_limite, billetera_deuda, billetera_porcentaje_minimo, billetera_efectivo_habilitado)
     VALUES (?, 0.00, 25.00, 0.00, 20.00, 1)`,
        [id_repartidor]
    );
    const [created] = await (conexion || conmysql).query(
        `SELECT * FROM billeteras WHERE id_billetera = ? LIMIT 1`,
        [result.insertId]
    );
    return created[0];
}

/**
 * Obtener la billetera sin crear si no existe.
 */
export async function obtenerBilletera(id_repartidor, conexion = null) {
    const [rows] = await (conexion || conmysql).query(
        `SELECT * FROM billeteras WHERE id_repartidor = ? LIMIT 1`,
        [id_repartidor]
    );
    return rows.length ? rows[0] : null;
}

/**
 * Actualizar el saldo de la billetera.
 */
export async function actualizarSaldo(conexion, id_billetera, nuevoSaldo) {
    await conexion.query(
        `UPDATE billeteras SET billetera_saldo = ?, billetera_deuda = GREATEST(?, 0.00) WHERE id_billetera = ?`,
        [Number(nuevoSaldo), Number(nuevoSaldo), id_billetera]
    );
}

/**
 * Actualizar el estado de habilitación de efectivo.
 */
export async function actualizarHabilitacionEfectivo(conexion, id_billetera, habilitado) {
    await conexion.query(
        `UPDATE billeteras SET billetera_efectivo_habilitado = ? WHERE id_billetera = ?`,
        [habilitado ? 1 : 0, id_billetera]
    );
}

// ─── Transacciones ──────────────────────────────────────────────────────────

/**
 * Insertar una transacción en billetera_transacciones.
 * `monto` se almacena con signo: positivo = saldo sube, negativo = saldo baja.
 */
export async function insertarMovimiento(conexion, {
    id_billetera,
    id_repartidor,
    id_pedido = null,
    id_pago_repartidor = null,
    tipo,
    monto,
    saldoAnterior,
    saldoNuevo,
    concepto = null,
    referencia = null,
}) {
    const [result] = await conexion.query(
        `INSERT INTO billetera_transacciones
      (id_billetera, id_repartidor, id_pedido, id_pago_repartidor, transaccion_tipo, transaccion_concepto, transaccion_monto, transaccion_saldo_anterior, transaccion_saldo_nuevo, transaccion_referencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id_billetera,
            id_repartidor,
            id_pedido,
            id_pago_repartidor,
            tipo,
            concepto,
            Number(monto),
            Number(saldoAnterior),
            Number(saldoNuevo),
            referencia,
        ]
    );
    return { id_transaccion: result.insertId };
}

/**
 * Obtener las transacciones de la billetera de un repartidor, ordenadas por fecha DESC.
 * `limite = 0` devuelve todas (usado para calcular totales del resumen).
 */
export async function listarTransacciones(id_billetera, { limite = 100, offset = 0 } = {}) {
    const lim = Number(limite);
    const off = Number(offset);

    // Si limite = 0 → sin límite: útil para agregados (resumen).
    if (!lim || lim <= 0) {
        const [rows] = await conmysql.query(
            `SELECT * FROM billetera_transacciones
       WHERE id_billetera = ?
       ORDER BY transaccion_fecha DESC, id_transaccion DESC`,
            [id_billetera]
        );
        return rows;
    }

    const [rows] = await conmysql.query(
        `SELECT * FROM billetera_transacciones
     WHERE id_billetera = ?
     ORDER BY transaccion_fecha DESC, id_transaccion DESC
     LIMIT ? OFFSET ?`,
        [id_billetera, lim, off]
    );
    return rows;
}