// src/controladores/authCtrl.js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { conmysql } from "../db.js";
import { config } from "dotenv";

config();

// POST: LOGIN
export const login = async (req, res) => {
    try {
        const { usuario_email, usuario_password } = req.body;

        // Validar datos recibidos
        if (!usuario_email || !usuario_password) {
            return res.status(400).json({
                success: false,
                message: "El correo y la contraseña son obligatorios."
            });
        }

        // Normalizar credenciales
        const email = String(usuario_email).trim().toLowerCase();
        const password = String(usuario_password);

        // Buscar usuario por correo
        const [usuarios] = await conmysql.query(
            `SELECT * FROM usuarios
             WHERE LOWER(TRIM(usuario_email)) = ?
             LIMIT 1`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                success: false,
                message: "El correo o la contraseña son incorrectos."
            });
        }

        const usuario = usuarios[0];

        // Verificar estado de la cuenta
        if (Number(usuario.id_estado) !== 1) {
            return res.status(403).json({
                success: false,
                message: "Tu cuenta no está activa."
            });
        }

        // Verificar contraseña encriptada
        const passwordMatch = await bcrypt.compare(
            password,
            String(usuario.usuario_password)
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "El correo o la contraseña son incorrectos."
            });
        }

        // Obtener roles activos del usuario
        const [rolesResult] = await conmysql.query(
            `SELECT ur.id_rol, r.rol_nombre, r.rol_descripcion
             FROM usuario_roles ur
             INNER JOIN roles r ON r.id_rol = ur.id_rol
             WHERE ur.id_usuario = ?
               AND ur.usuario_rol_estado = 1
               AND r.rol_estado = 1
             ORDER BY ur.id_rol ASC`,
            [usuario.id_usuario]
        );

        if (rolesResult.length === 0) {
            return res.status(403).json({
                success: false,
                message: "El usuario no tiene un rol activo asignado."
            });
        }

        // Normalizar nombres de roles
        const roles = rolesResult.map(rol =>
            String(rol.rol_nombre).trim().toUpperCase()
        );

        // Determinar rol principal según prioridad
        const prioridades = [
            "SOPORTE",
            "SUPERVISOR",
            "CENTRAL",
            "REPARTIDOR",
            "CLIENTE"
        ];
        const rolPrincipal = prioridades.find(rol => roles.includes(rol));

        if (!rolPrincipal) {
            return res.status(403).json({
                success: false,
                message: "El usuario no tiene un rol autorizado para esta aplicación."
            });
        }

        // Obtener ID del rol principal
        const rolPrincipalData = rolesResult.find(rol =>
            String(rol.rol_nombre).trim().toUpperCase() === rolPrincipal
        );

        // Preparar datos públicos del usuario
        const usuarioRespuesta = {
            ...usuario,
            id_rol: rolPrincipalData?.id_rol ?? null,
            usuario_rol: rolPrincipal,
            roles: rolesResult.map(rol => ({
                id_rol: rol.id_rol,
                rol_nombre: String(rol.rol_nombre).trim().toUpperCase(),
                rol_descripcion: rol.rol_descripcion
            }))
        };

        delete usuarioRespuesta.usuario_password;

        // Validar configuración JWT
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET no está configurado.");
            return res.status(500).json({
                success: false,
                message: "Error de configuración del servidor."
            });
        }

        // Crear información incluida en el token
        const usuarioToken = {
            id_usuario: usuarioRespuesta.id_usuario,
            usuario_codigo: usuarioRespuesta.usuario_codigo,
            usuario_nombre: usuarioRespuesta.usuario_nombre,
            usuario_apellido: usuarioRespuesta.usuario_apellido,
            usuario_email: usuarioRespuesta.usuario_email,
            id_rol: usuarioRespuesta.id_rol,
            usuario_rol: usuarioRespuesta.usuario_rol,
            roles
        };

        // Generar JWT con duración de 7 días
        const token = jwt.sign(
            { usuario: usuarioToken },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`✅ Login: ${usuario.usuario_email} | Rol: ${rolPrincipal}`);

        return res.status(200).json({
            success: true,
            message: "Inicio de sesión exitoso.",
            usuario: usuarioRespuesta,
            token
        });
    } catch (error) {
        console.error("❌ Error login:", error);

        return res.status(500).json({
            success: false,
            message: "Error interno del servidor.",
            error: error.message
        });
    }
};
