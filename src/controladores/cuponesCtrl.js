// src/controladores/cuponesCtrl.js

import { conmysql } from "../db.js";
import { CODIGO_RE, calcularEstadoPromo, limiteONull, normalizarCodigo, validarValor, validarVigenciaYLimites } from "../utils/promociones.js";

// Los alias devuelven exactamente los nombres que usa la app Angular.
const CAMPOS = `
    id_cupon AS id, id_local,
    cupon_codigo AS codigo, cupon_tipo AS tipo_descuento, cupon_valor AS valor_descuento,
    DATE_FORMAT(cupon_fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
    DATE_FORMAT(cupon_fecha_fin, '%Y-%m-%d') AS fecha_fin,
    cupon_monto_minimo AS monto_minimo, cupon_limite_usos AS limite_usos,
    cupon_usos_actuales AS usos_actuales, cupon_descripcion AS descripcion, cupon_activo AS activo`;
const SELECT = `SELECT ${CAMPOS} FROM cupones`;

const CAMPOS_CANJE = `
    c.id_canje AS id, cu.cupon_codigo AS codigo, c.canje_cliente AS cliente,
    c.canje_pedido_codigo AS pedido_codigo, c.canje_fecha AS fecha_canje, c.canje_descuento AS descuento_aplicado`;
const aCanje = (r) => ({ ...r, descuento_aplicado: Number(r.descuento_aplicado) });

const validarCupon = (b, codigo) => {
    if (!CODIGO_RE.test(codigo)) return "El código debe tener de 3 a 30 caracteres (letras, números, - o _)";
    if (!["porcentaje", "fijo"].includes(b.tipo_descuento)) return "Tipo de descuento inválido";
    return validarValor(b.tipo_descuento, b.valor_descuento) || validarVigenciaYLimites(b);
};

const valoresCupon = (b, codigo) => [
    codigo, b.tipo_descuento, Number(b.valor_descuento), b.fecha_inicio, b.fecha_fin,
    Number(b.monto_minimo ?? 0), limiteONull(b.limite_usos), String(b.descripcion ?? "").trim() || null
];

// GET: cupones de un local
export const getCuponesPorLocal = async (req, res) => {
    try {
        const [rows] = await conmysql.query(`${SELECT} WHERE id_local = ? ORDER BY id_cupon DESC`, [req.params.id_local]);
        return res.json(rows.map(calcularEstadoPromo));
    } catch (error) {
        console.error("Error getCuponesPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar cupones", error: error.message });
    }
};

// GET: un cupón
export const getCuponxid = async (req, res) => {
    try {
        const [rows] = await conmysql.query(`${SELECT} WHERE id_cupon = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Cupón no encontrado" });
        return res.json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        console.error("Error getCuponxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: canjes de todos los cupones del local
export const getCanjesPorLocal = async (req, res) => {
    try {
        const [rows] = await conmysql.query(
            `SELECT ${CAMPOS_CANJE} FROM cupones_canjes c INNER JOIN cupones cu ON cu.id_cupon = c.id_cupon
             WHERE cu.id_local = ? ORDER BY c.canje_fecha DESC`, [req.params.id_local]);
        return res.json(rows.map(aCanje));
    } catch (error) {
        console.error("Error getCanjesPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar canjes", error: error.message });
    }
};

// GET: canjes de un cupón
export const getCanjesPorCupon = async (req, res) => {
    try {
        const [rows] = await conmysql.query(
            `SELECT ${CAMPOS_CANJE} FROM cupones_canjes c INNER JOIN cupones cu ON cu.id_cupon = c.id_cupon
             WHERE c.id_cupon = ? ORDER BY c.canje_fecha DESC`, [req.params.id]);
        return res.json(rows.map(aCanje));
    } catch (error) {
        console.error("Error getCanjesPorCupon:", error);
        return res.status(500).json({ message: "Error al consultar canjes", error: error.message });
    }
};

// POST: crear cupón
export const postCupones = async (req, res) => {
    try {
        const b = req.body, codigo = normalizarCodigo(b.codigo);
        if (!Number(b.id_local)) return res.status(400).json({ message: "Debe indicar el local" });

        const error = validarCupon(b, codigo);
        if (error) return res.status(400).json({ message: error });

        const [result] = await conmysql.query(
            `INSERT INTO cupones (id_local, cupon_codigo, cupon_tipo, cupon_valor, cupon_fecha_inicio, cupon_fecha_fin, cupon_monto_minimo, cupon_limite_usos, cupon_descripcion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [Number(b.id_local), ...valoresCupon(b, codigo)]
        );

        const [rows] = await conmysql.query(`${SELECT} WHERE id_cupon = ?`, [result.insertId]);
        return res.status(201).json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un cupón con ese código en tu local" });
        if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "El local indicado no existe" });
        console.error("Error postCupones:", error);
        return res.status(500).json({ message: "Error al crear cupón", error: error.message });
    }
};

// PUT: editar cupón (no toca id_local, usos ni activo)
export const putCupones = async (req, res) => {
    try {
        const { id } = req.params, b = req.body, codigo = normalizarCodigo(b.codigo);

        const [actual] = await conmysql.query(`${SELECT} WHERE id_cupon = ?`, [id]);
        if (actual.length === 0) return res.status(404).json({ message: "Cupón no encontrado" });
        const previo = actual[0], usos = Number(previo.usos_actuales);

        const error = validarCupon(b, codigo);
        if (error) return res.status(400).json({ message: error });
        if (usos > 0 && codigo !== previo.codigo) return res.status(400).json({ message: "No se puede cambiar el código de un cupón que ya fue usado" });

        const limite = limiteONull(b.limite_usos);
        if (limite !== null && limite < usos) return res.status(400).json({ message: `El límite no puede ser menor a los usos actuales (${usos})` });

        await conmysql.query(
            `UPDATE cupones SET cupon_codigo = ?, cupon_tipo = ?, cupon_valor = ?, cupon_fecha_inicio = ?, cupon_fecha_fin = ?,
             cupon_monto_minimo = ?, cupon_limite_usos = ?, cupon_descripcion = ? WHERE id_cupon = ?`,
            [...valoresCupon(b, codigo), id]
        );

        const [rows] = await conmysql.query(`${SELECT} WHERE id_cupon = ?`, [id]);
        return res.json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un cupón con ese código en tu local" });
        console.error("Error putCupones:", error);
        return res.status(500).json({ message: "Error al actualizar cupón", error: error.message });
    }
};

// PATCH: activar / desactivar
export const patchCuponActivo = async (req, res) => {
    try {
        const { id } = req.params, { activo } = req.body;
        if (![true, false, 0, 1, "0", "1"].includes(activo)) return res.status(400).json({ message: "El campo activo debe ser 0/1 o true/false" });

        const valor = activo === true || Number(activo) === 1 ? 1 : 0;
        const [result] = await conmysql.query("UPDATE cupones SET cupon_activo = ? WHERE id_cupon = ?", [valor, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Cupón no encontrado" });

        const [rows] = await conmysql.query(`${SELECT} WHERE id_cupon = ?`, [id]);
        return res.json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        console.error("Error patchCuponActivo:", error);
        return res.status(500).json({ message: "Error al cambiar el estado del cupón", error: error.message });
    }
};