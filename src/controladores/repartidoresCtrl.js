/* import { conmysql } from "../db.js";

// Campos de estado incluidos en las consultas.
const estadoSelect = `
    er.estado_repartidor_nombre, er.estado_repartidor_descripcion,
    er.estado_repartidor_visible_front, er.estado_repartidor_permite_pedidos,
    er.estado_repartidor_permite_seleccion`;

const selectRepartidor = `
    SELECT r.*, ${estadoSelect}
    FROM repartidores r
    LEFT JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor`;

// Obtener todos los repartidores ordenados por ranking.
export const getRepartidores = async (req, res) => {
    try {
        const [result] = await conmysql.query(`${selectRepartidor}
            ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999 ELSE r.repartidor_posicion_ranking END ASC,
            r.repartidor_total_pedidos ASC, r.repartidor_calificacion DESC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getRepartidores:", error);
        return res.status(500).json({ message: "Error al consultar repartidores", error: error.message });
    }
};

// Obtener repartidor por ID.
export const getRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`${selectRepartidor} WHERE r.id_repartidor = ?`, [id]);
        if (!result.length) return res.status(404).json({ id_repartidor: 0, message: "Repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener repartidor asociado a un usuario.
export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`${selectRepartidor} WHERE r.id_usuario = ?`, [id_usuario]);
        if (!result.length) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Buscar repartidor por código.
export const getRepartidorPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`${selectRepartidor} WHERE r.repartidor_codigo = ?`, [codigo]);
        if (!result.length) return res.status(404).json({ message: "Repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener el primer repartidor disponible: estados 1 = LISTO, 2 = REPARTIENDO.
export const getRepartidorDisponible = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            SELECT r.id_repartidor, r.id_usuario, r.id_categoria_repartidor, r.repartidor_codigo,
                   r.repartidor_tipo_vehiculo, r.repartidor_posicion_ranking, r.repartidor_total_pedidos,
                   r.repartidor_calificacion, r.repartidor_confianza, r.id_estado_repartidor,
                   er.estado_repartidor_nombre
            FROM repartidores r
            INNER JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor
            WHERE r.id_estado_repartidor IN (1, 2) AND er.estado_repartidor_estado = 1
            ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999 ELSE r.repartidor_posicion_ranking END ASC,
                     r.repartidor_total_pedidos ASC, r.repartidor_calificacion DESC
            LIMIT 1`);
        if (!result.length) return res.status(404).json({ message: "No hay repartidores disponibles" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorDisponible:", error);
        return res.status(500).json({ message: "Error al buscar repartidor disponible", error: error.message });
    }
};

// Crear un nuevo repartidor.
export const postRepartidores = async (req, res) => {
    try {
        const {
            id_usuario, id_categoria_repartidor, id_estado_repartidor, repartidor_codigo, repartidor_placa,
            repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking,
            repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados,
            repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado,
            repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso
        } = req.body;

        if (!id_usuario) return res.status(400).json({ message: "id_usuario es obligatorio" });
        if (!id_categoria_repartidor) return res.status(400).json({ message: "id_categoria_repartidor es obligatorio" });

        const estadoRepartidor = id_estado_repartidor || 5;
        const [estados] = await conmysql.query(`
            SELECT id_estado_repartidor FROM estados_repartidor
            WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1`, [estadoRepartidor]);

        if (!estados.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });

        const [result] = await conmysql.query(`
            INSERT INTO repartidores (
                id_usuario, id_categoria_repartidor, id_estado_repartidor, repartidor_codigo, repartidor_placa,
                repartidor_tipo_vehiculo, repartidor_calificacion, repartidor_puntos, repartidor_posicion_ranking,
                repartidor_total_pedidos, repartidor_pedidos_aceptados, repartidor_pedidos_rechazados,
                repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion, repartidor_horas_conectado,
                repartidor_limite_billetera, repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id_usuario, id_categoria_repartidor, estadoRepartidor, repartidor_codigo || null, repartidor_placa || null,
                repartidor_tipo_vehiculo || null, repartidor_calificacion ?? 5.00, repartidor_puntos ?? 0,
                repartidor_posicion_ranking ?? null, repartidor_total_pedidos ?? 0, repartidor_pedidos_aceptados ?? 0,
                repartidor_pedidos_rechazados ?? 0, repartidor_pedidos_no_entregados ?? 0,
                repartidor_porcentaje_aceptacion ?? 100.00, repartidor_horas_conectado ?? 0,
                repartidor_limite_billetera ?? 25.00, repartidor_confianza ?? 0, repartidor_permite_telefono ?? 0,
                repartidor_fecha_ingreso || new Date()
            ]);

        const [repartidor] = await conmysql.query(`${selectRepartidor} WHERE r.id_repartidor = ?`, [result.insertId]);
        return res.status(201).json({ message: "Repartidor registrado con éxito", repartidor: repartidor[0] });
    } catch (error) {
        console.error("Error postRepartidores:", error);
        return res.status(500).json({ message: "Error al registrar repartidor", error: error.message });
    }
};

// Cambiar únicamente el estado del repartidor.
export const cambiarEstadoRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_estado_repartidor } = req.body;
        if (!id_estado_repartidor) return res.status(400).json({ message: "id_estado_repartidor es obligatorio" });

        const [estado] = await conmysql.query(`
            SELECT id_estado_repartidor, estado_repartidor_nombre
            FROM estados_repartidor
            WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1`, [id_estado_repartidor]);
        if (!estado.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });

        const [repartidor] = await conmysql.query(
            "SELECT id_repartidor FROM repartidores WHERE id_repartidor = ?", [id]
        );
        if (!repartidor.length) return res.status(404).json({ message: "Repartidor no encontrado" });

        await conmysql.query(
            "UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?",
            [id_estado_repartidor, id]
        );

        const [resultado] = await conmysql.query(`${selectRepartidor} WHERE r.id_repartidor = ?`, [id]);
        return res.json({ message: "Estado del repartidor actualizado correctamente", repartidor: resultado[0] });
    } catch (error) {
        console.error("Error cambiarEstadoRepartidor:", error);
        return res.status(500).json({ message: "Error al cambiar estado del repartidor", error: error.message });
    }
};

// Actualizar todos los campos del repartidor.
export const putRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_usuario", "id_categoria_repartidor", "id_estado_repartidor", "repartidor_codigo", "repartidor_placa",
            "repartidor_tipo_vehiculo", "repartidor_calificacion", "repartidor_puntos", "repartidor_posicion_ranking",
            "repartidor_total_pedidos", "repartidor_pedidos_aceptados", "repartidor_pedidos_rechazados",
            "repartidor_pedidos_no_entregados", "repartidor_porcentaje_aceptacion", "repartidor_horas_conectado",
            "repartidor_limite_billetera", "repartidor_confianza", "repartidor_permite_telefono", "repartidor_fecha_ingreso"
        ];

        if (!req.body.id_usuario) return res.status(400).json({ message: "id_usuario es obligatorio" });
        if (!req.body.id_categoria_repartidor) return res.status(400).json({ message: "id_categoria_repartidor es obligatorio" });
        if (!req.body.id_estado_repartidor) return res.status(400).json({ message: "id_estado_repartidor es obligatorio" });

        const [estado] = await conmysql.query(`
            SELECT id_estado_repartidor FROM estados_repartidor
            WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1`, [req.body.id_estado_repartidor]);
        if (!estado.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });

        const valores = camposPermitidos.map(campo => req.body[campo]);
        valores.push(id);

        const [result] = await conmysql.query(`
            UPDATE repartidores SET ${camposPermitidos.map(campo => `${campo} = ?`).join(", ")}
            WHERE id_repartidor = ?`, valores);

        if (!result.affectedRows) return res.status(404).json({ message: "Repartidor no encontrado" });

        const [rows] = await conmysql.query(`${selectRepartidor} WHERE r.id_repartidor = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

// Actualización parcial de campos permitidos.
export const patchRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_usuario", "id_categoria_repartidor", "id_estado_repartidor", "repartidor_codigo", "repartidor_placa",
            "repartidor_tipo_vehiculo", "repartidor_calificacion", "repartidor_puntos", "repartidor_posicion_ranking",
            "repartidor_total_pedidos", "repartidor_pedidos_aceptados", "repartidor_pedidos_rechazados",
            "repartidor_pedidos_no_entregados", "repartidor_porcentaje_aceptacion", "repartidor_horas_conectado",
            "repartidor_limite_billetera", "repartidor_confianza", "repartidor_permite_telefono", "repartidor_fecha_ingreso"
        ];

        const campos = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (!campos.length) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });

        // Validar el nuevo estado cuando corresponda.
        if (req.body.id_estado_repartidor !== undefined) {
            const [estado] = await conmysql.query(`
                SELECT id_estado_repartidor FROM estados_repartidor
                WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1`, [req.body.id_estado_repartidor]);
            if (!estado.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });
        }

        valores.push(id);
        const [result] = await conmysql.query(
            `UPDATE repartidores SET ${campos.join(", ")} WHERE id_repartidor = ?`, valores
        );

        if (!result.affectedRows) return res.status(404).json({ message: "Repartidor no encontrado" });

        const [rows] = await conmysql.query(`${selectRepartidor} WHERE r.id_repartidor = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

// Eliminar repartidor.
export const deleteRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query("DELETE FROM repartidores WHERE id_repartidor = ?", [id]);
        if (!result.affectedRows) return res.status(404).json({ message: "Repartidor no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteRepartidores:", error);
        return res.status(500).json({ message: "Error al eliminar repartidor", error: error.message });
    }
};
 */

import { conmysql } from "../db.js";

// Campos de usuario.
const usuarioSelect = `
    u.usuario_nombre, u.usuario_apellido, u.usuario_nombre_completo,
    u.usuario_telefono, u.usuario_email, u.usuario_foto`;

// Campos de estado.
const estadoSelect = `
    er.estado_repartidor_nombre, er.estado_repartidor_descripcion,
    er.estado_repartidor_visible_front, er.estado_repartidor_permite_pedidos,
    er.estado_repartidor_permite_seleccion`;

// SELECT base del repartidor.
const selectRepartidor = `
    SELECT r.*, ${usuarioSelect}, ${estadoSelect}
    FROM repartidores r
    INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
    LEFT JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor`;

// Campos permitidos para PUT/PATCH.
const camposPermitidos = [
    "id_usuario", "id_categoria_repartidor", "id_estado_repartidor",
    "repartidor_codigo", "repartidor_placa", "repartidor_tipo_vehiculo",
    "repartidor_calificacion", "repartidor_puntos", "repartidor_posicion_ranking",
    "repartidor_total_pedidos", "repartidor_pedidos_aceptados",
    "repartidor_pedidos_rechazados", "repartidor_pedidos_no_entregados",
    "repartidor_porcentaje_aceptacion", "repartidor_horas_conectado",
    "repartidor_limite_billetera", "repartidor_confianza",
    "repartidor_permite_telefono", "repartidor_fecha_ingreso"
];

// Obtener todos los repartidores.
export const getRepartidores = async (req, res) => {
    try {
        const [result] = await conmysql.query(`
            ${selectRepartidor}
            ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999
            ELSE r.repartidor_posicion_ranking END ASC,
            r.repartidor_total_pedidos ASC, r.repartidor_calificacion DESC
        `);
        return res.json(result);
    } catch (error) {
        console.error("Error getRepartidores:", error);
        return res.status(500).json({ message: "Error al consultar repartidores", error: error.message });
    }
};

// Obtener el repartidor del usuario autenticado.
export const getMiRepartidor = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id_usuario;
    if (!idUsuario) return res.status(401).json({ message: "No se pudo identificar al usuario autenticado" });

    const [result] = await conmysql.query(`${selectRepartidor} WHERE r.id_usuario = ?`, [idUsuario]);
    if (!result.length) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });

    return res.json(result[0]);
  } catch (error) {
    console.error("Error getMiRepartidor:", error);
    return res.status(500).json({ message: "Error al consultar los datos del repartidor", error: error.message });
  }
};

// Obtener repartidor por ID.
export const getRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`${selectRepartidor} WHERE r.id_repartidor = ?`, [id]);

        if (!result.length) return res.status(404).json({ id_repartidor: 0, message: "Repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener repartidor por usuario.
export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`${selectRepartidor} WHERE r.id_usuario = ?`, [id_usuario]);

        if (!result.length) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Buscar repartidor por código.
export const getRepartidorPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`${selectRepartidor} WHERE r.repartidor_codigo = ?`, [codigo]);

        if (!result.length) return res.status(404).json({ message: "Repartidor no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener el primer repartidor disponible.
export const getRepartidorDisponible = async (req, res) => {
    try {
/*         const [result] = await conmysql.query(`
            SELECT r.*, ${usuarioSelect}, ${estadoSelect}
            FROM repartidores r
            INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
            INNER JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor
            WHERE r.id_estado_repartidor IN (1, 2)
            AND er.estado_repartidor_estado = 1
            AND er.estado_repartidor_permite_pedidos = 1
            ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999
            ELSE r.repartidor_posicion_ranking END ASC,
            r.repartidor_total_pedidos ASC, r.repartidor_calificacion DESC
            LIMIT 1
        `); */
        const [result] = await conmysql.query(`
          SELECT r.*, ${usuarioSelect}, ${estadoSelect}
          FROM repartidores r
          INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
          INNER JOIN estados_repartidor er ON r.id_estado_repartidor = er.id_estado_repartidor
          WHERE r.id_estado_repartidor IN (1, 2)          -- LISTO, REPARTIENDO
            AND er.estado_repartidor_estado = 1
            AND er.estado_repartidor_permite_pedidos = 1
            AND EXISTS (
              -- Horario/reserva activa en este momento (día + hora)
              SELECT 1
              FROM horarios_repartidor hr
              -- o desde la tabla de reservas si usáis otra
              WHERE hr.id_repartidor = r.id_repartidor
                AND hr.horario_repartidor_estado = 1
                AND hr.horario_repartidor_dia = WEEKDAY(CURDATE()) + 1  -- ajustar mapeo día
                AND CURTIME() BETWEEN hr.horario_repartidor_hora_inicio
                                  AND hr.horario_repartidor_hora_fin
            )
          ORDER BY CASE WHEN r.repartidor_posicion_ranking IS NULL THEN 999999
                   ELSE r.repartidor_posicion_ranking END ASC,
                   r.repartidor_total_pedidos ASC, r.repartidor_calificacion DESC
          LIMIT 1
        `);

        if (!result.length) return res.status(404).json({ message: "No hay repartidores disponibles" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorDisponible:", error);
        return res.status(500).json({ message: "Error al buscar repartidor disponible", error: error.message });
    }
};

// Crear repartidor.
export const postRepartidores = async (req, res) => {
    try {
        const {
            id_usuario, id_categoria_repartidor, id_estado_repartidor, repartidor_codigo,
            repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion,
            repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos,
            repartidor_pedidos_aceptados, repartidor_pedidos_rechazados,
            repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion,
            repartidor_horas_conectado, repartidor_limite_billetera,
            repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso
        } = req.body;

        if (!id_usuario) return res.status(400).json({ message: "id_usuario es obligatorio" });
        if (!id_categoria_repartidor) return res.status(400).json({ message: "id_categoria_repartidor es obligatorio" });

        const estadoRepartidor = id_estado_repartidor || 5;
        const [estados] = await conmysql.query(`
            SELECT id_estado_repartidor
            FROM estados_repartidor
            WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1
        `, [estadoRepartidor]);

        if (!estados.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });

        const [result] = await conmysql.query(`
            INSERT INTO repartidores (
                id_usuario, id_categoria_repartidor, id_estado_repartidor, repartidor_codigo,
                repartidor_placa, repartidor_tipo_vehiculo, repartidor_calificacion,
                repartidor_puntos, repartidor_posicion_ranking, repartidor_total_pedidos,
                repartidor_pedidos_aceptados, repartidor_pedidos_rechazados,
                repartidor_pedidos_no_entregados, repartidor_porcentaje_aceptacion,
                repartidor_horas_conectado, repartidor_limite_billetera,
                repartidor_confianza, repartidor_permite_telefono, repartidor_fecha_ingreso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_usuario, id_categoria_repartidor, estadoRepartidor, repartidor_codigo || null,
            repartidor_placa || null, repartidor_tipo_vehiculo || null,
            repartidor_calificacion ?? 5.00, repartidor_puntos ?? 0,
            repartidor_posicion_ranking ?? null, repartidor_total_pedidos ?? 0,
            repartidor_pedidos_aceptados ?? 0, repartidor_pedidos_rechazados ?? 0,
            repartidor_pedidos_no_entregados ?? 0, repartidor_porcentaje_aceptacion ?? 100.00,
            repartidor_horas_conectado ?? 0, repartidor_limite_billetera ?? 25.00,
            repartidor_confianza ?? 0, repartidor_permite_telefono ?? 0,
            repartidor_fecha_ingreso || new Date()
        ]);

        const [repartidor] = await conmysql.query(
            `${selectRepartidor} WHERE r.id_repartidor = ?`, [result.insertId]
        );

        return res.status(201).json({
            message: "Repartidor registrado con éxito",
            repartidor: repartidor[0]
        });
    } catch (error) {
        console.error("Error postRepartidores:", error);
        return res.status(500).json({ message: "Error al registrar repartidor", error: error.message });
    }
};

// Cambiar únicamente el estado.
export const cambiarEstadoRepartidor = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_estado_repartidor } = req.body;
    const nuevoEstado = Number(id_estado_repartidor);

    if (![2, 4].includes(nuevoEstado)) {
      return res.status(400).json({
        message: "Solo puedes cambiar entre REPARTIENDO (2) y EN_PAUSA (4)."
      });
    }

    // Validar que el repartidor existe y obtener estado actual
    const [rep] = await conmysql.query(
      `SELECT id_repartidor, id_estado_repartidor FROM repartidores WHERE id_repartidor = ?`,
      [id]
    );
    if (!rep.length) return res.status(404).json({ message: "Repartidor no encontrado" });

    const estadoActual = Number(rep[0].id_estado_repartidor);

    // No se puede cambiar si está EN_PEDIDO, DESCONECTADO o INHABILITADO
    if ([3, 5, 6].includes(estadoActual)) {
      return res.status(403).json({
        message: "No puedes cambiar el estado en este momento. Debes estar en un turno activo (REPARTIENDO o EN_PAUSA)."
      });
    }

    // Debe estar dentro de un horario/reserva activa
    const dentroDeTurno = await estaDentroDeTurnoActivo(id); // implementa con tu tabla de reservas
    if (!dentroDeTurno) {
      return res.status(403).json({
        message: "Solo puedes cambiar entre REPARTIENDO y EN_PAUSA mientras estés dentro de un horario reservado."
      });
    }

    // Validar estado destino activo
    const [estado] = await conmysql.query(`
      SELECT id_estado_repartidor, estado_repartidor_nombre
      FROM estados_repartidor
      WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1
    `, [nuevoEstado]);
    if (!estado.length) {
      return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });
    }

    await conmysql.query(
      `UPDATE repartidores SET id_estado_repartidor = ? WHERE id_repartidor = ?`,
      [nuevoEstado, id]
    );

    const [resultado] = await conmysql.query(
      `${selectRepartidor} WHERE r.id_repartidor = ?`, [id]
    );
    return res.json({
      message: "Estado del repartidor actualizado correctamente",
      repartidor: resultado[0]
    });
  } catch (error) {
    console.error("Error cambiarEstadoRepartidor:", error);
    return res.status(500).json({ message: "Error al cambiar estado del repartidor", error: error.message });
  }
};

// Actualizar todos los campos.
export const putRepartidores = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.body.id_usuario) return res.status(400).json({ message: "id_usuario es obligatorio" });
        if (!req.body.id_categoria_repartidor) return res.status(400).json({ message: "id_categoria_repartidor es obligatorio" });
        if (!req.body.id_estado_repartidor) return res.status(400).json({ message: "id_estado_repartidor es obligatorio" });

        const [estado] = await conmysql.query(`
            SELECT id_estado_repartidor
            FROM estados_repartidor
            WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1
        `, [req.body.id_estado_repartidor]);

        if (!estado.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });

        const valores = camposPermitidos.map(campo => req.body[campo]);
        valores.push(id);

        const [result] = await conmysql.query(`
            UPDATE repartidores
            SET ${camposPermitidos.map(campo => `${campo} = ?`).join(", ")}
            WHERE id_repartidor = ?
        `, valores);

        if (!result.affectedRows) return res.status(404).json({ message: "Repartidor no encontrado" });

        const [rows] = await conmysql.query(
            `${selectRepartidor} WHERE r.id_repartidor = ?`, [id]
        );

        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

// Actualización parcial.
export const patchRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const campos = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (!campos.length) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });

        if (req.body.id_estado_repartidor !== undefined) {
            const [estado] = await conmysql.query(`
                SELECT id_estado_repartidor
                FROM estados_repartidor
                WHERE id_estado_repartidor = ? AND estado_repartidor_estado = 1
            `, [req.body.id_estado_repartidor]);

            if (!estado.length) return res.status(400).json({ message: "El estado del repartidor no existe o está inactivo" });
        }

        valores.push(id);

        const [result] = await conmysql.query(
            `UPDATE repartidores SET ${campos.join(", ")} WHERE id_repartidor = ?`,
            valores
        );

        if (!result.affectedRows) return res.status(404).json({ message: "Repartidor no encontrado" });

        const [rows] = await conmysql.query(
            `${selectRepartidor} WHERE r.id_repartidor = ?`, [id]
        );

        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchRepartidores:", error);
        return res.status(500).json({ message: "Error al actualizar repartidor", error: error.message });
    }
};

// Eliminar repartidor.
export const deleteRepartidores = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            `DELETE FROM repartidores WHERE id_repartidor = ?`, [id]
        );

        if (!result.affectedRows) return res.status(404).json({ message: "Repartidor no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteRepartidores:", error);
        return res.status(500).json({ message: "Error al eliminar repartidor", error: error.message });
    }
};
