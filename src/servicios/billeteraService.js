// Persistencia de billeteras y sus transacciones.
import { conmysql } from "../db.js";

// Obtiene o crea la billetera del repartidor; puede bloquearla con FOR UPDATE.
export async function obtenerOAsegurarBilletera(conexion, id_repartidor, bloquear = false) {
    const db = conexion || conmysql, lock = bloquear ? " FOR UPDATE" : "";
    const [rows] = await db.query(`SELECT * FROM billeteras WHERE id_repartidor = ? LIMIT 1${lock}`, [id_repartidor]);
    if (rows.length) return rows[0];

    // Crea una billetera con los valores iniciales del esquema.
    const [result] = await db.query(
        `INSERT INTO billeteras (id_repartidor, billetera_saldo, billetera_limite, billetera_deuda, billetera_porcentaje_minimo, billetera_efectivo_habilitado) VALUES (?, 0.00, 25.00, 0.00, 20.00, 1)`,
        [id_repartidor]
    );
    const [created] = await db.query(`SELECT * FROM billeteras WHERE id_billetera = ? LIMIT 1`, [result.insertId]);
    return created[0];
}

// Obtiene la billetera sin crearla.
export async function obtenerBilletera(id_repartidor, conexion = null) {
    const [rows] = await (conexion || conmysql).query(`SELECT * FROM billeteras WHERE id_repartidor = ? LIMIT 1`, [id_repartidor]);
    return rows.length ? rows[0] : null;
}

// Actualiza saldo y deuda de la billetera.
export async function actualizarSaldo(conexion, id_billetera, nuevoSaldo) {
    await conexion.query(`UPDATE billeteras SET billetera_saldo = ?, billetera_deuda = GREATEST(?, 0.00) WHERE id_billetera = ?`, [Number(nuevoSaldo), Number(nuevoSaldo), id_billetera]);
}

// Actualiza si el repartidor puede recibir pagos en efectivo.
export async function actualizarHabilitacionEfectivo(conexion, id_billetera, habilitado) {
    await conexion.query(`UPDATE billeteras SET billetera_efectivo_habilitado = ? WHERE id_billetera = ?`, [habilitado ? 1 : 0, id_billetera]);
}

// Registra un movimiento; monto positivo aumenta el saldo y negativo lo reduce.
export async function insertarMovimiento(conexion, { id_billetera, id_repartidor, id_pedido = null, id_pago_repartidor = null, tipo, monto, saldoAnterior, saldoNuevo, concepto = null, referencia = null }) {
    const [result] = await conexion.query(
        `INSERT INTO billetera_transacciones (id_billetera, id_repartidor, id_pedido, id_pago_repartidor, transaccion_tipo, transaccion_concepto, transaccion_monto, transaccion_saldo_anterior, transaccion_saldo_nuevo, transaccion_referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id_billetera, id_repartidor, id_pedido, id_pago_repartidor, tipo, concepto, Number(monto), Number(saldoAnterior), Number(saldoNuevo), referencia]
    );
    return { id_transaccion: result.insertId };
}

// Lista transacciones por fecha descendente; limite <= 0 devuelve todas.
export async function listarTransacciones(id_billetera, { limite = 100, offset = 0 } = {}) {
    const lim = Number(limite), off = Number(offset);
    const query = `SELECT * FROM billetera_transacciones WHERE id_billetera = ? ORDER BY transaccion_fecha DESC, id_transaccion DESC`;
    if (!lim || lim <= 0) {
        const [rows] = await conmysql.query(query, [id_billetera]);
        return rows;
    }
    const [rows] = await conmysql.query(`${query} LIMIT ? OFFSET ?`, [id_billetera, lim, off]);
    return rows;
}
