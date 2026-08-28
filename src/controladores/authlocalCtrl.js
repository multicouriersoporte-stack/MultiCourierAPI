// src/controladores/authlocalCtrl.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { conmysql } from "../db.js";
import { config } from "dotenv";

config();

// POST: LOGIN LOCAL
export const login = async (req, res) => {
    try {
        const { usuario_email, usuario_password } = req.body;

        // Validar datos
        if (!usuario_email || !usuario_password) {
            return res.status(400).json({ success: false, message: "El correo y la contraseña son obligatorios." });
        }

        const email = String(usuario_email).trim().toLowerCase();
        const password = String(usuario_password);

        // Buscar usuario
        const [usuarios] = await conmysql.query(
            `SELECT * FROM usuarios WHERE LOWER(TRIM(usuario_email)) = ? LIMIT 1`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ success: false, message: "El correo o la contraseña son incorrectos." });
        }

        const usuario = usuarios[0];

        // Verificar estado y contraseña
        if (Number(usuario.id_estado) !== 1) {
            return res.status(403).json({ success: false, message: "Tu cuenta no está activa." });
        }

        if (!await bcrypt.compare(password, String(usuario.usuario_password))) {
            return res.status(401).json({ success: false, message: "El correo o la contraseña son incorrectos." });
        }

        // Obtener roles activos
        const [rolesResult] = await conmysql.query(
            `SELECT ur.id_rol, r.rol_nombre, r.rol_descripcion
             FROM usuario_roles ur
             INNER JOIN roles r ON r.id_rol = ur.id_rol
             WHERE ur.id_usuario = ? AND ur.usuario_rol_estado = 1 AND r.rol_estado = 1
             ORDER BY ur.id_rol ASC`,
            [usuario.id_usuario]
        );

        if (rolesResult.length === 0) {
            return res.status(403).json({ success: false, message: "El usuario no tiene un rol activo asignado." });
        }

        // Solo permitir rol LOCAL (id_rol = 3)
        const rolLocal = rolesResult.find(rol => Number(rol.id_rol) === 3);

        if (!rolLocal) {
            return res.status(403).json({ success: false, message: "Este acceso es exclusivo para usuarios LOCAL." });
        }

        // Normalizar roles
        const roles = rolesResult.map(rol => ({
            id_rol: Number(rol.id_rol),
            rol_nombre: Number(rol.id_rol) === 3 ? "LOCAL" : String(rol.rol_nombre).trim().toUpperCase(),
            rol_descripcion: rol.rol_descripcion
        }));

        // Preparar usuario público
        const usuarioRespuesta = {
            ...usuario,
            id_rol: 3,
            usuario_rol: "LOCAL",
            roles
        };

        delete usuarioRespuesta.usuario_password;

        // Validar configuración JWT
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET no está configurado.");
            return res.status(500).json({ success: false, message: "Error de configuración del servidor." });
        }

        // Datos del token
        const usuarioToken = {
            id_usuario: usuarioRespuesta.id_usuario,
            usuario_codigo: usuarioRespuesta.usuario_codigo,
            usuario_nombre: usuarioRespuesta.usuario_nombre,
            usuario_apellido: usuarioRespuesta.usuario_apellido,
            usuario_email: usuarioRespuesta.usuario_email,
            id_rol: 3,
            usuario_rol: "LOCAL",
            roles: roles.map(rol => rol.rol_nombre)
        };

        // Generar JWT
        const token = jwt.sign({ usuario: usuarioToken }, process.env.JWT_SECRET, { expiresIn: "7d" });

        console.log(`✅ Login LOCAL: ${usuario.usuario_email} | id_rol: 3`);

        return res.status(200).json({
            success: true,
            message: "Inicio de sesión LOCAL exitoso.",
            usuario: usuarioRespuesta,
            token
        });
    } catch (error) {
        console.error("❌ Error login LOCAL:", error);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor.",
            error: error.message
        });
    }
};
