import { conmysql } from "../db.js";

// GET: Obtener todos los estados
export const getEstados = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT id_estado, estado_tipo, estado_nombre, estado_descripcion, estado_visible_front, estado_activo
            FROM estados
            ORDER BY estado_nombre ASC
        `);
        return res.json(result);
    } catch (error) {
        console.error("Error getEstados:", error);
        return res.status(500).json({ message: "Error al consultar estados", error: error.message });
    }
};

// GET: Obtener estado por ID
export const getEstadoxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `SELECT id_estado, estado_tipo, estado_nombre, estado_descripcion, estado_visible_front, estado_activo
             FROM estados
             WHERE id_estado = ?`,
            [id]
        );
        if (result.length === 0) return res.status(404).json({ id_estado: 0, message: "Estado no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getEstadoxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};
