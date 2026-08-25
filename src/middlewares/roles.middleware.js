// Middleware para permitir acceso según roles
export const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        try {
            // Verificar que exista un usuario autenticado
            if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

            // Obtener y normalizar el rol principal
            const rolPrincipal = String(
                req.usuario.usuario_rol ?? req.usuario.rol_usuario ?? req.usuario.usuarioRol ??
                req.usuario.rol ?? req.usuario.role ?? req.usuario.usuario_role ?? ""
            ).trim().toUpperCase();

            // Obtener y normalizar roles adicionales
            const rolesUsuario = Array.isArray(req.usuario.roles)
                ? req.usuario.roles.map(rol => String(rol).trim().toUpperCase())
                : [];

            // Unificar y eliminar roles duplicados
            const todosLosRoles = [rolPrincipal, ...rolesUsuario].filter(Boolean).filter((rol, index, array) => array.indexOf(rol) === index);

            // Normalizar roles permitidos
            const rolesNormalizados = rolesPermitidos.map(rol => String(rol).trim().toUpperCase());

            // Comprobar si el usuario tiene algún rol autorizado
            const tienePermiso = todosLosRoles.some(rol => rolesNormalizados.includes(rol));

            if (!tienePermiso) {
                console.warn("[Roles] Acceso denegado", {
                    usuario: req.usuario.id_usuario,
                    rolPrincipal,
                    roles: todosLosRoles,
                    permitidos: rolesNormalizados
                });
                return res.status(403).json({ success: false, message: "No tienes permisos para realizar esta acción." });
            }

            return next();
        } catch (error) {
            // Manejar errores del middleware
            console.error("[Roles] Error:", error);
            return res.status(500).json({ success: false, message: "Error al verificar permisos." });
        }
    };
};
