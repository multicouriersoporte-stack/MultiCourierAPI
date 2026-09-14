// src/controladores/billeteraclienteCtrl.js
import { conmysql } from "../db.js";

// Consultar billetera del usuario autenticado
export const getBilleteraCliente = async (req, res) => {
    try {
        const id_usuario = req.user.id_usuario;
        const [result] = await conmysql.query(`SELECT id_billeteracliente, id_usuario, billeteracliente_saldo, billeteracliente_fecha_creacion, billeteracliente_fecha_actualizacion FROM billeteracliente WHERE id_usuario = ?`, [id_usuario]);
        if (result.length === 0) return res.status(404).json({ message: "No se encontró la billetera del cliente" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error al consultar billetera:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Consultar todas las billeteras
export const getBilleterasClientes = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT id_billeteracliente, id_usuario, billeteracliente_saldo, billeteracliente_fecha_creacion, billeteracliente_fecha_actualizacion FROM billeteracliente ORDER BY id_billeteracliente DESC`);
        res.json(result);
    } catch (error) {
        console.error("Error al consultar billeteras:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Consultar billetera por ID de usuario
export const getBilleteraClientePorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT id_billeteracliente, id_usuario, billeteracliente_saldo, billeteracliente_fecha_creacion, billeteracliente_fecha_actualizacion FROM billeteracliente WHERE id_usuario = ?`, [id_usuario]);
        if (result.length === 0) return res.status(404).json({ message: "No se encontró la billetera para el usuario indicado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error al consultar billetera:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Crear billetera para un usuario
export const crearBilleteraCliente = async (req, res) => {
    try {
        const { id_usuario, billeteracliente_saldo = 0.00 } = req.body;
        if (!id_usuario) return res.status(400).json({ message: "El id_usuario es obligatorio" });

        const [existe] = await conmysql.query(`SELECT id_billeteracliente FROM billeteracliente WHERE id_usuario = ?`, [id_usuario]);
        if (existe.length > 0) return res.status(409).json({ message: "El usuario ya tiene una billetera" });

        const [result] = await conmysql.query(`INSERT INTO billeteracliente (id_usuario, billeteracliente_saldo) VALUES (?, ?)`, [id_usuario, billeteracliente_saldo]);
        const [billetera] = await conmysql.query(`SELECT id_billeteracliente, id_usuario, billeteracliente_saldo, billeteracliente_fecha_creacion, billeteracliente_fecha_actualizacion FROM billeteracliente WHERE id_billeteracliente = ?`, [result.insertId]);

        res.status(201).json({ message: "Billetera creada correctamente", billetera: billetera[0] });
    } catch (error) {
        console.error("Error al crear billetera:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// Actualizar saldo de una billetera
export const actualizarSaldoBilletera = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const { billeteracliente_saldo } = req.body;

        if (billeteracliente_saldo === undefined) return res.status(400).json({ message: "El saldo es obligatorio" });
        if (Number(billeteracliente_saldo) < 0) return res.status(400).json({ message: "El saldo no puede ser negativo" });

        const [result] = await conmysql.query(`UPDATE billeteracliente SET billeteracliente_saldo = ? WHERE id_usuario = ?`, [billeteracliente_saldo, id_usuario]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "No se encontró la billetera del usuario" });

        const [billetera] = await conmysql.query(`SELECT id_billeteracliente, id_usuario, billeteracliente_saldo, billeteracliente_fecha_creacion, billeteracliente_fecha_actualizacion FROM billeteracliente WHERE id_usuario = ?`, [id_usuario]);
        res.json({ message: "Saldo actualizado correctamente", billetera: billetera[0] });
    } catch (error) {
        console.error("Error al actualizar saldo:", error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};
