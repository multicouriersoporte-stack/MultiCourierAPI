import { conmysql } from "../db.js";

// GET: Obtener todos los roles.
export const getRoles = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT id_rol, rol_nombre, rol_descripcion, rol_estado FROM roles ORDER BY rol_nombre ASC`);
        res.json(result);
    } catch (error) {
        console.error("Error getRoles:", error);
        return res.status(500).json({ message: "Error al consultar roles", error: error.message });
    }
};

// GET: Obtener rol por ID.
export const getRolxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT id_rol, rol_nombre, rol_descripcion, rol_estado FROM roles WHERE id_rol = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_rol: 0, message: "Rol no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getRolxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};
