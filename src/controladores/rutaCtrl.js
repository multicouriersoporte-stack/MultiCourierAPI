import { conmysql } from "../db.js";

export const getRutas = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT
                r.ruta_id,
                r.ruta_codigo,
                r.empleado_id,
                r.vehiculo_id,
                r.ruta_estado,
                r.ruta_observacion,
                r.ruta_fecha_registro,
                r.ruta_hora_inicio,
                r.ruta_hora_fin
            FROM ruta r
            ORDER BY r.ruta_id DESC
        `);

        res.json(result);
    } catch (error) {
        console.error("Error al consultar rutas:", error);

        return res.status(500).json({
            message: "Error al consultar Rutas"
        });
    }
};

export const getRutasxid = async (req, res) => {
    try {
        const [rutas] = await conmysql.query(`
            SELECT
                r.ruta_id,
                r.ruta_codigo,
                r.empleado_id,
                r.vehiculo_id,
                r.ruta_estado,
                r.ruta_observacion,
                r.ruta_fecha_registro,
                r.ruta_hora_inicio,
                r.ruta_hora_fin
            FROM ruta r
            WHERE r.ruta_id = ?
        `, [req.params.id]);

        if (rutas.length === 0) {
            return res.status(404).json({
                ruta_id: 0,
                message: "Ruta no encontrada"
            });
        }

        const [pedidos] = await conmysql.query(`
            SELECT
                p.pedido_id,
                p.pedido_codigo,
                p.cliente_id,
                CONCAT(
                    c.cliente_nombre,
                    ' ',
                    c.cliente_apellido
                ) AS cliente_nombre,
                c.cliente_telefono,
                c.cliente_direccion,
                c.cliente_latitud,
                c.cliente_longitud,
                p.pedido_estado,
                p.pedido_total,
                p.pedido_observacion,
                p.pedido_fecha_registro,
                p.pedido_fecha_asignacion,
                p.pedido_fecha_inicio,
                p.pedido_fecha_entrega,
                p.pedido_fecha_cancelacion
            FROM pedido p
            INNER JOIN cliente c
                ON p.cliente_id = c.cliente_id
            WHERE p.ruta_id = ?
            ORDER BY p.pedido_id ASC
        `, [req.params.id]);

        const ruta = rutas[0];
        ruta.pedidos = pedidos;

        res.json(ruta);
    } catch (error) {
        console.error("Error al consultar ruta:", error);

        return res.status(500).json({
            message: "Error del Servidor"
        });
    }
};

export const postRutas = async (req, res) => {
    try {
        const {
            empleado_id,
            vehiculo_id,
            ruta_estado,
            ruta_observacion,
            ruta_fecha_registro,
            ruta_hora_inicio,
            ruta_hora_fin
        } = req.body;

        if (!empleado_id) {
            return res.status(400).json({
                message: "Debe seleccionar un empleado"
            });
        }

        if (!vehiculo_id) {
            return res.status(400).json({
                message: "Debe seleccionar un vehículo"
            });
        }

        const [ultimaRuta] = await conmysql.query(`
            SELECT ruta_codigo
            FROM ruta
            ORDER BY ruta_id DESC
            LIMIT 1
        `);

        let numero = 1;

        if (
            ultimaRuta.length > 0 &&
            ultimaRuta[0].ruta_codigo
        ) {
            const match =
                ultimaRuta[0].ruta_codigo.match(/(\d+)$/);

            if (match) {
                numero = parseInt(match[1], 10) + 1;
            }
        }

        const ruta_codigo =
            `RUT-${String(numero).padStart(5, '0')}`;

        const [result] = await conmysql.query(`
            INSERT INTO ruta (
                ruta_codigo,
                empleado_id,
                vehiculo_id,
                ruta_estado,
                ruta_observacion,
                ruta_fecha_registro,
                ruta_hora_inicio,
                ruta_hora_fin
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ruta_codigo,
            empleado_id,
            vehiculo_id,
            ruta_estado || 'Pendiente',
            ruta_observacion || '',
            ruta_fecha_registro || new Date(),
            ruta_hora_inicio || null,
            ruta_hora_fin || null
        ]);

        res.json({
            id: result.insertId,
            ruta_codigo,
            ruta_estado: ruta_estado || 'Pendiente',
            message: "Ruta registrada con éxito"
        });
    } catch (error) {
        console.error("Error al crear ruta:", error);

        return res.status(500).json({
            message: error.message
        });
    }
};

export const putRutas = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            ruta_codigo,
            empleado_id,
            vehiculo_id,
            ruta_estado,
            ruta_observacion,
            ruta_fecha_registro,
            ruta_hora_inicio,
            ruta_hora_fin
        } = req.body;

        const [result] = await conmysql.query(`
            UPDATE ruta
            SET
                ruta_codigo = ?,
                empleado_id = ?,
                vehiculo_id = ?,
                ruta_estado = ?,
                ruta_observacion = ?,
                ruta_fecha_registro = ?,
                ruta_hora_inicio = ?,
                ruta_hora_fin = ?
            WHERE ruta_id = ?
        `, [
            ruta_codigo,
            empleado_id,
            vehiculo_id,
            ruta_estado,
            ruta_observacion,
            ruta_fecha_registro,
            ruta_hora_inicio,
            ruta_hora_fin,
            id
        ]);

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                message: "Ruta no encontrada"
            });
        }

        const [rows] = await conmysql.query(`
            SELECT *
            FROM ruta
            WHERE ruta_id = ?
        `, [id]);

        res.json(rows[0]);
    } catch (error) {
        console.error("Error al actualizar ruta:", error);

        return res.status(500).json({
            message: error.message
        });
    }
};

export const pathRutas = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            ruta_codigo,
            empleado_id,
            vehiculo_id,
            ruta_estado,
            ruta_observacion,
            ruta_fecha_registro,
            ruta_hora_inicio,
            ruta_hora_fin
        } = req.body;

        const [result] = await conmysql.query(`
            UPDATE ruta
            SET
                ruta_codigo = IFNULL(?, ruta_codigo),
                empleado_id = IFNULL(?, empleado_id),
                vehiculo_id = IFNULL(?, vehiculo_id),
                ruta_estado = IFNULL(?, ruta_estado),
                ruta_observacion = IFNULL(?, ruta_observacion),
                ruta_fecha_registro = IFNULL(?, ruta_fecha_registro),
                ruta_hora_inicio = IFNULL(?, ruta_hora_inicio),
                ruta_hora_fin = IFNULL(?, ruta_hora_fin)
            WHERE ruta_id = ?
        `, [
            ruta_codigo,
            empleado_id,
            vehiculo_id,
            ruta_estado,
            ruta_observacion,
            ruta_fecha_registro,
            ruta_hora_inicio,
            ruta_hora_fin,
            id
        ]);

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                message: "Ruta no encontrada"
            });
        }

        const [rows] = await conmysql.query(`
            SELECT *
            FROM ruta
            WHERE ruta_id = ?
        `, [id]);

        res.json(rows[0]);
    } catch (error) {
        console.error(
            "Error al actualizar parcialmente ruta:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    }
};

export const deleteRutas = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `
            DELETE FROM ruta
            WHERE ruta_id = ?
            `,
            [id]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                ruta_id: 0,
                message: "Ruta no encontrada"
            });
        }

        res.sendStatus(202);
    } catch (error) {
        console.error("Error al eliminar ruta:", error);

        return res.status(500).json({
            message: error.message
        });
    }
};

export const asignarPedidosRuta = async (req, res) => {
    const conexion = await conmysql.getConnection();

    try {
        const { id } = req.params;
        const { pedidos } = req.body;

        const [ruta] = await conexion.query(`
            SELECT ruta_id
            FROM ruta
            WHERE ruta_id = ?
        `, [id]);

        if (ruta.length === 0) {
            return res.status(404).json({
                message: "Ruta no encontrada"
            });
        }

        if (
            !Array.isArray(pedidos) ||
            pedidos.length === 0
        ) {
            return res.status(400).json({
                message: "Debe indicar al menos un pedido"
            });
        }

        await conexion.beginTransaction();

        for (const pedido_id of pedidos) {
            if (!pedido_id) {
                throw new Error("Existe un pedido inválido");
            }

            const [pedido] = await conexion.query(`
                SELECT
                    pedido_id,
                    pedido_estado
                FROM pedido
                WHERE pedido_id = ?
            `, [pedido_id]);

            if (pedido.length === 0) {
                throw new Error(
                    `El pedido ${pedido_id} no existe`
                );
            }

            await conexion.query(`
                UPDATE pedido
                SET
                    ruta_id = ?,
                    pedido_estado = 'Asignado',
                    pedido_fecha_asignacion = NOW()
                WHERE pedido_id = ?
            `, [
                id,
                pedido_id
            ]);
        }

        await conexion.commit();

        res.json({
            ruta_id: Number(id),
            pedidos_asignados: pedidos.length,
            message: "Pedidos asignados a la ruta correctamente"
        });
    } catch (error) {
        await conexion.rollback();

        console.error(
            "Error al asignar pedidos a ruta:",
            error
        );

        return res.status(500).json({
            message: error.message
        });
    } finally {
        conexion.release();
    }
};