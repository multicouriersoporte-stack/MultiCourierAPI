// src/controladores/estadosrepartidorCtrl.js
import { conmysql } from "../db.js";

// GET: Obtener todos los estados de repartidor
export const getEstadosRepartidor = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT id_estado_repartidor, estado_repartidor_nombre, estado_repartidor_descripcion, estado_repartidor_visible_front, estado_repartidor_permite_pedidos, estado_repartidor_permite_seleccion, estado_repartidor_estado FROM estados_repartidor ORDER BY estado_repartidor_nombre ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getEstadosRepartidor:", error);
        return res.status(500).json({ message: "Error al consultar estados de repartidor", error: error.message });
    }
};

// GET: Obtener estado de repartidor por ID
export const getEstadoRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT id_estado_repartidor, estado_repartidor_nombre, estado_repartidor_descripcion, estado_repartidor_visible_front, estado_repartidor_permite_pedidos, estado_repartidor_permite_seleccion, estado_repartidor_estado FROM estados_repartidor WHERE id_estado_repartidor = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_estado_repartidor: 0, message: "Estado de repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getEstadoRepartidorxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};
