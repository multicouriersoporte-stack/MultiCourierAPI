import { conmysql } from "../db.js";

// =====================================================
// GET: Obtener todos los pagos locales
// =====================================================
export const getPagosLocales = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT *
            FROM pagos_locales
            ORDER BY id_pago_local DESC
        `);

        res.json(result);

    } catch (error) {
        console.error("Error getPagosLocales:", error);

        return res.status(500).json({
            message: "Error al consultar pagos locales",
            error: error.message
        });
    }
};


// =====================================================
// GET: Obtener pago local por ID
// =====================================================
export const getPagosLocalesxid = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `SELECT *
             FROM pagos_locales
             WHERE id_pago_local = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                id_pago_local: 0,
                message: "Pago local no encontrado"
            });
        }

        res.json(result[0]);

    } catch (error) {
        console.error("Error getPagosLocalesxid:", error);

        return res.status(500).json({
            message: "Error del servidor",
            error: error.message
        });
    }
};


// =====================================================
// GET: Obtener pagos locales por ID de local
// =====================================================
export const getPagosLocalesPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;

        const [result] = await conmysql.query(
            `SELECT *
             FROM pagos_locales
             WHERE id_local = ?
             ORDER BY id_pago_local DESC`,
            [id_local]
        );

        if (result.length === 0) {
            return res.status(404).json({
                message: "No existen pagos asociados a este local"
            });
        }

        res.json(result);

    } catch (error) {
        console.error("Error getPagosLocalesPorLocal:", error);

        return res.status(500).json({
            message: "Error del servidor",
            error: error.message
        });
    }
};


// =====================================================
// GET: Obtener pago local por ID de pedido
// =====================================================
export const getPagosLocalesPorPedido = async (req, res) => {
    try {
        const { id_pedido } = req.params;

        const [result] = await conmysql.query(
            `SELECT *
             FROM pagos_locales
             WHERE id_pedido = ?
             ORDER BY id_pago_local DESC`,
            [id_pedido]
        );

        if (result.length === 0) {
            return res.status(404).json({
                message: "No existen pagos asociados a este pedido"
            });
        }

        res.json(result);

    } catch (error) {
        console.error("Error getPagosLocalesPorPedido:", error);

        return res.status(500).json({
            message: "Error del servidor",
            error: error.message
        });
    }
};


// =====================================================
// POST: Crear pago local
// =====================================================
export const postPagosLocales = async (req, res) => {
    try {
        const {
            id_local,
            id_pedido,
            pago_local_fecha,
            pago_local_subtotal,
            pago_local_comision_porcentaje,
            pago_local_comision,
            pago_local_total,
            pago_local_metodo,
            pago_local_estado
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO pagos_locales (
                id_local,
                id_pedido,
                pago_local_fecha,
                pago_local_subtotal,
                pago_local_comision_porcentaje,
                pago_local_comision,
                pago_local_total,
                pago_local_metodo,
                pago_local_estado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_local,
                id_pedido,
                pago_local_fecha,
                pago_local_subtotal,
                pago_local_comision_porcentaje,
                pago_local_comision,
                pago_local_total,
                pago_local_metodo,
                pago_local_estado
            ]
        );

        res.status(201).json({
            id_pago_local: result.insertId,
            message: "Pago local registrado con éxito"
        });

    } catch (error) {
        console.error("Error postPagosLocales:", error);

        return res.status(500).json({
            message: "Error al registrar pago local",
            error: error.message
        });
    }
};


// =====================================================
// PUT: Actualizar completamente un pago local
// =====================================================
export const putPagosLocales = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            id_local,
            id_pedido,
            pago_local_fecha,
            pago_local_subtotal,
            pago_local_comision_porcentaje,
            pago_local_comision,
            pago_local_total,
            pago_local_metodo,
            pago_local_estado
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE pagos_locales
             SET
                id_local = ?,
                id_pedido = ?,
                pago_local_fecha = ?,
                pago_local_subtotal = ?,
                pago_local_comision_porcentaje = ?,
                pago_local_comision = ?,
                pago_local_total = ?,
                pago_local_metodo = ?,
                pago_local_estado = ?
             WHERE id_pago_local = ?`,
            [
                id_local,
                id_pedido,
                pago_local_fecha,
                pago_local_subtotal,
                pago_local_comision_porcentaje,
                pago_local_comision,
                pago_local_total,
                pago_local_metodo,
                pago_local_estado,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Pago local no encontrado"
            });
        }

        const [rows] = await conmysql.query(
            `SELECT *
             FROM pagos_locales
             WHERE id_pago_local = ?`,
            [id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Error putPagosLocales:", error);

        return res.status(500).json({
            message: "Error al actualizar pago local",
            error: error.message
        });
    }
};


// =====================================================
// PATCH: Actualización parcial de pago local
// =====================================================
export const patchPagosLocales = async (req, res) => {
    try {
        const { id } = req.params;

        const camposPermitidos = [
            "id_local",
            "id_pedido",
            "pago_local_fecha",
            "pago_local_subtotal",
            "pago_local_comision_porcentaje",
            "pago_local_comision",
            "pago_local_total",
            "pago_local_metodo",
            "pago_local_estado"
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
            return res.status(400).json({
                message: "No se proporcionaron campos para actualizar"
            });
        }

        valores.push(id);

        const [result] = await conmysql.query(
            `UPDATE pagos_locales
             SET ${campos.join(", ")}
             WHERE id_pago_local = ?`,
            valores
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Pago local no encontrado"
            });
        }

        const [rows] = await conmysql.query(
            `SELECT *
             FROM pagos_locales
             WHERE id_pago_local = ?`,
            [id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Error patchPagosLocales:", error);

        return res.status(500).json({
            message: "Error al actualizar pago local",
            error: error.message
        });
    }
};


// =====================================================
// DELETE: Eliminar pago local
// =====================================================
export const deletePagosLocales = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `DELETE FROM pagos_locales
             WHERE id_pago_local = ?`,
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
