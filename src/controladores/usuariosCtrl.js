import { conmysql } from "../db.js";

// GET: Obtener todos los usuarios.
export const getUsuarios = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT * FROM usuarios ORDER BY usuario_cedula ASC`);
        res.json(result);
    } catch (error) {
        console.error("Error getUsuarios:", error);
        return res.status(500).json({ message: "Error al consultar usuarios", error: error.message });
    }
};

// GET: Obtener usuario por ID.
export const getUsuarioxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM usuarios WHERE id_usuario = ?`, [id]);
        if (result.length === 0) return res.status(404).json({ id_usuario: 0, message: "Usuario no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener usuario por cédula.
export const getUsuarioPorCedula = async (req, res) => {
    try {
        const { cedula } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM usuarios WHERE usuario_cedula = ?`, [cedula]);
        if (result.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCedula:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener usuario por email.
export const getUsuarioPorEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM usuarios WHERE usuario_email = ?`, [email]);
        if (result.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorEmail:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener usuario por código.
export const getUsuarioPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM usuarios WHERE usuario_codigo = ?`, [codigo]);
        if (result.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener repartidor asociado al usuario.
export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM repartidores WHERE id_usuario = ?`, [id_usuario]);
        if (result.length === 0) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// POST: Crear usuario.
export const postUsuarios = async (req, res) => {
    try {
        const { usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro, usuario_fecha_actualizacion } = req.body;
        const [result] = await conmysql.query(`INSERT INTO usuarios (usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro, usuario_fecha_actualizacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro, usuario_fecha_actualizacion]);
        res.status(201).json({ id_usuario: result.insertId, message: "Usuario registrado con éxito" });
    } catch (error) {
        console.error("Error postUsuarios:", error);
        return res.status(500).json({ message: "Error al registrar usuario", error: error.message });
    }
};

// PUT: Actualizar completamente un usuario.
export const putUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro, usuario_fecha_actualizacion } = req.body;
        const valores = [usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro, usuario_fecha_actualizacion, id];
        const [result] = await conmysql.query(`UPDATE usuarios SET usuario_codigo = ?, id_provincia = ?, id_canton = ?, usuario_cedula = ?, usuario_nombre = ?, usuario_apellido = ?, usuario_nombre_completo = ?, usuario_email = ?, usuario_telefono = ?, usuario_password = ?, usuario_foto = ?, usuario_fecha_nacimiento = ?, usuario_latitud = ?, usuario_longitud = ?, usuario_referencia = ?, id_estado = ?, usuario_fecha_registro = ?, usuario_fecha_actualizacion = ? WHERE id_usuario = ?`, valores);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        const [rows] = await conmysql.query(`SELECT * FROM usuarios WHERE id_usuario = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error putUsuarios:", error);
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// PATCH: Actualización parcial de usuario.
export const patchUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["usuario_codigo", "id_provincia", "id_canton", "usuario_cedula", "usuario_nombre", "usuario_apellido", "usuario_nombre_completo", "usuario_email", "usuario_telefono", "usuario_password", "usuario_foto", "usuario_fecha_nacimiento", "usuario_latitud", "usuario_longitud", "usuario_referencia", "id_estado", "usuario_fecha_registro", "usuario_fecha_actualizacion"];
        const campos = [], valores = [];
        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }
        if (campos.length === 0) return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
        valores.push(id);
        const [result] = await conmysql.query(`UPDATE usuarios SET ${campos.join(", ")} WHERE id_usuario = ?`, valores);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        const [rows] = await conmysql.query(`SELECT * FROM usuarios WHERE id_usuario = ?`, [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error patchUsuarios:", error);
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// DELETE: Eliminar usuario.
export const deleteUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM usuarios WHERE id_usuario = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleteUsuarios:", error);
        return res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
    }
};
