// src/controladores/descuentosCtrl.js

import { conmysql } from "../db.js";
import { CODIGO_RE, calcularEstadoPromo, limiteONull, normalizarCodigo, validarValor, validarVigenciaYLimites } from "../utils/promociones.js";

const CAMPOS = `
    id_descuento AS id, id_local,
    descuento_nombre AS nombre, descuento_codigo AS codigo, descuento_tipo AS tipo, descuento_valor AS valor,
    DATE_FORMAT(descuento_fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
    DATE_FORMAT(descuento_fecha_fin, '%Y-%m-%d') AS fecha_fin,
    descuento_monto_minimo AS monto_minimo, descuento_limite_usos AS limite_usos,
    descuento_usos_actuales AS usos_actuales, descuento_aplica_a AS aplica_a,
    descuento_descripcion AS descripcion, descuento_activo AS activo`;
const SELECT = `SELECT ${CAMPOS} FROM descuentos`;

const TIPOS = ["porcentaje", "fijo", "envio"];
const APLICA_A = ["todos", "categoria", "producto"];

// El código es opcional: vacío = null
const codigoONull = (c) => normalizarCodigo(c) || null;

const validarDescuento = (b, codigo) => {
    const nombre = String(b.nombre ?? "").trim();
    if (!nombre) return "Ingresa un nombre para el descuento";
    if (nombre.length > 60) return "El nombre no puede superar 60 caracteres";
    if (codigo && !CODIGO_RE.test(codigo)) return "El código debe tener de 3 a 30 caracteres (letras, números, - o _)";
    if (!TIPOS.includes(b.tipo)) return "Tipo de descuento inválido";
    if (!APLICA_A.includes(b.aplica_a)) return "El campo 'aplica a' es inválido";
    if (b.tipo !== "envio") {
        const errorValor = validarValor(b.tipo, b.valor);
        if (errorValor) return errorValor;
    }
    return validarVigenciaYLimites(b);
};

const valoresDescuento = (b, codigo) => [
    String(b.nombre).trim(), codigo, b.tipo, b.tipo === "envio" ? 0 : Number(b.valor),
    b.fecha_inicio, b.fecha_fin, Number(b.monto_minimo ?? 0), limiteONull(b.limite_usos),
    b.aplica_a, String(b.descripcion ?? "").trim() || null
];

// GET: descuentos de un local
export const getDescuentosPorLocal = async (req, res) => {
    try {
        const [rows] = await conmysql.query(`${SELECT} WHERE id_local = ? ORDER BY id_descuento DESC`, [req.params.id_local]);
        return res.json(rows.map(calcularEstadoPromo));
    } catch (error) {
        console.error("Error getDescuentosPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar descuentos", error: error.message });
    }
};

// GET: un descuento
export const getDescuentoxid = async (req, res) => {
    try {
        const [rows] = await conmysql.query(`${SELECT} WHERE id_descuento = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Descuento no encontrado" });
        return res.json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        console.error("Error getDescuentoxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: historial de descuentos aplicados en el local
export const getAplicadosPorLocal = async (req, res) => {
    try {
        const [rows] = await conmysql.query(
            `SELECT a.id_aplicado AS id, d.descuento_nombre AS nombre, d.descuento_codigo AS codigo,
                    a.aplicado_cliente AS cliente, a.aplicado_pedido_codigo AS pedido_codigo,
                    a.aplicado_fecha AS fecha_aplicacion, a.aplicado_monto AS descuento_aplicado
             FROM descuentos_aplicados a INNER JOIN descuentos d ON d.id_descuento = a.id_descuento
             WHERE d.id_local = ? ORDER BY a.aplicado_fecha DESC`, [req.params.id_local]);
        return res.json(rows.map(r => ({ ...r, descuento_aplicado: Number(r.descuento_aplicado) })));
    } catch (error) {
        console.error("Error getAplicadosPorLocal:", error);
        return res.status(500).json({ message: "Error al consultar el historial", error: error.message });
    }
};

// POST: crear descuento
export const postDescuentos = async (req, res) => {
    try {
        const b = req.body, codigo = codigoONull(b.codigo);
        if (!Number(b.id_local)) return res.status(400).json({ message: "Debe indicar el local" });

        const error = validarDescuento(b, codigo);
        if (error) return res.status(400).json({ message: error });

        const [result] = await conmysql.query(
            `INSERT INTO descuentos (id_local, descuento_nombre, descuento_codigo, descuento_tipo, descuento_valor, descuento_fecha_inicio,
             descuento_fecha_fin, descuento_monto_minimo, descuento_limite_usos, descuento_aplica_a, descuento_descripcion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [Number(b.id_local), ...valoresDescuento(b, codigo)]
        );

        const [rows] = await conmysql.query(`${SELECT} WHERE id_descuento = ?`, [result.insertId]);
        return res.status(201).json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un descuento con ese código en tu local" });
        if (error.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "El local indicado no existe" });
        console.error("Error postDescuentos:", error);
        return res.status(500).json({ message: "Error al crear descuento", error: error.message });
    }
};

// PUT: editar descuento (no toca id_local, usos ni activo)
export const putDescuentos = async (req, res) => {
    try {
        const { id } = req.params, b = req.body, codigo = codigoONull(b.codigo);

        const [actual] = await conmysql.query(`${SELECT} WHERE id_descuento = ?`, [id]);
        if (actual.length === 0) return res.status(404).json({ message: "Descuento no encontrado" });
        const previo = actual[0], usos = Number(previo.usos_actuales);

        const error = validarDescuento(b, codigo);
        if (error) return res.status(400).json({ message: error });
        if (usos > 0 && previo.codigo && codigo !== previo.codigo) return res.status(400).json({ message: "No se puede cambiar el código de un descuento que ya fue usado" });

        const limite = limiteONull(b.limite_usos);
        if (limite !== null && limite < usos) return res.status(400).json({ message: `El límite no puede ser menor a los usos actuales (${usos})` });

        await conmysql.query(
            `UPDATE descuentos SET descuento_nombre = ?, descuento_codigo = ?, descuento_tipo = ?, descuento_valor = ?, descuento_fecha_inicio = ?,
             descuento_fecha_fin = ?, descuento_monto_minimo = ?, descuento_limite_usos = ?, descuento_aplica_a = ?, descuento_descripcion = ?
             WHERE id_descuento = ?`,
            [...valoresDescuento(b, codigo), id]
        );

        const [rows] = await conmysql.query(`${SELECT} WHERE id_descuento = ?`, [id]);
        return res.json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe un descuento con ese código en tu local" });
        console.error("Error putDescuentos:", error);
        return res.status(500).json({ message: "Error al actualizar descuento", error: error.message });
    }
};

// PATCH: activar / desactivar
export const patchDescuentoActivo = async (req, res) => {
    try {
        const { id } = req.params, { activo } = req.body;
        if (![true, false, 0, 1, "0", "1"].includes(activo)) return res.status(400).json({ message: "El campo activo debe ser 0/1 o true/false" });

        const valor = activo === true || Number(activo) === 1 ? 1 : 0;
        const [result] = await conmysql.query("UPDATE descuentos SET descuento_activo = ? WHERE id_descuento = ?", [valor, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Descuento no encontrado" });

        const [rows] = await conmysql.query(`${SELECT} WHERE id_descuento = ?`, [id]);
        return res.json(calcularEstadoPromo(rows[0]));
    } catch (error) {
        console.error("Error patchDescuentoActivo:", error);
        return res.status(500).json({ message: "Error al cambiar el estado del descuento", error: error.message });
    }
};