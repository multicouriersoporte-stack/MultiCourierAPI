import { conmysql } from "../db.js";

// Crea automáticamente el pago del repartidor cuando el pedido está ENTREGADO (15).
// Es idempotente: si ya existe un pago para el pedido, no lo duplica.
export const crearPagoRepartidorDesdePedido = async (id_pedido, conexion = conmysql) => {
    if (!Number.isInteger(Number(id_pedido)) || Number(id_pedido) <= 0) throw new Error("El ID del pedido no es válido.");
    const idPedido = Number(id_pedido);

    // Verificar si ya existe un pago.
    const [pagosExistentes] = await conexion.query(
        `SELECT * FROM pagos_repartidor WHERE id_pedido = ? ORDER BY id_pago_repartidor DESC LIMIT 1`,
        [idPedido]
    );
    if (pagosExistentes.length) {
        console.log(`[PagosRepartidor] El pedido ${idPedido} ya tiene pago de repartidor. No se duplica.`);
        return { creado: false, existente: true, pago: pagosExistentes[0] };
    }

    // Obtener pedido y repartidor.
    const [pedidos] = await conexion.query(
        `SELECT p.id_pedido, p.pedido_codigo, p.id_repartidor, p.id_estado, e.estado_nombre
         FROM pedidos p LEFT JOIN estados e ON p.id_estado = e.id_estado
         WHERE p.id_pedido = ? LIMIT 1`,
        [idPedido]
    );
    if (!pedidos.length) throw new Error("El pedido no existe.");
    const pedido = pedidos[0];

    // Validar repartidor y estado ENTREGADO.
    if (!pedido.id_repartidor) throw new Error(`El pedido ${idPedido} no tiene un repartidor asociado.`);
    if (Number(pedido.id_estado) !== 15) {
        throw new Error(`El pago al repartidor solo puede generarse cuando el pedido está ENTREGADO (estado 15). Estado actual: ${pedido.id_estado}`);
    }

    // Valores iniciales; reemplazar por la lógica real de pago.
    const carrera = 0, propina = 0, otros = 0;
    const total = Number((carrera + propina + otros).toFixed(2));
    if (!Number.isFinite(total) || total < 0) throw new Error(`El pedido ${idPedido} tiene un total de pago al repartidor inválido.`);
    const estadoPago = "PENDIENTE";

    // Registrar pago.
    const [resultado] = await conexion.query(
        `INSERT INTO pagos_repartidor (
            id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
            pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
            pago_repartidor_estado, pago_repartidor_fecha_pago
        ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, NULL)`,
        [pedido.id_repartidor, pedido.id_pedido, carrera, propina, otros, total, estadoPago]
    );

    // Obtener pago creado.
    const [pagoCreado] = await conexion.query(
        `SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ? LIMIT 1`,
        [resultado.insertId]
    );

    console.log("[PagosRepartidor] Pago creado automáticamente:", {
        id_pago_repartidor: resultado.insertId, id_pedido: pedido.id_pedido,
        id_repartidor: pedido.id_repartidor, carrera, propina, otros, total
    });

    return { creado: true, existente: false, pago: pagoCreado[0] };
};

// GET: Obtener todos los pagos.
export const getPagosRepartidor = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT * FROM pagos_repartidor ORDER BY id_pago_repartidor DESC`);
        res.json(result);
    } catch (error) {
        console.error("Error getPagosRepartidor:", error);
        return res.status(500).json({ message: "Error al consultar pagos de repartidores", error: error.message });
    }
};

// GET: Obtener pago por ID.
export const getPagoRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ?`, [id]);
        if (!result.length) return res.status(404).json({ id_pago_repartidor: 0, message: "Pago de repartidor no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getPagoRepartidorxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener pagos por repartidor.
export const getPagosRepartidorPorRepartidor = async (req, res) => {
    try {
        const { id_repartidor } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM pagos_repartidor WHERE id_repartidor = ? ORDER BY id_pago_repartidor DESC`,
            [id_repartidor]
        );
        if (!result.length) return res.status(404).json({ message: "No existen pagos asociados a este repartidor" });
        res.json(result);
    } catch (error) {
        console.error("Error getPagosRepartidorPorRepartidor:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener pagos por pedido.
export const getPagosRepartidorPorPedido = async (req, res) => {
    try {
        const { id_pedido } = req.params;
        const [result] = await conmysql.query(
            `SELECT * FROM pagos_repartidor WHERE id_pedido = ? ORDER BY id_pago_repartidor DESC`,
            [id_pedido]
        );
        if (!result.length) return res.status(404).json({ message: "No existen pagos asociados a este pedido" });
        res.json(result);
    } catch (error) {
        console.error("Error getPagosRepartidorPorPedido:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// POST: Crear pago manualmente.
export const postPagosRepartidor = async (req, res) => {
    try {
        const {
            id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
            pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
            pago_repartidor_estado, pago_repartidor_fecha_pago
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO pagos_repartidor (
                id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
                pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
                pago_repartidor_estado, pago_repartidor_fecha_pago
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
                pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
                pago_repartidor_estado, pago_repartidor_fecha_pago
            ]
        );

        res.status(201).json({ id_pago_repartidor: result.insertId, message: "Pago de repartidor registrado con éxito" });
    } catch (error) {
        console.error("Error postPagosRepartidor:", error);
        return res.status(500).json({ message: "Error al registrar pago de repartidor", error: error.message });
    }
};

// PUT: Actualizar completamente un pago.
export const putPagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
            pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
            pago_repartidor_estado, pago_repartidor_fecha_pago
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE pagos_repartidor SET
                id_repartidor = ?, id_pedido = ?, pago_repartidor_fecha = ?,
                pago_repartidor_carrera = ?, pago_repartidor_propina = ?, pago_repartidor_otros = ?,
                pago_repartidor_total = ?, pago_repartidor_estado = ?, pago_repartidor_fecha_pago = ?
             WHERE id_pago_repartidor = ?`,
            [
                id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
                pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
                pago_repartidor_estado, pago_repartidor_fecha_pago, id
            ]
        );

        if (!result.affectedRows) return res.status(404).json({ message: "Pago de repartidor no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error putPagosRepartidor:", error);
        return res.status(500).json({ message: "Error al actualizar pago de repartidor", error: error.message });
    }
};

// PATCH: Actualizar parcialmente un pago.
export const patchPagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_repartidor", "id_pedido", "pago_repartidor_fecha", "pago_repartidor_carrera",
            "pago_repartidor_propina", "pago_repartidor_otros", "pago_repartidor_total",
            "pago_repartidor_estado", "pago_repartidor_fecha_pago"
        ];
        const campos = [], valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (!campos.length) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
        valores.push(id);

        const [result] = await conmysql.query(
            `UPDATE pagos_repartidor SET ${campos.join(", ")} WHERE id_pago_repartidor = ?`,
            valores
        );

        if (!result.affectedRows) return res.status(404).json({ message: "Pago de repartidor no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error patchPagosRepartidor:", error);
        return res.status(500).json({ message: "Error al actualizar pago de repartidor", error: error.message });
    }
};

// DELETE: Eliminar pago de repartidor.
export const deletePagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM pagos_repartidor WHERE id_pago_repartidor = ?`, [id]);

        if (!result.affectedRows) return res.status(404).json({ id_pago_repartidor: 0, message: "Pago de repartidor no encontrado" });
        res.status(204).send();
    } catch (error) {
        console.error("Error deletePagosRepartidor:", error);
        return res.status(500).json({ message: "Error al eliminar pago de repartidor", error: error.message });
    }
};
