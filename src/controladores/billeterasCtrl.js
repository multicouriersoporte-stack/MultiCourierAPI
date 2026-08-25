import { conmysql } from "../db.js";

// =====================================================
// GET: Obtener todas las billeteras
// =====================================================
export const getBilleteras = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT *
            FROM billeteras
            ORDER BY id_billetera DESC
        `);

        res.json(result);

    } catch (error) {
        console.error("Error getBilleteras:", error);

        return res.status(500).json({
            message: "Error al consultar billeteras",
            error: error.message
        });
    }
};


// =====================================================
// GET: Obtener billetera por ID
// =====================================================
export const getBilleteraxid = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `SELECT *
             FROM billeteras
             WHERE id_billetera = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                id_billetera: 0,
                message: "Billetera no encontrada"
            });
        }

        res.json(result[0]);

    } catch (error) {
        console.error("Error getBilleteraxid:", error);

        return res.status(500).json({
            message: "Error del servidor",
            error: error.message
        });
    }
};


// =====================================================
// POST: Crear billetera
// =====================================================
export const postBilleteras = async (req, res) => {
    try {
        const {
            id_repartidor,
            billetera_saldo,
            billetera_limite,
            billetera_deuda,
            billetera_porcentaje_minimo,
            billetera_efectivo_habilitado,
            billetera_fecha_actualizacion
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO billeteras (
                id_repartidor,
                billetera_saldo,
                billetera_limite,
                billetera_deuda,
                billetera_porcentaje_minimo,
                billetera_efectivo_habilitado,
                billetera_fecha_actualizacion
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id_repartidor,
                billetera_saldo,
                billetera_limite,
                billetera_deuda,
                billetera_porcentaje_minimo,
                billetera_efectivo_habilitado,
                billetera_fecha_actualizacion
            ]
        );

        res.status(201).json({
            id_billetera: result.insertId,
            message: "Billetera registrada con éxito"
        });

    } catch (error) {
        console.error("Error postBilleteras:", error);

        return res.status(500).json({
            message: "Error al registrar billetera",
            error: error.message
        });
    }
};


// =====================================================
// PUT: Actualizar completamente una billetera
// =====================================================
export const putBilleteras = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            id_repartidor,
            billetera_saldo,
            billetera_limite,
            billetera_deuda,
            billetera_porcentaje_minimo,
            billetera_efectivo_habilitado,
            billetera_fecha_actualizacion
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE billeteras
             SET
                id_repartidor = ?,
                billetera_saldo = ?,
                billetera_limite = ?,
                billetera_deuda = ?,
                billetera_porcentaje_minimo = ?,
                billetera_efectivo_habilitado = ?,
                billetera_fecha_actualizacion = ?
             WHERE id_billetera = ?`,
            [
                id_repartidor,
                billetera_saldo,
                billetera_limite,
                billetera_deuda,
                billetera_porcentaje_minimo,
                billetera_efectivo_habilitado,
                billetera_fecha_actualizacion,
                id
            ]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        const [rows] = await conmysql.query(
            `SELECT *
             FROM billeteras
             WHERE id_billetera = ?`,
            [id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Error putBilleteras:", error);

        return res.status(500).json({
            message: "Error al actualizar billetera",
            error: error.message
        });
    }
};


// =====================================================
// PATCH: Actualización parcial de billetera
// =====================================================
export const pathBilleteras = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            id_repartidor,
            billetera_saldo,
            billetera_limite,
            billetera_deuda,
            billetera_porcentaje_minimo,
            billetera_efectivo_habilitado,
            billetera_fecha_actualizacion
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE billeteras
             SET
                id_repartidor = IFNULL(?, id_repartidor),
                billetera_saldo = IFNULL(?, billetera_saldo),
                billetera_limite = IFNULL(?, billetera_limite),
                billetera_deuda = IFNULL(?, billetera_deuda),
                billetera_porcentaje_minimo = IFNULL(?, billetera_porcentaje_minimo),
                billetera_efectivo_habilitado = IFNULL(?, billetera_efectivo_habilitado),
                billetera_fecha_actualizacion = IFNULL(?, billetera_fecha_actualizacion)
             WHERE id_billetera = ?`,
            [
                id_repartidor,
                billetera_saldo,
                billetera_limite,
                billetera_deuda,
                billetera_porcentaje_minimo,
                billetera_efectivo_habilitado,
                billetera_fecha_actualizacion,
                id
            ]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        const [rows] = await conmysql.query(
            `SELECT *
             FROM billeteras
             WHERE id_billetera = ?`,
            [id]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Error pathBilleteras:", error);

        return res.status(500).json({
            message: "Error al actualizar billetera",
            error: error.message
        });
    }
};


// =====================================================
// DELETE: Eliminar billetera
// =====================================================
export const deleteBilleteras = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `DELETE FROM billeteras
             WHERE id_billetera = ?`,
            [id]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                id_billetera: 0,
                message: "Billetera no encontrada"
            });
        }

        res.sendStatus(202);

    } catch (error) {
        console.error("Error deleteBilleteras:", error);

        return res.status(500).json({
            message: "Error al eliminar billetera",
            error: error.message
        });
    }
};
