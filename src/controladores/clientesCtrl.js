import { conmysql } from "../db.js";

// GET: Obtener todos los clientes
export const getClientes = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT * FROM clientes ORDER BY id_cliente ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getClientes:", error);
        return res.status(500).json({ message: "Error al consultar clientes", error: error.message });
    }
};

// GET: Obtener cliente por ID
export const getClientexid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM clientes WHERE id_cliente = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_cliente: 0, message: "Cliente no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getClientexid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener cliente por ID de usuario
export const getClientePorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM clientes WHERE id_usuario = ?`, [id_usuario]);
        if (result.length === 0) return res.status(404).json({ message: "No existe un cliente asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getClientePorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener cliente por código
export const getClientePorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM clientes WHERE cliente_codigo = ?`, [codigo]);
        if (result.length === 0) return res.status(404).json({ message: "Cliente no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getClientePorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// POST: Crear cliente
export const postClientes = async (req, res) => {
    try {
        const {
            id_usuario, cliente_codigo, cliente_direccion, cliente_referencia,
            cliente_latitud, cliente_longitud, cliente_calificacion, cliente_total_pedidos,
            cliente_pedidos_entregados, cliente_fecha_registro
        } = req.body;

        const [result] = await conmysql.query(
            `INSERT INTO clientes (id_usuario, cliente_codigo, cliente_direccion, cliente_referencia, cliente_latitud, cliente_longitud, cliente_calificacion, cliente_total_pedidos, cliente_pedidos_entregados, cliente_fecha_registro)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id_usuario, cliente_codigo, cliente_direccion, cliente_referencia, cliente_latitud, cliente_longitud, cliente_calificacion, cliente_total_pedidos, cliente_pedidos_entregados, cliente_fecha_registro]
        );

        return res.status(201).json({ id_cliente: result.insertId, message: "Cliente registrado con éxito" });
    } catch (error) {
        console.error("Error postClientes:", error);
        return res.status(500).json({ message: "Error al registrar cliente", error: error.message });
    }
};

// PUT: Actualizar completamente un cliente
export const putClientes = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_usuario, cliente_codigo, cliente_direccion, cliente_referencia,
            cliente_latitud, cliente_longitud, cliente_calificacion, cliente_total_pedidos,
            cliente_pedidos_entregados, cliente_fecha_registro
        } = req.body;

        const [result] = await conmysql.query(
            `UPDATE clientes SET id_usuario = ?, cliente_codigo = ?, cliente_direccion = ?, cliente_referencia = ?, cliente_latitud = ?, cliente_longitud = ?, cliente_calificacion = ?, cliente_total_pedidos = ?, cliente_pedidos_entregados = ?, cliente_fecha_registro = ? WHERE id_cliente = ?`,
            [id_usuario, cliente_codigo, cliente_direccion, cliente_referencia, cliente_latitud, cliente_longitud, cliente_calificacion, cliente_total_pedidos, cliente_pedidos_entregados, cliente_fecha_registro, id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: "Cliente no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM clientes WHERE id_cliente = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putClientes:", error);
        return res.status(500).json({ message: "Error al actualizar cliente", error: error.message });
    }
};

// PATCH: Actualización parcial de cliente
export const patchClientes = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "id_usuario", "cliente_codigo", "cliente_direccion", "cliente_referencia",
            "cliente_latitud", "cliente_longitud", "cliente_calificacion", "cliente_total_pedidos",
            "cliente_pedidos_entregados", "cliente_fecha_registro"
        ];
        const campos = [], valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });

        valores.push(id);
        const [result] = await conmysql.query(
            `UPDATE clientes SET ${campos.join(", ")} WHERE id_cliente = ?`,
            valores
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: "Cliente no encontrado" });

        const [rows] = await conmysql.query(`SELECT * FROM clientes WHERE id_cliente = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchClientes:", error);
        return res.status(500).json({ message: "Error al actualizar cliente", error: error.message });
    }
};

// DELETE: Eliminar cliente
export const deleteClientes = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM clientes WHERE id_cliente = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Cliente no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteClientes:", error);
        return res.status(500).json({ message: "Error al eliminar cliente", error: error.message });
    }
};
