import bcrypt from "bcrypt";
import { conmysql } from "../db.js";

// Campos públicos del usuario.
const camposUsuario = `
    id_usuario, usuario_codigo, id_provincia, id_canton, usuario_cedula,
    usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email,
    usuario_telefono, usuario_foto, usuario_fecha_nacimiento, usuario_latitud,
    usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro,
    usuario_fecha_actualizacion
`;

// GET: Obtener todos los usuarios.
export const getUsuarios = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios ORDER BY usuario_cedula ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getUsuarios:", error);
        return res.status(500).json({ message: "Error al consultar usuarios", error: error.message });
    }
};

// GET: Obtener usuario por ID.
export const getUsuarioxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener usuario por cédula.
export const getUsuarioPorCedula = async (req, res) => {
    try {
        const { cedula } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_cedula = ?`, [cedula]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCedula:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener usuario por email.
export const getUsuarioPorEmail = async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email).trim().toLowerCase();
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_email = ?`, [email]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorEmail:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// GET: Obtener usuario por código.
export const getUsuarioPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_codigo = ?`, [codigo]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
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
        if (!result.length) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// POST: Crear usuario.
export const postUsuarios = async (req, res) => {
    try {
        const { usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_referencia } = req.body;

        // Validar campos obligatorios.
        if (!usuario_nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio" });
        if (!usuario_apellido?.trim()) return res.status(400).json({ message: "El apellido es obligatorio" });
        if (!usuario_email?.trim()) return res.status(400).json({ message: "El correo electrónico es obligatorio" });
        if (!usuario_telefono?.trim()) return res.status(400).json({ message: "El teléfono es obligatorio" });
        if (!usuario_password) return res.status(400).json({ message: "La contraseña es obligatoria" });
        if (usuario_password.length < 6) return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });

        // Normalizar y validar datos.
        const nombre = usuario_nombre.trim(), apellido = usuario_apellido.trim();
        const email = usuario_email.trim().toLowerCase(), telefono = usuario_telefono.trim();
        const nombreCompleto = usuario_nombre_completo?.trim() || `${nombre} ${apellido}`;
        const referencia = usuario_referencia?.trim() || null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "El correo electrónico no es válido" });

        // Verificar email y crear contraseña.
        const [existente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]);
        if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        const passwordHash = await bcrypt.hash(usuario_password, 10);

        // Insertar usuario.
        const [result] = await conmysql.query(
            `INSERT INTO usuarios (usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_referencia, usuario_fecha_registro, usuario_fecha_actualizacion)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [nombre, apellido, nombreCompleto, email, telefono, passwordHash, referencia]
        );

        // Devolver usuario sin contraseña.
        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [result.insertId]);
        return res.status(201).json({ success: true, message: "Usuario registrado con éxito", usuario: rows[0] });
    } catch (error) {
        console.error("Error postUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        return res.status(500).json({ message: "Error al registrar usuario", error: error.message });
    }
};

// PUT: Actualizar completamente un usuario.
export const putUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado } = req.body;

        // Comprobar existencia y preparar contraseña/email.
        const [usuario] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!usuario.length) return res.status(404).json({ message: "Usuario no encontrado" });
        const passwordFinal = usuario_password ? await bcrypt.hash(usuario_password, 10) : usuario_password;
        const email = usuario_email?.trim().toLowerCase();

        // Actualizar usuario.
        const valores = [usuario_codigo ?? null, id_provincia ?? null, id_canton ?? null, usuario_cedula ?? null, usuario_nombre ?? null, usuario_apellido ?? null, usuario_nombre_completo ?? null, email ?? null, usuario_telefono ?? null, passwordFinal ?? null, usuario_foto ?? null, usuario_fecha_nacimiento ?? null, usuario_latitud ?? null, usuario_longitud ?? null, usuario_referencia ?? null, id_estado ?? null, id];
        const [result] = await conmysql.query(
            `UPDATE usuarios SET usuario_codigo=?, id_provincia=?, id_canton=?, usuario_cedula=?, usuario_nombre=?, usuario_apellido=?, usuario_nombre_completo=?, usuario_email=?, usuario_telefono=?, usuario_password=?, usuario_foto=?, usuario_fecha_nacimiento=?, usuario_latitud=?, usuario_longitud=?, usuario_referencia=?, id_estado=?, usuario_fecha_actualizacion=NOW() WHERE id_usuario=?`,
            valores
        );
        if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });

        // Devolver usuario actualizado.
        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error putUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "El correo electrónico o dato único ya está registrado" });
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// PATCH: Actualización parcial de campos permitidos.
export const patchUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["usuario_nombre", "usuario_apellido", "usuario_nombre_completo", "usuario_email", "usuario_telefono", "usuario_foto", "usuario_latitud", "usuario_longitud", "usuario_referencia"];
        const campos = [], valores = [];

        // Construir dinámicamente el UPDATE.
        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                let valor = req.body[campo];
                if (typeof valor === "string") valor = valor.trim();
                if (campo === "usuario_email") valor = valor.toLowerCase();
                campos.push(`${campo} = ?`);
                valores.push(valor);
            }
        }

        if (!campos.length) return res.status(400).json({ message: "No se proporcionaron campos válidos para actualizar" });

        // Verificar email duplicado.
        if (req.body.usuario_email !== undefined) {
            const email = req.body.usuario_email.trim().toLowerCase();
            const [existente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? AND id_usuario <> ? LIMIT 1`, [email, id]);
            if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        }

        // Ejecutar actualización.
        campos.push("usuario_fecha_actualizacion = NOW()");
        valores.push(id);
        const [result] = await conmysql.query(`UPDATE usuarios SET ${campos.join(", ")} WHERE id_usuario = ?`, valores);
        if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });

        // Devolver usuario actualizado.
        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error patchUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// DELETE: Eliminar usuario.
export const deleteUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteUsuarios:", error);
        return res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
    }
};
