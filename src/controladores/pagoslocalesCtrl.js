import { conmysql } from "../db.js";

// Comisión que se descuenta al local.
const PORCENTAJE_COMISION_LOCAL = 5;

/**
 * Crea el pago de un pedido cuando pasa a ENTREGADO (estado 15).
 * Es idempotente: no duplica pagos existentes.
 */
export const crearPagoLocalDesdePedido = async (id_pedido, conexion = conmysql) => {
    if (!Number.isInteger(Number(id_pedido)) || Number(id_pedido) <= 0) {
        throw new Error("El ID del pedido no es válido.");
    }

    const idPedido = Number(id_pedido);

    // Verificar si el pedido ya tiene un pago.
    const [pagosExistentes] = await conexion.query(
        `SELECT * FROM pagos_locales WHERE id_pedido = ? ORDER BY id_pago_local DESC LIMIT 1`,
        [idPedido]
    );

    if (pagosExistentes.length) {
        console.log(`[PagosLocales] El pedido ${idPedido} ya tiene pago local. No se duplica.`);
        return { creado: false, existente: true, pago: pagosExistentes[0] };
    }

    // Obtener datos necesarios del pedido.
    const [pedidos] = await conexion.query(
        `SELECT p.id_pedido, p.pedido_codigo, p.id_local, p.id_metodo_pago, p.pedido_subtotal_local, p.id_estado, e.estado_nombre, mp.metodo_pago_nombre
         FROM pedidos p
         LEFT JOIN estados e ON p.id_estado = e.id_estado
         LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
         WHERE p.id_pedido = ? LIMIT 1`,
        [idPedido]
    );

    if (!pedidos.length) throw new Error("El pedido no existe.");

    const pedido = pedidos[0];

    if (!pedido.id_local) {
        throw new Error(`El pedido ${idPedido} no tiene un local asociado.`);
    }

    if (Number(pedido.id_estado) !== 15) {
        throw new Error(`El pago local solo puede generarse cuando el pedido está ENTREGADO (estado 15). Estado actual: ${pedido.id_estado}`);
    }

    // Calcular subtotal, comisión y total que recibe el local.
    const subtotal = Number(pedido.pedido_subtotal_local ?? 0);

    if (!Number.isFinite(subtotal) || subtotal < 0) {
        throw new Error(`El pedido ${idPedido} tiene un pedido_subtotal_local inválido.`);
    }

    const porcentajeComision = PORCENTAJE_COMISION_LOCAL;
    const comision = Number((subtotal * porcentajeComision / 100).toFixed(2));
    const totalLocal = Number((subtotal - comision).toFixed(2));
    const metodoPago = pedido.metodo_pago_nombre || "NO_ESPECIFICADO";
    const estadoPago = "PENDIENTE";

    // Registrar el pago local.
    const [resultado] = await conexion.query(
        `INSERT INTO pagos_locales (
            id_local, id_pedido, pago_local_fecha, pago_local_subtotal,
            pago_local_comision_porcentaje, pago_local_comision, pago_local_total,
            pago_local_metodo, pago_local_estado
        ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
            pedido.id_local, pedido.id_pedido, subtotal, porcentajeComision,
            comision, totalLocal, metodoPago, estadoPago
        ]
    );

    const [pagoCreado] = await conexion.query(
        `SELECT * FROM pagos_locales WHERE id_pago_local = ? LIMIT 1`,
        [resultado.insertId]
    );

    console.log("[PagosLocales] Pago creado automáticamente:", {
        id_pago_local: resultado.insertId,
        id_pedido: pedido.id_pedido,
        id_local: pedido.id_local,
        subtotal,
        porcentajeComision,
        comision,
        totalLocal
    });

    return { creado: true, existente: false, pago: pagoCreado[0] };
};

/** Obtener todos los pagos locales. */
export const getPagosLocales = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT * FROM pagos_locales ORDER BY id_pago_local DESC`
        );
        res.json(result);
    } catch (error) {
        console.error("Error getPagosLocales:", error);
        return res.status(500).json({ message: "Error al consultar pagos locales", error: error.message });
    }
};

/** Obtener un pago local por ID. */
export const getPagosLocalesxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM pagos_locales WHERE id_pago_local = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({ id_pago_local: 0, message: "Pago local no encontrado" });
        }

        res.json(result[0]);
    } catch (error) {
        console.error("Error getPagosLocalesxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

/** Obtener pagos asociados a un local. */
export const getPagosLocalesPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM pagos_locales WHERE id_local = ? ORDER BY id_pago_local DESC`,
            [id_local]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "No existen pagos asociados a este local" });
        }

        res.json(result);
    } catch (error) {
        console.error("Error getPagosLocalesPorLocal:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

/** Obtener pagos asociados a un pedido. */
export const getPagosLocalesPorPedido = async (req, res) => {
    try {
        const { id_pedido } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM pagos_locales WHERE id_pedido = ? ORDER BY id_pago_local DESC`,
            [id_pedido]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "No existen pagos asociados a este pedido" });
        }

        res.json(result);
    } catch (error) {
        console.error("Error getPagosLocalesPorPedido:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

/** Crear un pago local manualmente. */
export const postPagosLocales = async (req, res) => {
    try {
        const {
            id_local, id_pedido, pago_local_fecha, pago_local_subtotal,
            pago_local_comision_porcentaje, pago_local_comision, pago_local_total,
            pago_local_metodo, pago_local_estado
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO pagos_locales (
                id_local, id_pedido, pago_local_fecha, pago_local_subtotal,
                pago_local_comision_porcentaje, pago_local_comision, pago_local_total,
                pago_local_metodo, pago_local_estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_local, id_pedido, pago_local_fecha, pago_local_subtotal,
                pago_local_comision_porcentaje, pago_local_comision, pago_local_total,
                pago_local_metodo, pago_local_estado
            ]
        );

        res.status(201).json({
            id_pago_local: result.insertId,
            message: "Pago local registrado con éxito"
        });
    } catch (error) {
        console.error("Error postPagosLocales:", error);
        return res.status(500).json({ message: "Error al registrar pago local", error: error.message });
    }
};

/** Actualizar un pago local completo. */
export const putPagosLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_local, id_pedido, pago_local_fecha, pago_local_subtotal,
            pago_local_comision_porcentaje, pago_local_comision, pago_local_total,
            pago_local_metodo, pago_local_estado
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE pagos_locales SET
                id_local = ?, id_pedido = ?, pago_local_fecha = ?, pago_local_subtotal = ?,
                pago_local_comision_porcentaje = ?, pago_local_comision = ?, pago_local_total = ?,
                pago_local_metodo = ?, pago_local_estado = ?
             WHERE id_pago_local = ?`,
            [
                id_local, id_pedido, pago_local_fecha, pago_local_subtotal,
                pago_local_comision_porcentaje, pago_local_comision, pago_local_total,
                pago_local_metodo, pago_local_estado, id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Pago local no encontrado" });
        }

        const [rows] = await conmysql.query(
            `SELECT * FROM pagos_locales WHERE id_pago_local = ?`,
            [id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error("Error putPagosLocales:", error);
        return res.status(500).json({ message: "Error al actualizar pago local", error: error.message });
    }
};

/** Actualizar parcialmente un pago local. */
export const patchPagosLocales = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_local", "id_pedido", "pago_local_fecha", "pago_local_subtotal",
            "pago_local_comision_porcentaje", "pago_local_comision", "pago_local_total",
            "pago_local_metodo", "pago_local_estado"
        ];

        const campos = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (campos.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
        }

        valores.push(id);

        const [result] = await conmysql.query(
            `UPDATE pagos_locales SET ${campos.join(", ")} WHERE id_pago_local = ?`,
            valores
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Pago local no encontrado" });
        }

        const [rows] = await conmysql.query(
            `SELECT * FROM pagos_locales WHERE id_pago_local = ?`,
            [id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error("Error patchPagosLocales:", error);
        return res.status(500).json({ message: "Error al actualizar pago local", error: error.message });
    }
};

/** Eliminar un pago local. */
export const deletePagosLocales = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `DELETE FROM pagos_locales WHERE id_pago_local = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                id_pago_local: 0,
                message: "Pago local no encontrado"
            });
        }

        res.status(204).send();
    } catch (error) {
        console.error("Error deletePagosLocales:", error);
        return res.status(500).json({
            message: "Error al eliminar pago local",
            error: error.message
        });
    }
};