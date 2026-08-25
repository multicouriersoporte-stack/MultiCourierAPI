/* // src/controladores/repartidorubicacionCtrl.js

import { conmysql } from "../db.js";

// GET: Todas las ubicaciones
export const getRepartidorUbicaciones = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT ru.*, r.repartidor_codigo
            FROM repartidor_ubicaciones ru
            LEFT JOIN repartidores r ON ru.id_repartidor = r.id_repartidor
            ORDER BY ru.repartidor_ubicacion_fecha DESC
        `);
        res.json(result);
    } catch (error) {
        console.error("Error getRepartidorUbicaciones:", error);
        return res.status(500).json({ message: "Error al consultar ubicaciones", error: error.message });
    }
};

// GET: Ubicación por ID
export const getRepartidorUbicacionxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`
            SELECT ru.*, r.repartidor_codigo
            FROM repartidor_ubicaciones ru
            LEFT JOIN repartidores r ON ru.id_repartidor = r.id_repartidor
            WHERE ru.id_repartidor_ubicacion = ?
        `, [id]);

        if (result.length === 0) {
            return res.status(404).json({ id_repartidor_ubicacion: 0, message: "Ubicación no encontrada" });
        }

        res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorUbicacionxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Ubicaciones de un repartidor
export const getUbicacionesPorRepartidor = async (req, res) => {
    try {
        const { id_repartidor } = req.params;
        const [result] = await conmysql.query(`
            SELECT *
            FROM repartidor_ubicaciones
            WHERE id_repartidor = ?
            ORDER BY repartidor_ubicacion_fecha DESC
        `, [id_repartidor]);
        res.json(result);
    } catch (error) {
        console.error("Error getUbicacionesPorRepartidor:", error);
        return res.status(500).json({ message: "Error al consultar ubicaciones del repartidor", error: error.message });
    }
};

// GET: Última ubicación de un repartidor
export const getUltimaUbicacionRepartidor = async (req, res) => {
    try {
        const { id_repartidor } = req.params;
        const [result] = await conmysql.query(`
            SELECT *
            FROM repartidor_ubicaciones
            WHERE id_repartidor = ?
            ORDER BY repartidor_ubicacion_fecha DESC, id_repartidor_ubicacion DESC
            LIMIT 1
        `, [id_repartidor]);

        if (result.length === 0) {
            return res.status(404).json({ message: "El repartidor todavía no tiene una ubicación registrada" });
        }

        res.json(result[0]);
    } catch (error) {
        console.error("Error getUltimaUbicacionRepartidor:", error);
        return res.status(500).json({ message: "Error al consultar última ubicación", error: error.message });
    }
};

// POST: Registrar ubicación
export const postRepartidorUbicacion = async (req, res) => {
    try {
        const {
            id_repartidor,
            repartidor_ubicacion_latitud,
            repartidor_ubicacion_longitud,
            repartidor_ubicacion_fecha
        } = req.body;

        // Validar datos obligatorios
        if (!id_repartidor) {
            return res.status(400).json({ message: "id_repartidor es obligatorio" });
        }

        if (repartidor_ubicacion_latitud === undefined || repartidor_ubicacion_longitud === undefined) {
            return res.status(400).json({ message: "La latitud y longitud son obligatorias" });
        }

        // Validar coordenadas
        const latitud = Number(repartidor_ubicacion_latitud);
        const longitud = Number(repartidor_ubicacion_longitud);

        if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
            return res.status(400).json({ message: "La latitud no es válida" });
        }

        if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
            return res.status(400).json({ message: "La longitud no es válida" });
        }

        // Verificar repartidor
        const [repartidores] = await conmysql.query(
            "SELECT id_repartidor FROM repartidores WHERE id_repartidor = ?",
            [id_repartidor]
        );

        if (repartidores.length === 0) {
            return res.status(404).json({ message: "El repartidor no existe" });
        }

        const fecha = repartidor_ubicacion_fecha || new Date();

        // Insertar ubicación
        const [result] = await conmysql.query(`
            INSERT INTO repartidor_ubicaciones (
                id_repartidor, repartidor_ubicacion_latitud,
                repartidor_ubicacion_longitud, repartidor_ubicacion_fecha
            ) VALUES (?, ?, ?, ?)
        `, [id_repartidor, latitud, longitud, fecha]);

        res.status(201).json({
            id_repartidor_ubicacion: result.insertId,
            id_repartidor,
            repartidor_ubicacion_latitud: latitud,
            repartidor_ubicacion_longitud: longitud,
            repartidor_ubicacion_fecha: fecha,
            message: "Ubicación registrada correctamente"
        });
    } catch (error) {
        console.error("Error postRepartidorUbicacion:", error);
        return res.status(500).json({ message: "Error al registrar ubicación", error: error.message });
    }
};

// PUT: Actualizar ubicación
export const putRepartidorUbicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_repartidor,
            repartidor_ubicacion_latitud,
            repartidor_ubicacion_longitud,
            repartidor_ubicacion_fecha
        } = req.body;

        // Validar datos obligatorios
        if (!id_repartidor) {
            return res.status(400).json({ message: "id_repartidor es obligatorio" });
        }

        if (repartidor_ubicacion_latitud === undefined || repartidor_ubicacion_longitud === undefined) {
            return res.status(400).json({ message: "La latitud y longitud son obligatorias" });
        }

        // Validar coordenadas
        const latitud = Number(repartidor_ubicacion_latitud);
        const longitud = Number(repartidor_ubicacion_longitud);

        if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
            return res.status(400).json({ message: "La latitud no es válida" });
        }

        if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
            return res.status(400).json({ message: "La longitud no es válida" });
        }

        const [result] = await conmysql.query(`
            UPDATE repartidor_ubicaciones
            SET id_repartidor = ?, repartidor_ubicacion_latitud = ?,
                repartidor_ubicacion_longitud = ?, repartidor_ubicacion_fecha = ?
            WHERE id_repartidor_ubicacion = ?
        `, [
            id_repartidor,
            latitud,
            longitud,
            repartidor_ubicacion_fecha || new Date(),
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ubicación no encontrada" });
        }

        const [rows] = await conmysql.query(
            "SELECT * FROM repartidor_ubicaciones WHERE id_repartidor_ubicacion = ?",
            [id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error("Error putRepartidorUbicacion:", error);
        return res.status(500).json({ message: "Error al actualizar ubicación", error: error.message });
    }
};

// DELETE: Eliminar ubicación
export const deleteRepartidorUbicacion = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(`
            DELETE FROM repartidor_ubicaciones
            WHERE id_repartidor_ubicacion = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ubicación no encontrada" });
        }

        res.status(204).send();
    } catch (error) {
        console.error("Error deleteRepartidorUbicacion:", error);
        return res.status(500).json({ message: "Error al eliminar ubicación", error: error.message });
    }
};
 */



// src/controladores/repartidorubicacionCtrl.js

import { conmysql } from "../db.js";

// ============================================================
// GET: Todas las ubicaciones
// ============================================================
export const getRepartidorUbicaciones = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT
                ru.*,
                r.repartidor_codigo
            FROM repartidor_ubicaciones ru
            LEFT JOIN repartidores r
                ON ru.id_repartidor = r.id_repartidor
            ORDER BY ru.repartidor_ubicacion_fecha DESC
        `);

        return res.json(result);

    } catch (error) {
        console.error("Error getRepartidorUbicaciones:", error);

        return res.status(500).json({
            success: false,
            message: "Error al consultar ubicaciones",
            error: error.message
        });
    }
};


// ============================================================
// GET: Ubicación por ID
// ============================================================
export const getRepartidorUbicacionxid = async (req, res) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "El ID de la ubicación no es válido"
            });
        }

        const [result] = await conmysql.query(`
            SELECT
                ru.*,
                r.repartidor_codigo
            FROM repartidor_ubicaciones ru
            LEFT JOIN repartidores r
                ON ru.id_repartidor = r.id_repartidor
            WHERE ru.id_repartidor_ubicacion = ?
        `, [id]);

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                id_repartidor_ubicacion: 0,
                message: "Ubicación no encontrada"
            });
        }

        return res.json(result[0]);

    } catch (error) {
        console.error("Error getRepartidorUbicacionxid:", error);

        return res.status(500).json({
            success: false,
            message: "Error del servidor",
            error: error.message
        });
    }
};


// ============================================================
// GET: Todas las ubicaciones de un repartidor
// ============================================================
export const getUbicacionesPorRepartidor = async (req, res) => {
    try {
        const { id_repartidor } = req.params;

        if (!Number.isInteger(Number(id_repartidor)) || Number(id_repartidor) <= 0) {
            return res.status(400).json({
                success: false,
                message: "El ID del repartidor no es válido"
            });
        }

        const [result] = await conmysql.query(`
            SELECT *
            FROM repartidor_ubicaciones
            WHERE id_repartidor = ?
            ORDER BY repartidor_ubicacion_fecha DESC,
                     id_repartidor_ubicacion DESC
        `, [id_repartidor]);

        return res.json(result);

    } catch (error) {
        console.error("Error getUbicacionesPorRepartidor:", error);

        return res.status(500).json({
            success: false,
            message: "Error al consultar ubicaciones del repartidor",
            error: error.message
        });
    }
};


// ============================================================
// GET: Última ubicación de un repartidor
// ============================================================
export const getUltimaUbicacionRepartidor = async (req, res) => {
    try {
        const { id_repartidor } = req.params;

        if (!Number.isInteger(Number(id_repartidor)) || Number(id_repartidor) <= 0) {
            return res.status(400).json({
                success: false,
                message: "El ID del repartidor no es válido"
            });
        }

        const [result] = await conmysql.query(`
            SELECT
                ru.*,
                r.repartidor_codigo
            FROM repartidor_ubicaciones ru
            INNER JOIN repartidores r
                ON ru.id_repartidor = r.id_repartidor
            WHERE ru.id_repartidor = ?
            ORDER BY ru.repartidor_ubicacion_fecha DESC,
                     ru.id_repartidor_ubicacion DESC
            LIMIT 1
        `, [id_repartidor]);

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "El repartidor todavía no tiene una ubicación registrada"
            });
        }

        return res.json(result[0]);

    } catch (error) {
        console.error("Error getUltimaUbicacionRepartidor:", error);

        return res.status(500).json({
            success: false,
            message: "Error al consultar última ubicación",
            error: error.message
        });
    }
};


// ============================================================
// POST: Registrar ubicación
// ============================================================
export const postRepartidorUbicacion = async (req, res) => {
    try {
        const {
            id_repartidor,
            repartidor_ubicacion_latitud,
            repartidor_ubicacion_longitud,
            repartidor_ubicacion_fecha
        } = req.body;

        // --------------------------------------------------------
        // Validaciones
        // --------------------------------------------------------

        if (
            id_repartidor === undefined ||
            id_repartidor === null ||
            id_repartidor === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "id_repartidor es obligatorio"
            });
        }

        if (
            repartidor_ubicacion_latitud === undefined ||
            repartidor_ubicacion_longitud === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "La latitud y longitud son obligatorias"
            });
        }

        const idRepartidor = Number(id_repartidor);
        const latitud = Number(repartidor_ubicacion_latitud);
        const longitud = Number(repartidor_ubicacion_longitud);

        if (!Number.isInteger(idRepartidor) || idRepartidor <= 0) {
            return res.status(400).json({
                success: false,
                message: "El ID del repartidor no es válido"
            });
        }

        if (
            !Number.isFinite(latitud) ||
            latitud < -90 ||
            latitud > 90
        ) {
            return res.status(400).json({
                success: false,
                message: "La latitud no es válida"
            });
        }

        if (
            !Number.isFinite(longitud) ||
            longitud < -180 ||
            longitud > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "La longitud no es válida"
            });
        }

        // --------------------------------------------------------
        // Verificar que el repartidor exista
        // --------------------------------------------------------

        const [repartidores] = await conmysql.query(`
            SELECT
                r.id_repartidor,
                r.repartidor_codigo,
                r.id_estado_repartidor
            FROM repartidores r
            WHERE r.id_repartidor = ?
            LIMIT 1
        `, [idRepartidor]);

        if (!repartidores.length) {
            return res.status(404).json({
                success: false,
                message: "El repartidor no existe"
            });
        }

        // --------------------------------------------------------
        // Fecha
        //
        // Se recomienda que la aplicación NO mande una fecha
        // antigua. Si no la manda, se utiliza la fecha del servidor.
        // --------------------------------------------------------

        const fecha =
            repartidor_ubicacion_fecha &&
                !isNaN(new Date(repartidor_ubicacion_fecha).getTime())
                ? new Date(repartidor_ubicacion_fecha)
                : new Date();

        // --------------------------------------------------------
        // Registrar ubicación
        //
        // NO se actualiza la anterior.
        // Se mantiene historial para poder reconstruir trayectorias.
        // --------------------------------------------------------

        const [result] = await conmysql.query(`
            INSERT INTO repartidor_ubicaciones (
                id_repartidor,
                repartidor_ubicacion_latitud,
                repartidor_ubicacion_longitud,
                repartidor_ubicacion_fecha
            )
            VALUES (?, ?, ?, ?)
        `, [
            idRepartidor,
            latitud,
            longitud,
            fecha
        ]);

        return res.status(201).json({
            success: true,
            id_repartidor_ubicacion: result.insertId,
            id_repartidor: idRepartidor,
            repartidor_ubicacion_latitud: latitud,
            repartidor_ubicacion_longitud: longitud,
            repartidor_ubicacion_fecha: fecha,
            message: "Ubicación registrada correctamente"
        });

    } catch (error) {
        console.error("Error postRepartidorUbicacion:", error);

        return res.status(500).json({
            success: false,
            message: "Error al registrar ubicación",
            error: error.message
        });
    }
};


// ============================================================
// PUT: Actualizar ubicación
// ============================================================
export const putRepartidorUbicacion = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            id_repartidor,
            repartidor_ubicacion_latitud,
            repartidor_ubicacion_longitud,
            repartidor_ubicacion_fecha
        } = req.body;

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "El ID de la ubicación no es válido"
            });
        }

        if (!id_repartidor) {
            return res.status(400).json({
                success: false,
                message: "id_repartidor es obligatorio"
            });
        }

        const latitud = Number(repartidor_ubicacion_latitud);
        const longitud = Number(repartidor_ubicacion_longitud);

        if (
            !Number.isFinite(latitud) ||
            latitud < -90 ||
            latitud > 90
        ) {
            return res.status(400).json({
                success: false,
                message: "La latitud no es válida"
            });
        }

        if (
            !Number.isFinite(longitud) ||
            longitud < -180 ||
            longitud > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "La longitud no es válida"
            });
        }

        const fecha =
            repartidor_ubicacion_fecha &&
                !isNaN(new Date(repartidor_ubicacion_fecha).getTime())
                ? new Date(repartidor_ubicacion_fecha)
                : new Date();

        const [result] = await conmysql.query(`
            UPDATE repartidor_ubicaciones
            SET
                id_repartidor = ?,
                repartidor_ubicacion_latitud = ?,
                repartidor_ubicacion_longitud = ?,
                repartidor_ubicacion_fecha = ?
            WHERE id_repartidor_ubicacion = ?
        `, [
            id_repartidor,
            latitud,
            longitud,
            fecha,
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Ubicación no encontrada"
            });
        }

        const [rows] = await conmysql.query(`
            SELECT
                ru.*,
                r.repartidor_codigo
            FROM repartidor_ubicaciones ru
            LEFT JOIN repartidores r
                ON ru.id_repartidor = r.id_repartidor
            WHERE ru.id_repartidor_ubicacion = ?
        `, [id]);

        return res.json({
            success: true,
            ...rows[0]
        });

    } catch (error) {
        console.error("Error putRepartidorUbicacion:", error);

        return res.status(500).json({
            success: false,
            message: "Error al actualizar ubicación",
            error: error.message
        });
    }
};


// ============================================================
// DELETE: Eliminar ubicación
// ============================================================
export const deleteRepartidorUbicacion = async (req, res) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "El ID de la ubicación no es válido"
            });
        }

        const [result] = await conmysql.query(`
            DELETE FROM repartidor_ubicaciones
            WHERE id_repartidor_ubicacion = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Ubicación no encontrada"
            });
        }

        return res.status(204).send();

    } catch (error) {
        console.error("Error deleteRepartidorUbicacion:", error);

        return res.status(500).json({
            success: false,
            message: "Error al eliminar ubicación",
            error: error.message
        });
    }
};
