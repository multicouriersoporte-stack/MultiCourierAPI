import { conmysql } from "../db.js";

// =====================================================
// GET: Obtener todos los pagos de repartidores
// =====================================================
export const getPagosRepartidor = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT *
            FROM pagos_repartidor
            ORDER BY id_pago_repartidor DESC
        `);

        res.json(result);

    } catch (error) {
        console.error("Error getPagosRepartidor:", error);

        return res.status(500).json({
            message: "Error al consultar pagos de repartidores",
            error: error.message
        });
    }
};


// =====================================================
// GET: Obtener pago de repartidor por ID
// =====================================================
export const getPagoRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `SELECT *
             FROM pagos_repartidor
             WHERE id_pago_repartidor = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                id_pago_repartidor: 0,
                message: "Pago de repartidor no encontrado"
            });
        }

        res.json(result[0]);

    } catch (error) {
        console.error("Error getPagoRepartidorxid:", error);

        return res.status(500).json({
            message: "Error del servidor",
            error: error.message
        });
    }
};


// =====================================================
// POST: Crear pago de repartidor
// =====================================================
export const postPagosRepartidor = async (req, res) => {
    try {
        const {
            id_repartidor,
            id_pedido,
            pago_repartidor_fecha,
            pago_repartidor_carrera,
            pago_repartidor_propina,
            pago_repartidor_otros,
            pago_repartidor_total,
            pago_repartidor_estado,
            pago_repartidor_fecha_pago
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO pagos_repartidor (
                id_repartidor,
                id_pedido,
                pago_repartidor_fecha,
                pago_repartidor_carrera,
                pago_repartidor_propina,
                pago_repartidor_otros,
                pago_repartidor_total,
                pago_repartidor_estado,
                pago_repartidor_fecha_pago
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_repartidor,
                id_pedido,
                pago_repartidor_fecha,
                pago_repartidor_carrera,
                pago_repartidor_propina,
                pago_repartidor_otros,
                pago_repartidor_total,
                pago_repartidor_estado,
                pago_repartidor_fecha_pago
            ]
        );

        res.status(201).json({
            id_pago_repartidor: result.insertId,
            message: "Pago de repartidor registrado con éxito"
        });

    } catch (error) {
        console.error("Error postPagosRepartidor:", error);

        return res.status(500).json({
            message: "Error al registrar pago de repartidor",
            error: error.message
        });
    }
};


// =====================================================
// PUT: Actualizar completamente un pago de repartidor
// =====================================================
export const putPagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            id_repartidor,
            id_pedido,
            pago_repartidor_fecha,
            pago_repartidor_carrera,
            pago_repartidor_propina,
            pago_repartidor_otros,
            pago_repartidor_total,
            pago_repartidor_estado,
            pago_repartidor_fecha_pago
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE pagos_repartidor
             SET
                id_repartidor = ?,
                id_pedido = ?,
                pago_repartidor_fecha = ?,
                pago_repartidor_carrera = ?,
                pago_repartidor_propina = ?,
                pago_repartidor_otros = ?,
                pago_repartidor_total = ?,
                pago_repartidor_estado = ?,
                pago_repartidor_fecha_pago = ?
             WHERE id_pago_repartidor = ?`,
            [
                id_repartidor,
                id_pedido,
                pago_repartidor_fecha,
                pago_repartidor_carrera,
                pago_repartidor_propina,
                pago_repartidor_otros,
                pago_repartidor_total,
                pago_repartidor_estado,
                pago_repartidor_fecha_pago,
                id
            ]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                message: "Pago de repartidor no encontrado"
            });
        }

        const [rows] = await conmysql.query(
            `SELECT *
             FROM pagos_repartidor
             WHERE id_pago_repartidor = ?`,
            [id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Error putPagosRepartidor:", error);

        return res.status(500).json({
            message: "Error al actualizar pago de repartidor",
            error: error.message
        });
    }
};


// =====================================================
// PATCH: Actualización parcial de pago de repartidor
// =====================================================
export const pathPagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            id_repartidor,
            id_pedido,
            pago_repartidor_fecha,
            pago_repartidor_carrera,
            pago_repartidor_propina,
            pago_repartidor_otros,
            pago_repartidor_total,
            pago_repartidor_estado,
            pago_repartidor_fecha_pago
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE pagos_repartidor
             SET
                id_repartidor = IFNULL(?, id_repartidor),
                id_pedido = IFNULL(?, id_pedido),
                pago_repartidor_fecha = IFNULL(?, pago_repartidor_fecha),
                pago_repartidor_carrera = IFNULL(?, pago_repartidor_carrera),
                pago_repartidor_propina = IFNULL(?, pago_repartidor_propina),
                pago_repartidor_otros = IFNULL(?, pago_repartidor_otros),
                pago_repartidor_total = IFNULL(?, pago_repartidor_total),
                pago_repartidor_estado = IFNULL(?, pago_repartidor_estado),
                pago_repartidor_fecha_pago = IFNULL(?, pago_repartidor_fecha_pago)
             WHERE id_pago_repartidor = ?`,
            [
                id_repartidor,
                id_pedido,
                pago_repartidor_fecha,
                pago_repartidor_carrera,
                pago_repartidor_propina,
                pago_repartidor_otros,
                pago_repartidor_total,
                pago_repartidor_estado,
                pago_repartidor_fecha_pago,
                id
            ]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                message: "Pago de repartidor no encontrado"
            });
        }

        const [rows] = await conmysql.query(
            `SELECT *
             FROM pagos_repartidor
             WHERE id_pago_repartidor = ?`,
            [id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Error pathPagosRepartidor:", error);

        return res.status(500).json({
            message: "Error al actualizar pago de repartidor",
            error: error.message
        });
    }
};


// =====================================================
// DELETE: Eliminar pago de repartidor
// =====================================================
export const deletePagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `DELETE FROM pagos_repartidor
             WHERE id_pago_repartidor = ?`,
            [id]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                id_pago_repartidor: 0,
                message: "Pago de repartidor no encontrado"
            });
        }

        res.sendStatus(202);

    } catch (error) {
        console.error("Error deletePagosRepartidor:", error);

        return res.status(500).json({
            message: "Error al eliminar pago de repartidor",
            error: error.message
        });
    }
};
