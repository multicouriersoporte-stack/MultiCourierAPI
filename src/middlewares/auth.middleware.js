import jwt from "jsonwebtoken";
import { config } from "dotenv";

config();

// Middleware para verificar y validar el token JWT
export const verificarToken = (req, res, next) => {
    try {
        // Validar configuración del servidor
        if (!process.env.JWT_SECRET) {
            console.error("❌ JWT_SECRET no configurado.");
            return res.status(500).json({ success: false, message: "Error de configuración del servidor." });
        }

        // Obtener y validar el header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: "Token no proporcionado." });

        const partes = authHeader.trim().split(/\s+/);
        if (partes.length !== 2 || partes[0].toLowerCase() !== "bearer") {
            return res.status(401).json({ success: false, message: "Formato de autorización inválido." });
        }

        const token = partes[1];
        if (!token) return res.status(401).json({ success: false, message: "Token no proporcionado." });

        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Validar los datos del usuario autenticado
        if (!decoded || !decoded.usuario || !decoded.usuario.id_usuario) {
            return res.status(401).json({ success: false, message: "Token inválido." });
        }

        // Guardar usuario autenticado en la petición
        req.usuario = decoded.usuario;
        console.log(`[Auth] Usuario autenticado: ${req.usuario.id_usuario} - ${req.usuario.usuario_rol}`);

        return next();
    } catch (error) {
        console.error("❌ Error verificarToken:", error.message);

        // Manejar errores específicos del JWT
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "El token ha expirado." });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ success: false, message: "Token inválido." });
        }

        return res.status(401).json({ success: false, message: "No se pudo validar el token." });
    }
};
