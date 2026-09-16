import bcrypt from "bcrypt";
import { conmysql } from "../db.js";

// ⚠️ Ajusta este valor al id_rol real de "CLIENTE" en tu tabla de roles.
const ID_ROL_CLIENTE = 2;

const camposUsuario = `
    id_usuario, usuario_codigo, id_provincia, id_canton, usuario_cedula,
    usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email,
    usuario_telefono, usuario_foto, usuario_fecha_nacimiento, usuario_latitud,
    usuario_longitud, usuario_referencia, usuario_billetera, id_estado,
    usuario_fecha_registro, usuario_fecha_actualizacion
`;

// Registro público de un CLIENTE: crea usuario + cliente + rol en una sola transacción.
export const registrarCliente = async (req, res) => {
    const {
        id_provincia, id_canton, usuario_nombre, usuario_apellido, usuario_email,
        usuario_telefono, usuario_password, usuario_referencia,
        usuario_latitud, usuario_longitud
    } = req.body;

    // Validaciones obligatorias.
    if (!id_provincia) return res.status(400).json({ message: "La provincia es obligatoria" });
    if (!id_canton) return res.status(400).json({ message: "El cantón es obligatorio" });
    if (!usuario_nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio" });
    if (!usuario_apellido?.trim()) return res.status(400).json({ message: "El apellido es obligatorio" });
    if (!usuario_email?.trim()) return res.status(400).json({ message: "El correo electrónico es obligatorio" });
    if (!usuario_password) return res.status(400).json({ message: "La contraseña es obligatoria" });
    if (usuario_password.length < 6) return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });

    // Normalizar datos.
    const nombre = usuario_nombre.trim();
    const apellido = usuario_apellido.trim();
    const email = usuario_email.trim().toLowerCase();
    const telefono = usuario_telefono?.trim() || null;
    const referencia = usuario_referencia?.trim() || null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ message: "El correo electrónico no es válido" });

    let conn;
    try {
        conn = await conmysql.getConnection();
        await conn.beginTransaction();

        // Verificar email único dentro de la transacción.
        const [existente] = await conn.query(
            `SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]
        );
        if (existente.length) {
            await conn.rollback();
            return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        }

        // 1. Crear usuario.
        const passwordHash = await bcrypt.hash(usuario_password, 10);
        const [resultUsuario] = await conn.query(`
            INSERT INTO usuarios (
                id_provincia, id_canton, usuario_nombre, usuario_apellido, usuario_email,
                usuario_telefono, usuario_password, usuario_referencia,
                usuario_latitud, usuario_longitud, id_estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_provincia, id_canton, nombre, apellido, email, telefono,
            passwordHash, referencia, usuario_latitud ?? null, usuario_longitud ?? null, 1
        ]);
        const idUsuario = resultUsuario.insertId;

        // 2. Crear registro de cliente asociado (el resto de columnas usa sus DEFAULT).
        await conn.query(`INSERT INTO clientes (id_usuario) VALUES (?)`, [idUsuario]);

        // 3. Asignar el rol CLIENTE.
        await conn.query(
            `INSERT INTO usuario_roles (id_usuario, id_rol) VALUES (?, ?)`,
            [idUsuario, ID_ROL_CLIENTE]
        );

        await conn.commit();

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [idUsuario]);
        return res.status(201).json({ success: true, message: "Cuenta creada con éxito", usuario: rows[0] });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error("Error registrarCliente:", error);
        if (error.code === "ER_DUP_ENTRY")
            return res.status(409).json({ message: "Uno de los datos ya está registrado" });
        return res.status(500).json({ message: "Error al registrar la cuenta", error: error.message });
    } finally {
        if (conn) conn.release();
    }
};