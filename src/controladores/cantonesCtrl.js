import { conmysql } from "../db.js";

// Obtener todos los cantones
export const getCantones = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT id_canton, id_provincia, canton_codigo, canton_nombre, canton_estado
            FROM cantones
            ORDER BY canton_nombre ASC
        `);

        return res.json(result);
    } catch (error) {
        console.error("Error getCantones:", error);
        return res.status(500).json({
            message: "Error al consultar cantones",
            error: error.message
        });
    }
};

// Obtener cantón por ID
export const getCantonxid = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `SELECT id_canton, id_provincia, canton_codigo, canton_nombre, canton_estado
             FROM cantones
             WHERE id_canton = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                id_canton: 0,
                message: "Cantón no encontrado"
            });
        }

        return res.json(result[0]);
    } catch (error) {
        console.error("Error getCantonxid:", error);
        return res.status(500).json({
            message: "Error del servidor",
            error: error.message
        });
    }
};
