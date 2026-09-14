import { conmysql } from "../db.js";

// Consultar movimientos de la billetera del usuario autenticado
export const getMovimientosBilleteraCliente = async (req, res) => {
    try {
        const id_usuario = req.usuario.id_usuario;   // ← aquí

        const [billetera] = await conmysql.query(
            `SELECT id_billeteracliente FROM billeteracliente WHERE id_usuario = ?`,
            [id_usuario]
        );

        if (billetera.length === 0) {
            return res.status(404).json({ message: "No se encontró la billetera del cliente" });
        }

        const id_billeteracliente = billetera[0].id_billeteracliente;

        const [result] = await conmysql.query(
            `SELECT 
                id_billeteracliente_movimiento,
                id_billeteracliente,
                billeteracliente_movimiento_tipo,
                billeteracliente_movimiento_monto,
                billeteracliente_movimiento_saldo_anterior,
                billeteracliente_movimiento_saldo_nuevo,
                billeteracliente_movimiento_concepto,
                billeteracliente_movimiento_referencia,
                id_pedido,
                billeteracliente_movimiento_fecha
             FROM billeteracliente_movimiento
             WHERE id_billeteracliente = ?
             ORDER BY billeteracliente_movimiento_fecha DESC, id_billeteracliente_movimiento DESC`,
            [id_billeteracliente]
        );

        res.json(result);
    } catch (error) {
        console.error("Error al consultar movimientos de billetera:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Consultar todos los movimientos (admin)
export const getTodosMovimientosBilletera = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT 
         id_billeteracliente_movimiento,
         id_billeteracliente,
         billeteracliente_movimiento_tipo,
         billeteracliente_movimiento_monto,
         billeteracliente_movimiento_saldo_anterior,
         billeteracliente_movimiento_saldo_nuevo,
         billeteracliente_movimiento_concepto,
         billeteracliente_movimiento_referencia,
         id_pedido,
         billeteracliente_movimiento_fecha
       FROM billeteracliente_movimiento
       ORDER BY billeteracliente_movimiento_fecha DESC, id_billeteracliente_movimiento DESC`
        );
        res.json(result);
    } catch (error) {
        console.error("Error al consultar todos los movimientos:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Consultar movimientos por id_billeteracliente
export const getMovimientosPorBilletera = async (req, res) => {
    try {
        const { id_billeteracliente } = req.params;

        const [result] = await conmysql.query(
            `SELECT 
         id_billeteracliente_movimiento,
         id_billeteracliente,
         billeteracliente_movimiento_tipo,
         billeteracliente_movimiento_monto,
         billeteracliente_movimiento_saldo_anterior,
         billeteracliente_movimiento_saldo_nuevo,
         billeteracliente_movimiento_concepto,
         billeteracliente_movimiento_referencia,
         id_pedido,
         billeteracliente_movimiento_fecha
       FROM billeteracliente_movimiento
       WHERE id_billeteracliente = ?
       ORDER BY billeteracliente_movimiento_fecha DESC, id_billeteracliente_movimiento DESC`,
            [id_billeteracliente]
        );

        res.json(result);
    } catch (error) {
        console.error("Error al consultar movimientos por billetera:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Consultar movimientos por id_usuario
export const getMovimientosPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;

        const [billetera] = await conmysql.query(
            `SELECT id_billeteracliente FROM billeteracliente WHERE id_usuario = ?`,
            [id_usuario]
        );

        if (billetera.length === 0) {
            return res.status(404).json({ message: "No se encontró la billetera para el usuario indicado" });
        }

        const id_billeteracliente = billetera[0].id_billeteracliente;

        const [result] = await conmysql.query(
            `SELECT 
         id_billeteracliente_movimiento,
         id_billeteracliente,
         billeteracliente_movimiento_tipo,
         billeteracliente_movimiento_monto,
         billeteracliente_movimiento_saldo_anterior,
         billeteracliente_movimiento_saldo_nuevo,
         billeteracliente_movimiento_concepto,
         billeteracliente_movimiento_referencia,
         id_pedido,
         billeteracliente_movimiento_fecha
       FROM billeteracliente_movimiento
       WHERE id_billeteracliente = ?
       ORDER BY billeteracliente_movimiento_fecha DESC, id_billeteracliente_movimiento DESC`,
            [id_billeteracliente]
        );

        res.json(result);
    } catch (error) {
        console.error("Error al consultar movimientos por usuario:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Crear un movimiento (CREDITO o DEBITO) y actualizar el saldo de la billetera
export const crearMovimientoBilletera = async (req, res) => {
    try {
        const {
            id_billeteracliente,
            billeteracliente_movimiento_tipo,
            billeteracliente_movimiento_monto,
            billeteracliente_movimiento_concepto,
            billeteracliente_movimiento_referencia = null,
            id_pedido = null
        } = req.body;

        // Validaciones básicas
        if (!id_billeteracliente) {
            return res.status(400).json({ message: "El id_billeteracliente es obligatorio" });
        }
        if (!billeteracliente_movimiento_tipo || !["CREDITO", "DEBITO"].includes(billeteracliente_movimiento_tipo)) {
            return res.status(400).json({ message: "El tipo debe ser CREDITO o DEBITO" });
        }
        if (billeteracliente_movimiento_monto === undefined || Number(billeteracliente_movimiento_monto) <= 0) {
            return res.status(400).json({ message: "El monto debe ser un número positivo" });
        }
        if (!billeteracliente_movimiento_concepto) {
            return res.status(400).json({ message: "El concepto es obligatorio" });
        }

        // Obtener saldo actual
        const [billetera] = await conmysql.query(
            `SELECT id_billeteracliente, billeteracliente_saldo FROM billeteracliente WHERE id_billeteracliente = ?`,
            [id_billeteracliente]
        );

        if (billetera.length === 0) {
            return res.status(404).json({ message: "No se encontró la billetera indicada" });
        }

        const saldo_anterior = Number(billetera[0].billeteracliente_saldo);
        const monto = Number(billeteracliente_movimiento_monto);

        let saldo_nuevo;
        if (billeteracliente_movimiento_tipo === "CREDITO") {
            saldo_nuevo = saldo_anterior + monto;
        } else {
            // DEBITO
            if (saldo_anterior < monto) {
                return res.status(400).json({ message: "Saldo insuficiente para realizar el débito" });
            }
            saldo_nuevo = saldo_anterior - monto;
        }

        // Insertar movimiento
        const [result] = await conmysql.query(
            `INSERT INTO billeteracliente_movimiento (
         id_billeteracliente,
         billeteracliente_movimiento_tipo,
         billeteracliente_movimiento_monto,
         billeteracliente_movimiento_saldo_anterior,
         billeteracliente_movimiento_saldo_nuevo,
         billeteracliente_movimiento_concepto,
         billeteracliente_movimiento_referencia,
         id_pedido
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_billeteracliente,
                billeteracliente_movimiento_tipo,
                monto,
                saldo_anterior,
                saldo_nuevo,
                billeteracliente_movimiento_concepto,
                billeteracliente_movimiento_referencia,
                id_pedido
            ]
        );

        // Actualizar saldo de la billetera
        await conmysql.query(
            `UPDATE billeteracliente SET billeteracliente_saldo = ? WHERE id_billeteracliente = ?`,
            [saldo_nuevo, id_billeteracliente]
        );

        // Devolver el movimiento creado
        const [movimiento] = await conmysql.query(
            `SELECT 
         id_billeteracliente_movimiento,
         id_billeteracliente,
         billeteracliente_movimiento_tipo,
         billeteracliente_movimiento_monto,
         billeteracliente_movimiento_saldo_anterior,
         billeteracliente_movimiento_saldo_nuevo,
         billeteracliente_movimiento_concepto,
         billeteracliente_movimiento_referencia,
         id_pedido,
         billeteracliente_movimiento_fecha
       FROM billeteracliente_movimiento
       WHERE id_billeteracliente_movimiento = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: "Movimiento registrado correctamente",
            movimiento: movimiento[0]
        });
    } catch (error) {
        console.error("Error al crear movimiento de billetera:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};
