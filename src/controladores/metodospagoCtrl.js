import { conmysql } from "../db.js";

// GET: Obtener todos los métodos de pago
export const getMetodosPago = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT id_metodo_pago, metodo_pago_nombre, metodo_pago_descripcion, metodo_pago_estado
            FROM metodos_pago
            ORDER BY metodo_pago_nombre ASC
        `);
        return res.json(result);
    } catch (error) {
        console.error("Error getMetodosPago:", error);
        return res.status(500).json({ message: "Error al consultar métodos de pago", error: error.message });
    }
};

// GET: Obtener método de pago por ID
export const getMetodoPagoxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT id_metodo_pago, metodo_pago_nombre, metodo_pago_descripcion, metodo_pago_estado
             FROM metodos_pago
             WHERE id_metodo_pago = ?`,
            [id]
        );
        if (result.length === 0) return res.status(404).json({ id_metodo_pago: 0, message: "Método de pago no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getMetodoPagoxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};
