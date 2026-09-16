// rolesHelpers.js — Utilidades para leer el/los roles del usuario autenticado.
// Extraído del controlador de pedidos (INFORMACION.txt) para reutilizarlo en todos los módulos.

export const obtenerRol = (req) => {
    const u = req.usuario || {};
    const rol =
        u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.usuario_role ?? u.rol_nombre ?? u.nombre_rol;
    if (String(rol).trim()) return String(rol).trim().toUpperCase();
    const idRol = Number(u.id_rol ?? u.rol_id ?? u.idRol ?? u.usuario_id_rol);
    switch (idRol) {
        case 1: return "CLIENTE";
        case 2: return "REPARTIDOR";
        case 3: return "LOCAL";
        case 4: return "CENTRAL";
        case 5: return "SUPERVISOR";
        case 6: return "SOPORTE";
        case 7: return "ADMINISTRADOR";
        default: return "";
    }
};

export const obtenerRoles = (req) => {
    const u = req.usuario || {};
    return [obtenerRol(req), ...(Array.isArray(u.roles) ? u.roles : [])]
        .filter(Boolean)
        .map((r) => String(r).trim().toUpperCase())
        .filter((r, i, a) => a.indexOf(r) === i);
};

export const tieneRol = (req, rolesPermitidos = []) => {
    const roles = rolesPermitidos.map((r) => String(r).trim().toUpperCase());
    return obtenerRoles(req).some((r) => roles.includes(r));
};

export const obtenerIdUsuario = (req) => {
    const u = req.usuario || {};
    return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};