// src/controladores/pedidosCtrl.js

import { conmysql } from "../db.js";
import { asignarRepartidorAutomaticamente } from "./pedidorepartidoresCtrl.js";

const ROLES_ADMINISTRATIVOS = ["CENTRAL", "SUPERVISOR", "SOPORTE", "ADMINISTRADOR"];

// ============================================================
// AUTENTICACIÓN Y ROLES
// ============================================================

const obtenerRol = req => {
    const usuario = req.usuario || {};

    const rol =
        usuario.usuario_rol ??
        usuario.rol_usuario ??
        usuario.usuarioRol ??
        usuario.rol ??
        usuario.role ??
        usuario.usuario_role ??
        "";

    return String(rol).trim().toUpperCase();
};

const obtenerRoles = req => {
    const usuario = req.usuario || {};

    const roles = [
        obtenerRol(req),
        ...(Array.isArray(usuario.roles) ? usuario.roles : []),
        ...(Array.isArray(usuario.usuario_roles) ? usuario.usuario_roles : [])
    ];

    return roles
        .filter(Boolean)
        .map(rol => String(rol).trim().toUpperCase())
        .filter((rol, index, array) => array.indexOf(rol) === index);
};

const tieneRol = (req, rolesPermitidos = []) => {
    const rolesUsuario = obtenerRoles(req);

    const roles = rolesPermitidos.map(rol =>
        String(rol).trim().toUpperCase()
    );

    return rolesUsuario.some(rol => roles.includes(rol));
};

const esAdministrativo = req =>
    tieneRol(req, ROLES_ADMINISTRATIVOS);

const obtenerIdUsuario = req => {
    const usuario = req.usuario || {};

    return (
        usuario.id_usuario ??
        usuario.usuario_id ??
        usuario.idUsuario ??
        usuario.id ??
        null
    );
};

// ============================================================
// RELACIONES USUARIO -> ENTIDAD
// ============================================================

const obtenerClienteDelUsuario = async id_usuario => {
    if (!id_usuario) return null;

    const [clientes] = await conmysql.query(
        `
        SELECT id_cliente
        FROM clientes
        WHERE id_usuario = ?
        LIMIT 1
        `,
        [id_usuario]
    );

    return clientes.length ? clientes[0].id_cliente : null;
};

const obtenerLocalDelUsuario = async id_usuario => {
    if (!id_usuario) return null;

    const [locales] = await conmysql.query(
        `
        SELECT id_local
        FROM locales
        WHERE id_usuario = ?
        LIMIT 1
        `,
        [id_usuario]
    );

    return locales.length ? locales[0].id_local : null;
};

const obtenerRepartidorDelUsuario = async id_usuario => {
    if (!id_usuario) return null;

    const [repartidores] = await conmysql.query(
        `
        SELECT id_repartidor
        FROM repartidores
        WHERE id_usuario = ?
        LIMIT 1
        `,
        [id_usuario]
    );

    return repartidores.length
        ? repartidores[0].id_repartidor
        : null;
};

// ============================================================
// VALIDACIONES
// ============================================================

const esIdValido = id =>
    Number.isInteger(Number(id)) && Number(id) > 0;

const generarPedidoPin = () =>
    String(Math.floor(Math.random() * 10000)).padStart(4, "0");

const convertirFechaMySQL = fecha => {
    if (!fecha) return null;

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
        throw new Error("La fecha proporcionada no es válida");
    }

    const pad = numero => String(numero).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds()
    )}`;
};

const obtenerIdEstadoPorNombre = async nombreEstado => {
    const [estados] = await conmysql.query(
        `
        SELECT id_estado
        FROM estados
        WHERE UPPER(TRIM(estado_nombre)) = ?
        LIMIT 1
        `,
        [String(nombreEstado).trim().toUpperCase()]
    );

    return estados.length ? estados[0].id_estado : null;
};

// ============================================================
// SEGURIDAD DEL PIN
// ============================================================

const ocultarPedidoPin = (pedido, req) => {
    if (!pedido) return pedido;

    const copia = { ...pedido };

    // SOLO EL CLIENTE puede recibir el PIN.
    if (!tieneRol(req, ["CLIENTE"])) {
        delete copia.pedido_pin;
    }

    return copia;
};

const ocultarPedidosPin = (pedidos, req) => {
    if (!Array.isArray(pedidos)) return pedidos;

    return pedidos.map(pedido =>
        ocultarPedidoPin(pedido, req)
    );
};

// ============================================================
// ACCESO CLIENTE
// ============================================================

const verificarAccesoCliente = async (req, res, id_cliente) => {
    if (!req.usuario) {
        res.status(401).json({
            success: false,
            message: "Usuario no autenticado."
        });

        return false;
    }

    // Los administrativos pueden consultar cualquier cliente.
    if (esAdministrativo(req)) {
        return true;
    }

    // Un CLIENTE solamente puede acceder a su propio cliente.
    if (tieneRol(req, ["CLIENTE"])) {
        const id_usuario = obtenerIdUsuario(req);

        if (!id_usuario) {
            res.status(401).json({
                success: false,
                message: "No se pudo identificar al usuario autenticado."
            });

            return false;
        }

        const clienteUsuario =
            await obtenerClienteDelUsuario(id_usuario);

        if (!clienteUsuario) {
            res.status(403).json({
                success: false,
                message: "El usuario no tiene un cliente asociado."
            });

            return false;
        }

        if (
            Number(clienteUsuario) !==
            Number(id_cliente)
        ) {
            res.status(403).json({
                success: false,
                message:
                    "No puedes acceder a información de otro cliente."
            });

            return false;
        }

        return true;
    }

    res.status(403).json({
        success: false,
        message:
            "No tienes permisos para acceder a pedidos."
    });

    return false;
};

// ============================================================
// OBTENER PEDIDO POR ID - INTERNO
// ============================================================

const obtenerPedidoPorIdInterno = async id_pedido => {
    const [pedidos] = await conmysql.query(
        `
        SELECT
            p.*,

            c.cliente_codigo,
            c.id_usuario AS cliente_id_usuario,

            u.usuario_cedula AS cliente_cedula,
            u.usuario_nombre AS cliente_nombre,
            u.usuario_apellido AS cliente_apellido,
            u.usuario_nombre_completo AS cliente_nombre_completo,
            u.usuario_email AS cliente_email,
            u.usuario_telefono AS cliente_telefono,

            l.local_codigo,
            l.local_nombre_comercial,
            l.local_razon_social,
            l.local_telefono,
            l.local_email,

            e.estado_nombre,

            mp.metodo_pago_nombre,
            mp.metodo_pago_descripcion,

            r.id_repartidor,
            r.id_usuario AS repartidor_id_usuario,
            r.repartidor_codigo,
            r.repartidor_placa,
            r.repartidor_tipo_vehiculo,
            r.repartidor_calificacion,
            r.repartidor_posicion_ranking,
            r.repartidor_total_pedidos,
            r.repartidor_pedidos_aceptados,
            r.repartidor_pedidos_rechazados,
            r.repartidor_porcentaje_aceptacion,

            ur.usuario_nombre AS repartidor_nombre,
            ur.usuario_apellido AS repartidor_apellido,
            ur.usuario_nombre_completo AS repartidor_nombre_completo,
            ur.usuario_telefono AS repartidor_telefono

        FROM pedidos p

        LEFT JOIN clientes c
            ON p.id_cliente = c.id_cliente

        LEFT JOIN usuarios u
            ON c.id_usuario = u.id_usuario

        LEFT JOIN locales l
            ON p.id_local = l.id_local

        LEFT JOIN estados e
            ON p.id_estado = e.id_estado

        LEFT JOIN metodos_pago mp
            ON p.id_metodo_pago = mp.id_metodo_pago

        LEFT JOIN repartidores r
            ON p.id_repartidor = r.id_repartidor

        LEFT JOIN usuarios ur
            ON r.id_usuario = ur.id_usuario

        WHERE p.id_pedido = ?

        LIMIT 1
        `,
        [id_pedido]
    );

    return pedidos.length ? pedidos[0] : null;
};

// ============================================================
// LISTAR PEDIDOS SEGÚN ROL
// ============================================================

export const getPedidos = async (req, res) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado."
            });
        }

        const roles = obtenerRoles(req);
        const id_usuario = obtenerIdUsuario(req);

        console.log("[Pedidos] Consulta de pedidos:", {
            id_usuario,
            roles
        });

        // ====================================================
        // ADMINISTRATIVOS
        // ====================================================

        if (esAdministrativo(req)) {
            const [result] = await conmysql.query(`
                SELECT
                    p.*,

                    c.cliente_codigo,
                    c.id_usuario AS cliente_id_usuario,

                    u.usuario_nombre AS cliente_nombre,
                    u.usuario_apellido AS cliente_apellido,
                    u.usuario_nombre_completo AS cliente_nombre_completo,
                    u.usuario_cedula AS cliente_cedula,
                    u.usuario_email AS cliente_email,
                    u.usuario_telefono AS cliente_telefono,

                    l.local_codigo,
                    l.local_nombre_comercial,
                    l.local_razon_social,
                    l.local_telefono,
                    l.local_email,

                    e.estado_nombre,

                    mp.metodo_pago_nombre,
                    mp.metodo_pago_descripcion,

                    r.id_repartidor,
                    r.repartidor_codigo,
                    r.repartidor_placa,
                    r.repartidor_tipo_vehiculo

                FROM pedidos p

                LEFT JOIN clientes c
                    ON p.id_cliente = c.id_cliente

                LEFT JOIN usuarios u
                    ON c.id_usuario = u.id_usuario

                LEFT JOIN locales l
                    ON p.id_local = l.id_local

                LEFT JOIN estados e
                    ON p.id_estado = e.id_estado

                LEFT JOIN metodos_pago mp
                    ON p.id_metodo_pago = mp.id_metodo_pago

                LEFT JOIN repartidores r
                    ON p.id_repartidor = r.id_repartidor

                ORDER BY p.id_pedido DESC
            `);

            console.log(
                `[Pedidos] Administrativo: ${result.length} pedidos`
            );

            return res.json(
                ocultarPedidosPin(result, req)
            );
        }

        // ====================================================
        // CLIENTE
        // ====================================================

        if (tieneRol(req, ["CLIENTE"])) {
            if (!id_usuario) {
                return res.status(401).json({
                    success: false,
                    message:
                        "No se pudo identificar al usuario."
                });
            }

            const id_cliente =
                await obtenerClienteDelUsuario(id_usuario);

            if (!id_cliente) {
                return res.status(403).json({
                    success: false,
                    message:
                        "El usuario no tiene un cliente asociado."
                });
            }

            // IMPORTANTE:
            // EL FILTRO POR id_cliente SE HACE EN SQL.
            // Nunca se devuelve la lista completa al cliente.

            const [result] = await conmysql.query(
                `
                SELECT
                    p.*,

                    c.cliente_codigo,

                    l.local_codigo,
                    l.local_nombre_comercial,
                    l.local_razon_social,
                    l.local_telefono,

                    e.estado_nombre,

                    mp.metodo_pago_nombre,
                    mp.metodo_pago_descripcion,

                    r.repartidor_codigo

                FROM pedidos p

                LEFT JOIN clientes c
                    ON p.id_cliente = c.id_cliente

                LEFT JOIN locales l
                    ON p.id_local = l.id_local

                LEFT JOIN estados e
                    ON p.id_estado = e.id_estado

                LEFT JOIN metodos_pago mp
                    ON p.id_metodo_pago = mp.id_metodo_pago

                LEFT JOIN repartidores r
                    ON p.id_repartidor = r.id_repartidor

                WHERE p.id_cliente = ?

                ORDER BY p.id_pedido DESC
                `,
                [id_cliente]
            );

            console.log(
                `[Pedidos] Cliente ${id_cliente}: ${result.length} pedidos`
            );

            return res.json(
                ocultarPedidosPin(result, req)
            );
        }

        // ====================================================
        // REPARTIDOR
        // ====================================================

        if (tieneRol(req, ["REPARTIDOR"])) {
            if (!id_usuario) {
                return res.status(401).json({
                    success: false,
                    message:
                        "No se pudo identificar al usuario."
                });
            }

            const id_repartidor =
                await obtenerRepartidorDelUsuario(
                    id_usuario
                );

            if (!id_repartidor) {
                return res.status(403).json({
                    success: false,
                    message:
                        "El usuario no tiene un repartidor asociado."
                });
            }

            const [result] = await conmysql.query(
                `
                SELECT
                    p.*,

                    c.cliente_codigo,
                    u.usuario_nombre_completo AS cliente_nombre,
                    u.usuario_telefono AS cliente_telefono,

                    l.local_codigo,
                    l.local_nombre_comercial,

                    e.estado_nombre,

                    mp.metodo_pago_nombre,
                    mp.metodo_pago_descripcion

                FROM pedidos p

                LEFT JOIN clientes c
                    ON p.id_cliente = c.id_cliente

                LEFT JOIN usuarios u
                    ON c.id_usuario = u.id_usuario

                LEFT JOIN locales l
                    ON p.id_local = l.id_local

                LEFT JOIN estados e
                    ON p.id_estado = e.id_estado

                LEFT JOIN metodos_pago mp
                    ON p.id_metodo_pago = mp.id_metodo_pago

                WHERE p.id_repartidor = ?

                ORDER BY p.id_pedido DESC
                `,
                [id_repartidor]
            );

            return res.json(
                ocultarPedidosPin(result, req)
            );
        }

        // ====================================================
        // LOCAL
        // ====================================================

        if (tieneRol(req, ["LOCAL"])) {
            if (!id_usuario) {
                return res.status(401).json({
                    success: false,
                    message:
                        "No se pudo identificar al usuario."
                });
            }

            const id_local =
                await obtenerLocalDelUsuario(id_usuario);

            if (!id_local) {
                return res.status(403).json({
                    success: false,
                    message:
                        "El usuario no tiene un local asociado."
                });
            }

            const [result] = await conmysql.query(
                `
                SELECT
                    p.*,

                    c.cliente_codigo,
                    u.usuario_nombre_completo AS cliente_nombre,
                    u.usuario_telefono AS cliente_telefono,

                    l.local_codigo,
                    l.local_nombre_comercial,

                    e.estado_nombre,

                    mp.metodo_pago_nombre,
                    mp.metodo_pago_descripcion

                FROM pedidos p

                LEFT JOIN clientes c
                    ON p.id_cliente = c.id_cliente

                LEFT JOIN usuarios u
                    ON c.id_usuario = u.id_usuario

                LEFT JOIN locales l
                    ON p.id_local = l.id_local

                LEFT JOIN estados e
                    ON p.id_estado = e.id_estado

                LEFT JOIN metodos_pago mp
                    ON p.id_metodo_pago = mp.id_metodo_pago

                WHERE p.id_local = ?

                ORDER BY p.id_pedido DESC
                `,
                [id_local]
            );

            return res.json(
                ocultarPedidosPin(result, req)
            );
        }

        // ====================================================
        // SIN PERMISOS
        // ====================================================

        return res.status(403).json({
            success: false,
            message:
                `Los roles [${roles.join(", ") || "SIN_ROL"}] no tienen permisos para consultar pedidos.`
        });

    } catch (error) {
        console.error(
            "[Pedidos] Error getPedidos:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Error al consultar pedidos"
        });
    }
};

// ============================================================
// TODOS LOS PEDIDOS - ADMINISTRATIVO
// ============================================================

export const getTodosLosPedidosAdmin = async (req, res) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado."
            });
        }

        const roles = obtenerRoles(req);

        if (!esAdministrativo(req)) {
            return res.status(403).json({
                success: false,
                message:
                    "No tienes permisos para consultar todos los pedidos.",
                roles
            });
        }

        const [pedidos] = await conmysql.query(`
            SELECT
                p.*,

                c.cliente_codigo,
                c.id_usuario AS cliente_id_usuario,

                u.usuario_nombre AS cliente_nombre,
                u.usuario_apellido AS cliente_apellido,
                u.usuario_nombre_completo AS cliente_nombre_completo,
                u.usuario_cedula AS cliente_cedula,
                u.usuario_email AS cliente_email,
                u.usuario_telefono AS cliente_telefono,

                l.local_codigo,
                l.local_nombre_comercial,
                l.local_razon_social,
                l.local_telefono,
                l.local_email,

                e.estado_nombre,

                mp.metodo_pago_nombre,
                mp.metodo_pago_descripcion,

                r.id_repartidor,
                r.repartidor_codigo,
                r.repartidor_placa,
                r.repartidor_tipo_vehiculo,

                ur.usuario_nombre AS repartidor_nombre,
                ur.usuario_apellido AS repartidor_apellido,
                ur.usuario_nombre_completo AS repartidor_nombre_completo,
                ur.usuario_telefono AS repartidor_telefono

            FROM pedidos p

            LEFT JOIN clientes c
                ON p.id_cliente = c.id_cliente

            LEFT JOIN usuarios u
                ON c.id_usuario = u.id_usuario

            LEFT JOIN locales l
                ON p.id_local = l.id_local

            LEFT JOIN estados e
                ON p.id_estado = e.id_estado

            LEFT JOIN metodos_pago mp
                ON p.id_metodo_pago = mp.id_metodo_pago

            LEFT JOIN repartidores r
                ON p.id_repartidor = r.id_repartidor

            LEFT JOIN usuarios ur
                ON r.id_usuario = ur.id_usuario

            ORDER BY p.id_pedido DESC
        `);

        return res.status(200).json(
            ocultarPedidosPin(pedidos, req)
        );

    } catch (error) {
        console.error(
            "[Pedidos Admin] Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al consultar todos los pedidos."
        });
    }
};

// ============================================================
// PEDIDO POR ID
// ============================================================

export const getPedidoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!esIdValido(id)) {
            return res.status(400).json({
                success: false,
                message:
                    "El ID del pedido no es válido."
            });
        }

        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message:
                    "Usuario no autenticado."
            });
        }

        const pedido =
            await obtenerPedidoPorIdInterno(id);

        if (!pedido) {
            return res.status(404).json({
                success: false,
                message:
                    "Pedido no encontrado"
            });
        }

        // ADMINISTRATIVO
        if (esAdministrativo(req)) {
            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        // CLIENTE
        if (tieneRol(req, ["CLIENTE"])) {
            if (
                !await verificarAccesoCliente(
                    req,
                    res,
                    pedido.id_cliente
                )
            ) {
                return;
            }

            const [detalles] = await conmysql.query(
                `
                SELECT
                    pd.*,
                    p.pedido_codigo,
                    lp.id_local,
                    lp.id_producto,
                    l.local_nombre_comercial,
                    pr.producto_codigo,
                    pr.producto_nombre

                FROM pedido_detalles pd

                LEFT JOIN pedidos p
                    ON pd.id_pedido = p.id_pedido

                LEFT JOIN local_productos lp
                    ON pd.id_local_producto =
                       lp.id_local_producto

                LEFT JOIN locales l
                    ON lp.id_local = l.id_local

                LEFT JOIN productos pr
                    ON lp.id_producto = pr.id_producto

                WHERE pd.id_pedido = ?

                ORDER BY pd.id_pedido_detalle ASC
                `,
                [id]
            );

            pedido.detalles = detalles;

            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        // REPARTIDOR
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor =
                await obtenerRepartidorDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (
                Number(pedido.id_repartidor) !==
                Number(id_repartidor)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes acceder a este pedido."
                });
            }

            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        // LOCAL
        if (tieneRol(req, ["LOCAL"])) {
            const id_local =
                await obtenerLocalDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (
                Number(pedido.id_local) !==
                Number(id_local)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes acceder a este pedido."
                });
            }

            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        return res.status(403).json({
            success: false,
            message:
                "No tienes permisos para acceder a este pedido."
        });

    } catch (error) {
        console.error(
            "[Pedidos] Error getPedidoPorId:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al consultar pedido"
        });
    }
};

// ============================================================
// PEDIDOS POR CLIENTE
// ============================================================

export const getPedidosPorCliente = async (req, res) => {
    try {
        const { id_cliente } = req.params;

        if (!esIdValido(id_cliente)) {
            return res.status(400).json({
                success: false,
                message:
                    "El ID del cliente no es válido."
            });
        }

        if (
            !await verificarAccesoCliente(
                req,
                res,
                id_cliente
            )
        ) {
            return;
        }

        const [result] = await conmysql.query(
            `
            SELECT
                p.*,
                c.cliente_codigo,

                l.local_codigo,
                l.local_nombre_comercial,
                l.local_razon_social,

                e.estado_nombre,

                mp.metodo_pago_nombre,
                mp.metodo_pago_descripcion,

                r.repartidor_codigo

            FROM pedidos p

            LEFT JOIN clientes c
                ON p.id_cliente = c.id_cliente

            LEFT JOIN locales l
                ON p.id_local = l.id_local

            LEFT JOIN estados e
                ON p.id_estado = e.id_estado

            LEFT JOIN metodos_pago mp
                ON p.id_metodo_pago = mp.id_metodo_pago

            LEFT JOIN repartidores r
                ON p.id_repartidor = r.id_repartidor

            WHERE p.id_cliente = ?

            ORDER BY p.id_pedido DESC
            `,
            [id_cliente]
        );

        return res.json(
            ocultarPedidosPin(result, req)
        );

    } catch (error) {
        console.error(
            "[Pedidos] Error getPedidosPorCliente:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al consultar pedidos del cliente"
        });
    }
};

// ============================================================
// PEDIDOS POR LOCAL
// ============================================================

export const getPedidosPorLocal = async (req, res) => {
    try {
        const { id_local } = req.params;

        if (!esIdValido(id_local)) {
            return res.status(400).json({
                success: false,
                message:
                    "El ID del local no es válido."
            });
        }

        if (tieneRol(req, ["LOCAL"])) {
            const localUsuario =
                await obtenerLocalDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (!localUsuario) {
                return res.status(403).json({
                    success: false,
                    message:
                        "El usuario no tiene un local asociado."
                });
            }

            if (
                Number(localUsuario) !==
                Number(id_local)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes consultar pedidos de otro local."
                });
            }

        } else if (!esAdministrativo(req)) {
            return res.status(403).json({
                success: false,
                message:
                    "No tienes permisos para consultar pedidos de este local."
            });
        }

        const [result] = await conmysql.query(
            `
            SELECT
                p.*,

                c.cliente_codigo,
                u.usuario_nombre_completo AS cliente_nombre,
                u.usuario_telefono AS cliente_telefono,

                l.local_codigo,
                l.local_nombre_comercial,

                e.estado_nombre,

                mp.metodo_pago_nombre,

                r.repartidor_codigo

            FROM pedidos p

            LEFT JOIN clientes c
                ON p.id_cliente = c.id_cliente

            LEFT JOIN usuarios u
                ON c.id_usuario = u.id_usuario

            LEFT JOIN locales l
                ON p.id_local = l.id_local

            LEFT JOIN estados e
                ON p.id_estado = e.id_estado

            LEFT JOIN metodos_pago mp
                ON p.id_metodo_pago = mp.id_metodo_pago

            LEFT JOIN repartidores r
                ON p.id_repartidor = r.id_repartidor

            WHERE p.id_local = ?

            ORDER BY p.id_pedido DESC
            `,
            [id_local]
        );

        return res.json(
            ocultarPedidosPin(result, req)
        );

    } catch (error) {
        console.error(
            "[Pedidos] Error getPedidosPorLocal:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al consultar pedidos del local"
        });
    }
};

// ============================================================
// PEDIDO POR CÓDIGO
// ============================================================

export const getPedidoPorCodigo = async (req, res) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message:
                    "Usuario no autenticado."
            });
        }

        const { codigo } = req.params;

        if (!codigo || !String(codigo).trim()) {
            return res.status(400).json({
                success: false,
                message:
                    "El código del pedido es obligatorio."
            });
        }

        const [result] = await conmysql.query(
            `
            SELECT
                p.*,

                c.cliente_codigo,

                u.usuario_nombre AS cliente_nombre,
                u.usuario_apellido AS cliente_apellido,
                u.usuario_nombre_completo AS cliente_nombre_completo,
                u.usuario_telefono AS cliente_telefono,

                l.local_codigo,
                l.local_nombre_comercial,
                l.local_razon_social,

                e.estado_nombre,

                mp.metodo_pago_nombre,
                mp.metodo_pago_descripcion,

                r.repartidor_codigo

            FROM pedidos p

            LEFT JOIN clientes c
                ON p.id_cliente = c.id_cliente

            LEFT JOIN usuarios u
                ON c.id_usuario = u.id_usuario

            LEFT JOIN locales l
                ON p.id_local = l.id_local

            LEFT JOIN estados e
                ON p.id_estado = e.id_estado

            LEFT JOIN metodos_pago mp
                ON p.id_metodo_pago = mp.id_metodo_pago

            LEFT JOIN repartidores r
                ON p.id_repartidor = r.id_repartidor

            WHERE p.pedido_codigo = ?

            LIMIT 1
            `,
            [String(codigo).trim()]
        );

        if (!result.length) {
            return res.status(404).json({
                success: false,
                message:
                    "Pedido no encontrado"
            });
        }

        const pedido = result[0];

        // ADMIN
        if (esAdministrativo(req)) {
            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        // CLIENTE
        if (tieneRol(req, ["CLIENTE"])) {
            if (
                !await verificarAccesoCliente(
                    req,
                    res,
                    pedido.id_cliente
                )
            ) {
                return;
            }

            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        // REPARTIDOR
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor =
                await obtenerRepartidorDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (
                Number(pedido.id_repartidor) !==
                Number(id_repartidor)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes acceder a este pedido."
                });
            }

            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        // LOCAL
        if (tieneRol(req, ["LOCAL"])) {
            const id_local =
                await obtenerLocalDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (
                Number(pedido.id_local) !==
                Number(id_local)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes acceder a este pedido."
                });
            }

            return res.json(
                ocultarPedidoPin(pedido, req)
            );
        }

        return res.status(403).json({
            success: false,
            message:
                "No tienes permisos para consultar pedidos."
        });

    } catch (error) {
        console.error(
            "[Pedidos] Error getPedidoPorCodigo:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al consultar pedido"
        });
    }
};

// ============================================================
// PEDIDOS POR ESTADO
// ============================================================

export const getPedidosPorEstado = async (req, res) => {
    try {
        const { id_estado } = req.params;

        if (!esIdValido(id_estado)) {
            return res.status(400).json({
                success: false,
                message:
                    "El ID del estado no es válido."
            });
        }

        if (!esAdministrativo(req)) {
            return res.status(403).json({
                success: false,
                message:
                    "No tienes permisos para consultar pedidos por estado."
            });
        }

        const [result] = await conmysql.query(
            `
            SELECT
                p.*,

                c.cliente_codigo,
                u.usuario_nombre_completo AS cliente_nombre,

                l.local_codigo,
                l.local_nombre_comercial,

                e.estado_nombre,

                mp.metodo_pago_nombre,

                r.repartidor_codigo

            FROM pedidos p

            LEFT JOIN clientes c
                ON p.id_cliente = c.id_cliente

            LEFT JOIN usuarios u
                ON c.id_usuario = u.id_usuario

            LEFT JOIN locales l
                ON p.id_local = l.id_local

            LEFT JOIN estados e
                ON p.id_estado = e.id_estado

            LEFT JOIN metodos_pago mp
                ON p.id_metodo_pago = mp.id_metodo_pago

            LEFT JOIN repartidores r
                ON p.id_repartidor = r.id_repartidor

            WHERE p.id_estado = ?

            ORDER BY p.id_pedido DESC
            `,
            [id_estado]
        );

        return res.json(
            ocultarPedidosPin(result, req)
        );

    } catch (error) {
        console.error(
            "[Pedidos] Error getPedidosPorEstado:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al consultar pedidos por estado"
        });
    }
};

// ============================================================
// CREAR PEDIDO
// ============================================================

export const postPedido = async (req, res) => {
    const conexion = await conmysql.getConnection();

    let id_pedido = null;
    let pedido_pin = null;
    let transaccionIniciada = false;

    try {
        if (!req.usuario) {
            conexion.release();

            return res.status(401).json({
                success: false,
                message:
                    "Usuario no autenticado."
            });
        }

        let {
            id_cliente,
            id_local,
            id_local_sucursal,
            id_metodo_pago,

            pedido_cantidad_productos,
            pedido_subtotal_local,
            pedido_subtotal_app,
            pedido_adicional_volumen,
            pedido_carrera,
            pedido_propina,
            pedido_total,

            pedido_distancia_km,
            pedido_tiempo_estimado,

            pedido_cliente_latitud,
            pedido_cliente_longitud,

            pedido_local_latitud,
            pedido_local_longitud,

            pedido_observacion,

            id_estado,
            pedido_fecha,
            pedido_fecha_entrega,

            productos,
            detalles
        } = req.body;

        // CLIENTE:
        // IGNORAR CUALQUIER id_cliente ENVIADO DESDE FRONTEND.
        // Se obtiene directamente desde req.usuario.

        if (tieneRol(req, ["CLIENTE"])) {
            const id_usuario =
                obtenerIdUsuario(req);

            if (!id_usuario) {
                conexion.release();

                return res.status(401).json({
                    success: false,
                    message:
                        "No se pudo identificar al usuario."
                });
            }

            const clienteUsuario =
                await obtenerClienteDelUsuario(
                    id_usuario
                );

            if (!clienteUsuario) {
                conexion.release();

                return res.status(403).json({
                    success: false,
                    message:
                        "El usuario no tiene un cliente asociado."
                });
            }

            id_cliente = clienteUsuario;

        } else if (!id_cliente) {

            if (!esAdministrativo(req)) {
                conexion.release();

                return res.status(403).json({
                    success: false,
                    message:
                        "No tienes permisos para crear pedidos."
                });
            }

            conexion.release();

            return res.status(400).json({
                success: false,
                message:
                    "El cliente es obligatorio"
            });
        }

        if (!id_local) {
            conexion.release();

            return res.status(400).json({
                success: false,
                message:
                    "El local es obligatorio"
            });
        }

        const listaDetalles =
            Array.isArray(detalles)
                ? detalles
                : productos;

        if (
            !Array.isArray(listaDetalles) ||
            !listaDetalles.length
        ) {
            conexion.release();

            return res.status(400).json({
                success: false,
                message:
                    "El pedido debe contener al menos un producto"
            });
        }

        await conexion.beginTransaction();
        transaccionIniciada = true;

        const [clientes] = await conexion.query(
            `
            SELECT id_cliente
            FROM clientes
            WHERE id_cliente = ?
            FOR UPDATE
            `,
            [id_cliente]
        );

        if (!clientes.length) {
            throw new Error("El cliente no existe");
        }

        const [locales] = await conexion.query(
            `
            SELECT
                id_local,
                local_latitud,
                local_longitud

            FROM locales

            WHERE id_local = ?

            FOR UPDATE
            `,
            [id_local]
        );

        if (!locales.length) {
            throw new Error("El local no existe");
        }

        const local = locales[0];

        if (
            pedido_local_latitud === undefined ||
            pedido_local_latitud === null
        ) {
            pedido_local_latitud =
                local.local_latitud;
        }

        if (
            pedido_local_longitud === undefined ||
            pedido_local_longitud === null
        ) {
            pedido_local_longitud =
                local.local_longitud;
        }

        // MÉTODO DE PAGO
        if (
            id_metodo_pago !== undefined &&
            id_metodo_pago !== null
        ) {
            const [metodos] =
                await conexion.query(
                    `
                    SELECT id_metodo_pago
                    FROM metodos_pago

                    WHERE id_metodo_pago = ?
                    AND metodo_pago_estado = 1
                    `,
                    [id_metodo_pago]
                );

            if (!metodos.length) {
                throw new Error(
                    "El método de pago no existe o está inactivo"
                );
            }
        }

        // GENERAR CÓDIGO
        const [ultimo] =
            await conexion.query(
                `
                SELECT pedido_codigo
                FROM pedidos

                ORDER BY id_pedido DESC

                LIMIT 1

                FOR UPDATE
                `
            );

        let numero = 1;

        if (
            ultimo.length &&
            ultimo[0].pedido_codigo
        ) {
            const match =
                String(
                    ultimo[0].pedido_codigo
                ).match(/(\d+)$/);

            if (match) {
                numero =
                    parseInt(match[1], 10) + 1;
            }
        }

        const pedido_codigo =
            `PED-${String(numero).padStart(5, "0")}`;

        pedido_pin =
            generarPedidoPin();

        const estadoInicial =
            id_estado ?? 10;

        // INSERTAR PEDIDO
        const [result] =
            await conexion.query(
                `
                INSERT INTO pedidos (
                    pedido_codigo,
                    pedido_pin,
                    id_cliente,
                    id_local,
                    id_repartidor,
                    id_local_sucursal,
                    id_metodo_pago,
                    pedido_fecha,
                    pedido_cantidad_productos,
                    pedido_subtotal_local,
                    pedido_subtotal_app,
                    pedido_adicional_volumen,
                    pedido_carrera,
                    pedido_propina,
                    pedido_total,
                    pedido_distancia_km,
                    pedido_tiempo_estimado,
                    pedido_cliente_latitud,
                    pedido_cliente_longitud,
                    pedido_local_latitud,
                    pedido_local_longitud,
                    pedido_observacion,
                    id_estado,
                    pedido_fecha_entrega
                )

                VALUES (
                    ?, ?, ?, ?, NULL, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?
                )
                `,
                [
                    pedido_codigo,
                    pedido_pin,
                    id_cliente,
                    id_local,

                    id_local_sucursal ?? null,
                    id_metodo_pago ?? null,

                    convertirFechaMySQL(
                        pedido_fecha ?? new Date()
                    ),

                    Number(
                        pedido_cantidad_productos ?? 0
                    ),

                    Number(
                        pedido_subtotal_local ?? 0
                    ),

                    Number(
                        pedido_subtotal_app ?? 0
                    ),

                    Number(
                        pedido_adicional_volumen ?? 0
                    ),

                    Number(
                        pedido_carrera ?? 0
                    ),

                    Number(
                        pedido_propina ?? 0
                    ),

                    Number(
                        pedido_total ?? 0
                    ),

                    Number(
                        pedido_distancia_km ?? 0
                    ),

                    Number(
                        pedido_tiempo_estimado ?? 0
                    ),

                    pedido_cliente_latitud ?? null,
                    pedido_cliente_longitud ?? null,

                    pedido_local_latitud ?? null,
                    pedido_local_longitud ?? null,

                    pedido_observacion ?? null,

                    estadoInicial,

                    pedido_fecha_entrega ?? null
                ]
            );

        id_pedido = result.insertId;

        const detallesRegistrados = [];

        // DETALLES
        for (const detalle of listaDetalles) {
            const id_local_producto =
                Number(
                    detalle.id_local_producto
                );

            const cantidad =
                Number(
                    detalle.pedido_detalle_cantidad ??
                    detalle.cantidad ??
                    0
                );

            if (!id_local_producto) {
                throw new Error(
                    "Cada producto debe tener id_local_producto"
                );
            }

            if (
                !Number.isInteger(cantidad) ||
                cantidad <= 0
            ) {
                throw new Error(
                    "La cantidad de cada producto debe ser un entero mayor que 0"
                );
            }

            const [productosLocal] =
                await conexion.query(
                    `
                    SELECT
                        lp.id_local_producto,
                        lp.id_local,
                        lp.id_producto,

                        pr.producto_codigo,
                        pr.producto_nombre,
                        pr.producto_estado

                    FROM local_productos lp

                    INNER JOIN productos pr
                        ON lp.id_producto =
                           pr.id_producto

                    WHERE
                        lp.id_local_producto = ?
                        AND lp.id_local = ?

                    FOR UPDATE
                    `,
                    [
                        id_local_producto,
                        id_local
                    ]
                );

            if (!productosLocal.length) {
                throw new Error(
                    `El producto del local ${id_local_producto} no existe o no pertenece al local del pedido`
                );
            }

            const producto =
                productosLocal[0];

            if (
                producto.producto_estado === null ||
                producto.producto_estado === undefined ||
                String(
                    producto.producto_estado
                ).trim().toUpperCase() !==
                "ACTIVO"
            ) {
                throw new Error(
                    `El producto "${producto.producto_nombre}" no está disponible para comprar`
                );
            }

            const precioLocal =
                Number(
                    detalle.pedido_detalle_precio_local ??
                    detalle.precioLocal ??
                    0
                );

            const precioApp =
                Number(
                    detalle.pedido_detalle_precio_app ??
                    detalle.precioApp ??
                    0
                );

            if (
                !Number.isFinite(precioLocal) ||
                precioLocal < 0
            ) {
                throw new Error(
                    `Precio local inválido para el producto ${id_local_producto}`
                );
            }

            if (
                !Number.isFinite(precioApp) ||
                precioApp < 0
            ) {
                throw new Error(
                    `Precio app inválido para el producto ${id_local_producto}`
                );
            }

            const subtotalLocal =
                Number(
                    detalle.pedido_detalle_subtotal_local ??
                    detalle.subtotalLocal ??
                    precioLocal * cantidad
                );

            const subtotalApp =
                Number(
                    detalle.pedido_detalle_subtotal_app ??
                    detalle.subtotalApp ??
                    precioApp * cantidad
                );

            if (
                !Number.isFinite(subtotalLocal) ||
                subtotalLocal < 0
            ) {
                throw new Error(
                    `Subtotal local inválido para el producto ${id_local_producto}`
                );
            }

            if (
                !Number.isFinite(subtotalApp) ||
                subtotalApp < 0
            ) {
                throw new Error(
                    `Subtotal app inválido para el producto ${id_local_producto}`
                );
            }

            const [detalleResult] =
                await conexion.query(
                    `
                    INSERT INTO pedido_detalles (
                        id_pedido,
                        id_local_producto,
                        pedido_detalle_cantidad,
                        pedido_detalle_precio_local,
                        pedido_detalle_precio_app,
                        pedido_detalle_subtotal_local,
                        pedido_detalle_subtotal_app,
                        pedido_detalle_observacion
                    )

                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        id_pedido,
                        id_local_producto,
                        cantidad,
                        precioLocal,
                        precioApp,
                        subtotalLocal,
                        subtotalApp,
                        detalle.pedido_detalle_observacion ??
                            detalle.observacion ??
                            null
                    ]
                );

            detallesRegistrados.push({
                id_pedido_detalle:
                    detalleResult.insertId,

                id_local_producto,
                cantidad,
                precioLocal,
                precioApp,
                subtotalLocal,
                subtotalApp
            });
        }

        await conexion.commit();
        transaccionIniciada = false;

        console.log(
            "[Pedidos] Pedido creado:",
            {
                id_pedido,
                pedido_codigo
            }
        );

        const pedidoFinal =
            await obtenerPedidoPorIdInterno(
                id_pedido
            );

        const respuesta = {
            success: true,

            id_pedido,
            pedido_codigo,

            id_cliente,
            id_local,

            id_repartidor:
                pedidoFinal?.id_repartidor ??
                null,

            id_estado:
                pedidoFinal?.id_estado ??
                estadoInicial,

            estado_nombre:
                pedidoFinal?.estado_nombre ??
                null,

            message:
                "Pedido registrado con éxito",

            asignacion: {
                asignado: false,
                motivo:
                    "La asignación se realizará cuando el local acepte el pedido y lo ponga EN_PREPARACION."
            },

            detalles:
                detallesRegistrados
        };

        // SOLO EL CLIENTE RECIBE EL PIN
        if (tieneRol(req, ["CLIENTE"])) {
            respuesta.pedido_pin =
                pedido_pin;
        }

        return res.status(201).json(
            respuesta
        );

    } catch (error) {
        if (transaccionIniciada) {
            try {
                await conexion.rollback();
            } catch (rollbackError) {
                console.error(
                    "[Pedidos] Error rollback:",
                    rollbackError
                );
            }
        }

        console.error(
            "[Pedidos] Error postPedido:",
            error
        );

        const mensaje =
            error.message ||
            "Error al registrar pedido";

        const erroresCliente = [
            "obligatorio",
            "no existe",
            "no está disponible",
            "debe contener",
            "cantidad",
            "producto del local",
            "Precio",
            "Subtotal",
            "fecha",
            "método de pago"
        ];

        const esErrorCliente =
            erroresCliente.some(texto =>
                mensaje
                    .toLowerCase()
                    .includes(
                        texto.toLowerCase()
                    )
            );

        return res.status(
            esErrorCliente ? 400 : 500
        ).json({
            success: false,
            message:
                esErrorCliente
                    ? mensaje
                    : "Error al registrar pedido"
        });

    } finally {
        conexion.release();
    }
};

// ============================================================
// ACTUALIZAR PEDIDO
// ============================================================

const CAMPOS_PEDIDO_ADMIN = [
    "pedido_codigo",
    "id_cliente",
    "id_local",
    "id_repartidor",
    "id_local_sucursal",
    "id_metodo_pago",
    "pedido_fecha",
    "pedido_cantidad_productos",
    "pedido_subtotal_local",
    "pedido_subtotal_app",
    "pedido_adicional_volumen",
    "pedido_carrera",
    "pedido_propina",
    "pedido_total",
    "pedido_distancia_km",
    "pedido_tiempo_estimado",
    "pedido_cliente_latitud",
    "pedido_cliente_longitud",
    "pedido_local_latitud",
    "pedido_local_longitud",
    "pedido_observacion",
    "id_estado",
    "pedido_fecha_entrega"
];

const CAMPOS_PEDIDO_CLIENTE = [
    "pedido_observacion",
    "pedido_cliente_latitud",
    "pedido_cliente_longitud",
    "pedido_fecha_entrega"
];

export const putPedido = async (req, res) => {
    try {
        const { id } = req.params;

        if (!esIdValido(id)) {
            return res.status(400).json({
                success: false,
                message:
                    "El ID del pedido no es válido."
            });
        }

        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message:
                    "Usuario no autenticado."
            });
        }

        const pedido =
            await obtenerPedidoPorIdInterno(id);

        if (!pedido) {
            return res.status(404).json({
                success: false,
                message:
                    "Pedido no encontrado"
            });
        }

        // REPARTIDOR
        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_repartidor =
                await obtenerRepartidorDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (
                Number(pedido.id_repartidor) !==
                Number(id_repartidor)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes modificar este pedido."
                });
            }

            return res.status(403).json({
                success: false,
                message:
                    "El repartidor debe utilizar los endpoints específicos para cambiar el estado del pedido."
            });
        }

        // CLIENTE
        if (tieneRol(req, ["CLIENTE"])) {
            if (
                !await verificarAccesoCliente(
                    req,
                    res,
                    pedido.id_cliente
                )
            ) {
                return;
            }

        // LOCAL
        } else if (tieneRol(req, ["LOCAL"])) {
            const id_local =
                await obtenerLocalDelUsuario(
                    obtenerIdUsuario(req)
                );

            if (!id_local) {
                return res.status(403).json({
                    success: false,
                    message:
                        "El usuario no tiene un local asociado."
                });
            }

            if (
                Number(pedido.id_local) !==
                Number(id_local)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "No puedes modificar pedidos de otro local."
                });
            }

        // ADMINISTRATIVO
        } else if (!esAdministrativo(req)) {
            return res.status(403).json({
                success: false,
                message:
                    "No tienes permisos para modificar pedidos."
            });
        }

        const camposPermitidos =
            tieneRol(req, ["CLIENTE"])
                ? CAMPOS_PEDIDO_CLIENTE
                : CAMPOS_PEDIDO_ADMIN;

        const campos = [];
        const valores = [];

        let seSolicitaEnPreparacion = false;

        // DETECTAR EN_PREPARACION
        if (
            req.body.id_estado !== undefined &&
            req.body.id_estado !== null
        ) {
            const idEstadoEnPreparacion =
                await obtenerIdEstadoPorNombre(
                    "EN_PREPARACION"
                );

            if (!idEstadoEnPreparacion) {
                return res.status(500).json({
                    success: false,
                    message:
                        'No existe el estado "EN_PREPARACION" en la tabla estados.'
                });
            }

            seSolicitaEnPreparacion =
                Number(req.body.id_estado) ===
                Number(idEstadoEnPreparacion);
        }

        // EL LOCAL NO PUEDE ASIGNAR REPARTIDOR MANUALMENTE
        if (
            tieneRol(req, ["LOCAL"]) &&
            req.body.id_repartidor !== undefined
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "El local no puede asignar manualmente un repartidor."
            });
        }

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                let valor =
                    req.body[campo];

                if (
                    campo === "pedido_fecha" &&
                    valor
                ) {
                    valor =
                        convertirFechaMySQL(
                            valor
                        );
                }

                campos.push(
                    `${campo} = ?`
                );

                valores.push(valor);
            }
        }

        if (!campos.length) {
            return res.status(400).json({
                success: false,
                message:
                    "No se proporcionaron campos válidos para actualizar."
            });
        }

        valores.push(id);

        const [result] =
            await conmysql.query(
                `
                UPDATE pedidos

                SET ${campos.join(", ")}

                WHERE id_pedido = ?
                `,
                valores
            );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message:
                    "Pedido no encontrado"
            });
        }

        // ASIGNACIÓN AUTOMÁTICA
        let asignacion = null;

        if (seSolicitaEnPreparacion) {
            console.log(
                "[Pedidos] Pedido EN_PREPARACION. Iniciando asignación automática:",
                {
                    id_pedido: Number(id)
                }
            );

            try {
                asignacion =
                    await asignarRepartidorAutomaticamente(
                        Number(id)
                    );

                console.log(
                    "[Pedidos] Resultado asignación:",
                    asignacion
                );

            } catch (errorAsignacion) {
                console.error(
                    "[Pedidos] Error en asignación automática:",
                    errorAsignacion
                );

                asignacion = {
                    asignado: false,
                    motivo:
                        "El pedido quedó EN_PREPARACION, pero no se pudo realizar la asignación automática en este momento."
                };
            }
        }

        const pedidoActualizado =
            await obtenerPedidoPorIdInterno(id);

        return res.json({
            success: true,
            ...ocultarPedidoPin(
                pedidoActualizado,
                req
            ),
            asignacion
        });

    } catch (error) {
        console.error(
            "[Pedidos] Error putPedido:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al actualizar pedido"
        });
    }
};

export const patchPedido =
    async (req, res) =>
        putPedido(req, res);

// ============================================================
// ELIMINAR PEDIDO
// ============================================================

export const deletePedido = async (req, res) => {
    const conexion =
        await conmysql.getConnection();

    let transaccionIniciada = false;

    try {
        const { id } = req.params;

        if (!esIdValido(id)) {
            conexion.release();

            return res.status(400).json({
                success: false,
                message:
                    "El ID del pedido no es válido."
            });
        }

        if (!req.usuario) {
            conexion.release();

            return res.status(401).json({
                success: false,
                message:
                    "Usuario no autenticado."
            });
        }

        if (!esAdministrativo(req)) {
            conexion.release();

            return res.status(403).json({
                success: false,
                message:
                    "No tienes permisos para eliminar pedidos."
            });
        }

        const pedido =
            await obtenerPedidoPorIdInterno(id);

        if (!pedido) {
            conexion.release();

            return res.status(404).json({
                success: false,
                message:
                    "Pedido no encontrado"
            });
        }

        await conexion.beginTransaction();
        transaccionIniciada = true;

        await conexion.query(
            `
            DELETE FROM pedido_repartidores
            WHERE id_pedido = ?
            `,
            [id]
        );

        await conexion.query(
            `
            DELETE FROM pedido_detalles
            WHERE id_pedido = ?
            `,
            [id]
        );

        const [result] =
            await conexion.query(
                `
                DELETE FROM pedidos
                WHERE id_pedido = ?
                `,
                [id]
            );

        if (!result.affectedRows) {
            await conexion.rollback();

            transaccionIniciada = false;

            return res.status(404).json({
                success: false,
                message:
                    "No se pudo eliminar el pedido"
            });
        }

        await conexion.commit();

        transaccionIniciada = false;

        return res.status(204).send();

    } catch (error) {
        if (transaccionIniciada) {
            try {
                await conexion.rollback();
            } catch (rollbackError) {
                console.error(
                    "[Pedidos] Error rollback:",
                    rollbackError
                );
            }
        }

        console.error(
            "[Pedidos] Error deletePedido:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error al eliminar pedido"
        });

    } finally {
        conexion.release();
    }
};

// ============================================================
// EXPORTS
// ============================================================

export {
    obtenerRol,
    obtenerRoles,
    obtenerIdUsuario,
    obtenerClienteDelUsuario,
    obtenerLocalDelUsuario,
    obtenerRepartidorDelUsuario,
    verificarAccesoCliente,
    obtenerPedidoPorIdInterno,
    generarPedidoPin,
    ocultarPedidoPin,
    ocultarPedidosPin,
    esAdministrativo,
    tieneRol
};
