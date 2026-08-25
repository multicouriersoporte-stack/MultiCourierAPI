import { conmysql } from "../db.js";

// GET: Obtener todas las provincias
export const getProvincias = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT id_provincia, provincia_codigo, provincia_nombre, provincia_estado FROM provincias ORDER BY provincia_nombre ASC`);
        res.json(result);
    } catch (error) {
        console.error("Error getProvincias:", error);
        return res.status(500).json({ message: "Error al consultar provincias", error: error.message });
    }
};

// GET: Obtener provincia por ID
export const getProvinciaxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT id_provincia, provincia_codigo, provincia_nombre, provincia_estado FROM provincias WHERE id_provincia = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_provincia: 0, message: "Provincia no encontrada" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getProvinciaxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};
