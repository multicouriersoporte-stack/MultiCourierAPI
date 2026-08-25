import { conmysql } from "../db.js";

// =====================================================
// GET: Obtener todas las observaciones
// =====================================================
export const getPedidoObservaciones = async (req, res) => {
    try {

        const [result] = await conmysql.query(`
            SELECT
                po.*,

                p.pedido_codigo,

                t.tipo_observacion_nombre,

                ue.usuario_nombre AS emisor_nombre,
                ue.usuario_apellido AS emisor_apellido,
                ue.usuario_nombre_completo AS emisor_nombre_completo,

                ur.usuario_nombre AS receptor_nombre,
                ur.usuario_apellido AS receptor_apellido,
                ur.usuario_nombre_completo AS receptor_nombre_completo

            FROM pedidoobservaciones po

            LEFT JOIN pedidos p
                ON po.id_pedido = p.id_pedido

            LEFT JOIN tipos_observacion t
                ON po.id_tipo_observacion = t.id_tipo_observacion

            LEFT JOIN usuarios ue
                ON po.id_usuario_emisor = ue.id_usuario

            LEFT JOIN usuarios ur
                ON po.id_usuario_receptor = ur.id_usuario

            ORDER BY po.id_pedido_observacion DESC
        `);

        res.json(result);

    } catch (error) {

        console.error(
            "Error getPedidoObservaciones:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar observaciones",
            error: error.message
        });
    }
};


// =====================================================
// GET: Obtener observación por ID
// =====================================================
export const getPedidoObservacionPorId = async (req, res) => {
    try {

        const { id } = req.params;

        const [result] = await conmysql.query(`
            SELECT
                po.*,

                p.pedido_codigo,

                t.tipo_observacion_nombre,

                ue.usuario_nombre AS emisor_nombre,
                ue.usuario_apellido AS emisor_apellido,
                ue.usuario_nombre_completo AS emisor_nombre_completo,

                ur.usuario_nombre AS receptor_nombre,
                ur.usuario_apellido AS receptor_apellido,
                ur.usuario_nombre_completo AS receptor_nombre_completo

            FROM pedidoobservaciones po

            LEFT JOIN pedidos p
                ON po.id_pedido = p.id_pedido

            LEFT JOIN tipos_observacion t
                ON po.id_tipo_observacion = t.id_tipo_observacion

            LEFT JOIN usuarios ue
                ON po.id_usuario_emisor = ue.id_usuario

            LEFT JOIN usuarios ur
                ON po.id_usuario_receptor = ur.id_usuario

            WHERE po.id_pedido_observacion = ?
        `, [id]);


        if (result.length === 0) {

            return res.status(404).json({
                id_pedido_observacion: 0,
                message: "Observación no encontrada"
            });
        }


        res.json(result[0]);

    } catch (error) {

        console.error(
            "Error getPedidoObservacionPorId:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar observación",
            error: error.message
        });
    }
};


// =====================================================
// GET: Observaciones de un pedido
// =====================================================
export const getObservacionesPorPedido = async (req, res) => {
    try {

        const { id_pedido } = req.params;

        const [result] = await conmysql.query(`
            SELECT
                po.*,

                p.pedido_codigo,

                t.tipo_observacion_nombre,

                ue.usuario_nombre AS emisor_nombre,
                ue.usuario_apellido AS emisor_apellido,
                ue.usuario_nombre_completo AS emisor_nombre_completo,

                ur.usuario_nombre AS receptor_nombre,
                ur.usuario_apellido AS receptor_apellido,
                ur.usuario_nombre_completo AS receptor_nombre_completo

            FROM pedidoobservaciones po

            LEFT JOIN pedidos p
                ON po.id_pedido = p.id_pedido

            LEFT JOIN tipos_observacion t
                ON po.id_tipo_observacion = t.id_tipo_observacion

            LEFT JOIN usuarios ue
                ON po.id_usuario_emisor = ue.id_usuario

            LEFT JOIN usuarios ur
                ON po.id_usuario_receptor = ur.id_usuario

            WHERE po.id_pedido = ?

            ORDER BY po.pedido_observacion_fecha DESC,
                     po.id_pedido_observacion DESC
        `, [id_pedido]);


        res.json(result);

    } catch (error) {

        console.error(
            "Error getObservacionesPorPedido:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar observaciones del pedido",
            error: error.message
        });
    }
};


// =====================================================
// GET: Observaciones enviadas por un usuario
// =====================================================
export const getObservacionesPorEmisor = async (req, res) => {
    try {

        const { id_usuario_emisor } = req.params;

        const [result] = await conmysql.query(`
            SELECT
                po.*,

                p.pedido_codigo,

                t.tipo_observacion_nombre,

                ue.usuario_nombre AS emisor_nombre,
                ue.usuario_apellido AS emisor_apellido,
                ue.usuario_nombre_completo AS emisor_nombre_completo,

                ur.usuario_nombre AS receptor_nombre,
                ur.usuario_apellido AS receptor_apellido,
                ur.usuario_nombre_completo AS receptor_nombre_completo

            FROM pedidoobservaciones po

            LEFT JOIN pedidos p
                ON po.id_pedido = p.id_pedido

            LEFT JOIN tipos_observacion t
                ON po.id_tipo_observacion = t.id_tipo_observacion

            LEFT JOIN usuarios ue
                ON po.id_usuario_emisor = ue.id_usuario

            LEFT JOIN usuarios ur
                ON po.id_usuario_receptor = ur.id_usuario

            WHERE po.id_usuario_emisor = ?

            ORDER BY po.pedido_observacion_fecha DESC
        `, [id_usuario_emisor]);


        res.json(result);

    } catch (error) {

        console.error(
            "Error getObservacionesPorEmisor:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar observaciones enviadas",
            error: error.message
        });
    }
};


// =====================================================
// GET: Observaciones recibidas por un usuario
// =====================================================
export const getObservacionesPorReceptor = async (req, res) => {
    try {

        const { id_usuario_receptor } = req.params;

        const [result] = await conmysql.query(`
            SELECT
                po.*,

                p.pedido_codigo,

                t.tipo_observacion_nombre,

                ue.usuario_nombre AS emisor_nombre,
                ue.usuario_apellido AS emisor_apellido,
                ue.usuario_nombre_completo AS emisor_nombre_completo,

                ur.usuario_nombre AS receptor_nombre,
                ur.usuario_apellido AS receptor_apellido,
                ur.usuario_nombre_completo AS receptor_nombre_completo

            FROM pedidoobservaciones po

            LEFT JOIN pedidos p
                ON po.id_pedido = p.id_pedido

            LEFT JOIN tipos_observacion t
                ON po.id_tipo_observacion = t.id_tipo_observacion

            LEFT JOIN usuarios ue
                ON po.id_usuario_emisor = ue.id_usuario

            LEFT JOIN usuarios ur
                ON po.id_usuario_receptor = ur.id_usuario

            WHERE po.id_usuario_receptor = ?

            ORDER BY po.pedido_observacion_fecha DESC
        `, [id_usuario_receptor]);


        res.json(result);

    } catch (error) {

        console.error(
            "Error getObservacionesPorReceptor:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar observaciones recibidas",
            error: error.message
        });
    }
};


// =====================================================
// GET: Observaciones por tipo
// =====================================================
export const getObservacionesPorTipo = async (req, res) => {
    try {

        const { id_tipo_observacion } = req.params;

        const [result] = await conmysql.query(`
            SELECT
                po.*,

                p.pedido_codigo,

                t.tipo_observacion_nombre,

                ue.usuario_nombre AS emisor_nombre,
                ue.usuario_apellido AS emisor_apellido,
                ue.usuario_nombre_completo AS emisor_nombre_completo,

                ur.usuario_nombre AS receptor_nombre,
                ur.usuario_apellido AS receptor_apellido,
                ur.usuario_nombre_completo AS receptor_nombre_completo

            FROM pedidoobservaciones po

            LEFT JOIN pedidos p
                ON po.id_pedido = p.id_pedido

            LEFT JOIN tipos_observacion t
                ON po.id_tipo_observacion = t.id_tipo_observacion

            LEFT JOIN usuarios ue
                ON po.id_usuario_emisor = ue.id_usuario

            LEFT JOIN usuarios ur
                ON po.id_usuario_receptor = ur.id_usuario

            WHERE po.id_tipo_observacion = ?

            ORDER BY po.pedido_observacion_fecha DESC
        `, [id_tipo_observacion]);


        res.json(result);

    } catch (error) {

        console.error(
            "Error getObservacionesPorTipo:",
            error
        );

        return res.status(500).json({
            message: "Error al consultar observaciones por tipo",
            error: error.message
        });
    }
};


// =====================================================
// POST: Crear observación
// =====================================================
export const postPedidoObservacion = async (req, res) => {

    const conexion = await conmysql.getConnection();

    try {

        const {
            id_pedido,
            id_tipo_observacion,
            id_usuario_emisor,
            id_usuario_receptor,
            pedido_observacion_fecha
        } = req.body;


        // =================================================
        // VALIDAR PEDIDO
        // =================================================

        if (!id_pedido) {

            return res.status(400).json({
                message: "El pedido es obligatorio"
            });
        }


        // =================================================
        // VALIDAR TIPO DE OBSERVACIÓN
        // =================================================

        if (!id_tipo_observacion) {

            return res.status(400).json({
                message: "El tipo de observación es obligatorio"
            });
        }


        // =================================================
        // VALIDAR EMISOR
        // =================================================

        if (!id_usuario_emisor) {

            return res.status(400).json({
                message: "El usuario emisor es obligatorio"
            });
        }


        // =================================================
        // VALIDAR RECEPTOR
        // =================================================

        if (!id_usuario_receptor) {

            return res.status(400).json({
                message: "El usuario receptor es obligatorio"
            });
        }


        // =================================================
        // COMPROBAR PEDIDO
        // =================================================

        const [pedidos] = await conexion.query(`
            SELECT id_pedido
            FROM pedidos
            WHERE id_pedido = ?
        `, [id_pedido]);


        if (pedidos.length === 0) {

            return res.status(404).json({
                message: "El pedido no existe"
            });
        }


        // =================================================
        // COMPROBAR TIPO DE OBSERVACIÓN
        // =================================================

        const [tipos] = await conexion.query(`
            SELECT id_tipo_observacion
            FROM tipos_observacion
            WHERE id_tipo_observacion = ?
        `, [id_tipo_observacion]);


        if (tipos.length === 0) {

            return res.status(404).json({
                message: "El tipo de observación no existe"
            });
        }


        // =================================================
        // COMPROBAR USUARIO EMISOR
        // =================================================

        const [emisores] = await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
        `, [id_usuario_emisor]);


        if (emisores.length === 0) {

            return res.status(404).json({
                message: "El usuario emisor no existe"
            });
        }


        // =================================================
        // COMPROBAR USUARIO RECEPTOR
        // =================================================

        const [receptores] = await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
        `, [id_usuario_receptor]);


        if (receptores.length === 0) {

            return res.status(404).json({
                message: "El usuario receptor no existe"
            });
        }


        // =================================================
        // INICIAR TRANSACCIÓN
        // =================================================

        await conexion.beginTransaction();


        // =================================================
        // INSERTAR OBSERVACIÓN
        // =================================================

        const [result] = await conexion.query(`
            INSERT INTO pedidoobservaciones (
                id_pedido,
                id_tipo_observacion,
                id_usuario_emisor,
                id_usuario_receptor,
                pedido_observacion_fecha
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            id_pedido,
            id_tipo_observacion,
            id_usuario_emisor,
            id_usuario_receptor,
            pedido_observacion_fecha || new Date()
        ]);


        const id_pedido_observacion =
            result.insertId;


        // =================================================
        // CONFIRMAR
        // =================================================

        await conexion.commit();


        // =================================================
        // RESPUESTA
        // =================================================

        res.status(201).json({
            id_pedido_observacion,
            message: "Observación registrada con éxito"
        });


    } catch (error) {

        await conexion.rollback();

        console.error(
            "Error postPedidoObservacion:",
            error
        );

        return res.status(500).json({
            message: "Error al registrar observación",
            error: error.message
        });

    } finally {

        conexion.release();
    }
};


// =====================================================
// PUT: Actualizar observación completa
// =====================================================
export const putPedidoObservacion = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            id_pedido,
            id_tipo_observacion,
            id_usuario_emisor,
            id_usuario_receptor,
            pedido_observacion_fecha
        } = req.body;


        const [result] = await conmysql.query(`
            UPDATE pedidoobservaciones
            SET
                id_pedido = ?,
                id_tipo_observacion = ?,
                id_usuario_emisor = ?,
                id_usuario_receptor = ?,
                pedido_observacion_fecha = ?
            WHERE id_pedido_observacion = ?
        `, [
            id_pedido,
            id_tipo_observacion,
            id_usuario_emisor,
            id_usuario_receptor,
            pedido_observacion_fecha,
            id
        ]);


        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: "Observación no encontrada"
            });
        }


        const [rows] = await conmysql.query(`
            SELECT *
            FROM pedidoobservaciones
            WHERE id_pedido_observacion = ?
        `, [id]);


        res.json(rows[0]);

    } catch (error) {

        console.error(
            "Error putPedidoObservacion:",
            error
        );

        return res.status(500).json({
            message: "Error al actualizar observación",
            error: error.message
        });
    }
};


// =====================================================
// PATCH: Actualización parcial
// =====================================================
export const patchPedidoObservacion = async (req, res) => {

    try {

        const { id } = req.params;


        const camposPermitidos = [
            "id_pedido",
            "id_tipo_observacion",
            "id_usuario_emisor",
            "id_usuario_receptor",
            "pedido_observacion_fecha"
        ];


        const campos = [];
        const valores = [];


        for (const campo of camposPermitidos) {

            if (req.body[campo] !== undefined) {

                campos.push(`${campo} = ?`);

                valores.push(
                    req.body[campo]
                );
            }
        }


        if (campos.length === 0) {

            return res.status(400).json({
                message:
                    "No se proporcionaron campos para actualizar"
            });
        }


        valores.push(id);


        const [result] = await conmysql.query(`
            UPDATE pedidoobservaciones
            SET ${campos.join(", ")}
            WHERE id_pedido_observacion = ?
        `, valores);


        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: "Observación no encontrada"
            });
        }


        const [rows] = await conmysql.query(`
            SELECT *
            FROM pedidoobservaciones
            WHERE id_pedido_observacion = ?
        `, [id]);


        res.json(rows[0]);

    } catch (error) {

        console.error(
            "Error patchPedidoObservacion:",
            error
        );

        return res.status(500).json({
            message: "Error al actualizar observación",
            error: error.message
        });
    }
};


// =====================================================
// DELETE: Eliminar observación
// =====================================================
export const deletePedidoObservacion = async (req, res) => {

    const conexion = await conmysql.getConnection();

    try {

        const { id } = req.params;


        await conexion.beginTransaction();


        // =================================================
        // VERIFICAR OBSERVACIÓN
        // =================================================

        const [observacion] = await conexion.query(`
            SELECT id_pedido_observacion
            FROM pedidoobservaciones
            WHERE id_pedido_observacion = ?
        `, [id]);


        if (observacion.length === 0) {

            await conexion.rollback();

            return res.status(404).json({
                id_pedido_observacion: 0,
                message: "Observación no encontrada"
            });
        }


        // =================================================
        // ELIMINAR
        // =================================================

        const [result] = await conexion.query(`
            DELETE FROM pedidoobservaciones
            WHERE id_pedido_observacion = ?
        `, [id]);


        if (result.affectedRows === 0) {

            await conexion.rollback();

            return res.status(404).json({
                message: "No se pudo eliminar la observación"
            });
        }


        // =================================================
        // CONFIRMAR
        // =================================================

        await conexion.commit();


        res.status(204).send();


    } catch (error) {

        await conexion.rollback();

        console.error(
            "Error deletePedidoObservacion:",
            error
        );

        return res.status(500).json({
            message: "Error al eliminar observación",
            error: error.message
        });

    } finally {

        conexion.release();
    }
};
