import { conmysql } from "../db.js";

// GET: Obtener todas las relaciones usuario-rol.
export const getUsuarioRoles = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT id_usuario_rol, id_usuario, id_rol, usuario_rol_fecha, usuario_rol_estado FROM usuario_roles ORDER BY usuario_rol_fecha DESC`);
        res.json(result);
    } catch (error) {
        console.error("Error getUsuarioRoles:", error);
        return res.status(500).json({ message: "Error al consultar las relaciones usuario-rol", error: error.message });
    }
};

// GET: Obtener relación usuario-rol por ID.
export const getUsuarioRolxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT id_usuario_rol, id_usuario, id_rol, usuario_rol_fecha, usuario_rol_estado FROM usuario_roles WHERE id_usuario_rol = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_usuario_rol: 0, message: "Relación usuario-rol no encontrada" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioRolxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};
