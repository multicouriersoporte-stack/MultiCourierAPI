// src/controladores/pagosrepartidorCtrl.js
import { conmysql } from "../db.js";

// Configuración
const PORCENTAJE_COMISION_REPARTIDOR = 5;

// Utilidades
const esIdValido = id => Number.isInteger(Number(id)) && Number(id) > 0;

const obtenerIdUsuario = req => {
    const u = req.usuario || {};
    return u.id_usuario ?? u.usuario_id ?? u.idUsuario ?? u.id ?? u.usuarioId ?? null;
};

const obtenerRol = req => {
    const u = req.usuario || {};
    const rol = u.usuario_rol ?? u.rol_usuario ?? u.usuarioRol ?? u.rol ?? u.role ?? u.usuario_role ?? u.rol_nombre ?? u.nombre_rol;
    if (String(rol || "").trim()) return String(rol).trim().toUpperCase();

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

const tieneRol = (req, rolesPermitidos = []) => rolesPermitidos.map(r => String(r).trim().toUpperCase()).includes(obtenerRol(req));
const esAdministrativo = req => tieneRol(req, ["ADMINISTRADOR", "CENTRAL"]);

// Obtiene el repartidor asociado al usuario.
const obtenerRepartidorDelUsuario = async id_usuario => {
    if (!id_usuario) return null;
    const [rows] = await conmysql.query(`
        SELECT id_repartidor, id_usuario, repartidor_codigo
        FROM repartidores WHERE id_usuario = ? LIMIT 1
    `, [id_usuario]);
    return rows.length ? rows[0] : null;
};

// Obtiene un pago con sus datos relacionados.
const obtenerPagoPorIdInterno = async id_pago_repartidor => {
    const [rows] = await conmysql.query(`
        SELECT pr.*, r.repartidor_codigo, r.id_usuario AS repartidor_id_usuario,
               r.repartidor_placa, r.repartidor_tipo_vehiculo, r.repartidor_calificacion,
               p.pedido_codigo, p.id_cliente, p.id_local, p.pedido_carrera,
               p.pedido_propina, p.pedido_total, e.estado_nombre AS pedido_estado_nombre
        FROM pagos_repartidor pr
        LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
        LEFT JOIN pedidos p ON pr.id_pedido = p.id_pedido
        LEFT JOIN estados e ON p.id_estado = e.id_estado
        WHERE pr.id_pago_repartidor = ? LIMIT 1
    `, [id_pago_repartidor]);
    return rows.length ? rows[0] : null;
};

// Obtiene todos los pagos según el rol.
export const getPagosRepartidor = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const rol = obtenerRol(req);

        if (esAdministrativo(req)) {
            const [rows] = await conmysql.query(`
                SELECT pr.*, r.repartidor_codigo, r.id_usuario AS repartidor_id_usuario,
                       r.repartidor_placa, r.repartidor_tipo_vehiculo, r.repartidor_calificacion,
                       p.pedido_codigo, p.id_cliente, p.id_local, p.pedido_carrera,
                       p.pedido_propina, p.pedido_total, e.estado_nombre AS pedido_estado_nombre
                FROM pagos_repartidor pr
                LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
                LEFT JOIN pedidos p ON pr.id_pedido = p.id_pedido
                LEFT JOIN estados e ON p.id_estado = e.id_estado
                ORDER BY pr.id_pago_repartidor DESC
            `);
            return res.json(rows);
        }

        if (tieneRol(req, ["REPARTIDOR"])) {
            const id_usuario = obtenerIdUsuario(req);
            if (!id_usuario) return res.status(401).json({ success: false, message: "No se pudo identificar al usuario." });

            const repartidor = await obtenerRepartidorDelUsuario(id_usuario);
            if (!repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });

            const [rows] = await conmysql.query(`
                SELECT pr.*, r.repartidor_codigo, r.repartidor_placa, r.repartidor_tipo_vehiculo,
                       p.pedido_codigo, p.pedido_carrera, p.pedido_propina, p.pedido_total,
                       e.estado_nombre AS pedido_estado_nombre
                FROM pagos_repartidor pr
                LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
                LEFT JOIN pedidos p ON pr.id_pedido = p.id_pedido
                LEFT JOIN estados e ON p.id_estado = e.id_estado
                WHERE pr.id_repartidor = ?
                ORDER BY pr.id_pago_repartidor DESC
            `, [repartidor.id_repartidor]);
            return res.json(rows);
        }

        return res.status(403).json({ success: false, message: `El rol ${rol || "SIN_ROL"} no tiene permisos para consultar pagos del repartidor.` });
    } catch (error) {
        console.error("[PagosRepartidor] Error getPagosRepartidor:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pagos del repartidor", error: process.env.NODE_ENV === "development" ? error.message : undefined });
    }
};

// Obtiene un pago por su ID.
export const getPagoRepartidorxid = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pago no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const pago = await obtenerPagoPorIdInterno(id);
        if (!pago) return res.status(404).json({ success: false, message: "Pago del repartidor no encontrado." });
        if (esAdministrativo(req)) return res.json(pago);

        if (tieneRol(req, ["REPARTIDOR"])) {
            const repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (!repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });
            if (Number(pago.id_repartidor) !== Number(repartidor.id_repartidor)) return res.status(403).json({ success: false, message: "No puedes consultar el pago de otro repartidor." });
            return res.json(pago);
        }

        return res.status(403).json({ success: false, message: "No tienes permisos para consultar este pago." });
    } catch (error) {
        console.error("[PagosRepartidor] Error getPagoRepartidorxid:", error);
        return res.status(500).json({ success: false, message: "Error al consultar el pago del repartidor" });
    }
};

// Obtiene pagos de un repartidor específico.
export const getPagosRepartidorPorRepartidor = async (req, res) => {
    try {
        const { id_repartidor } = req.params;
        if (!esIdValido(id_repartidor)) return res.status(400).json({ success: false, message: "El ID del repartidor no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        if (esAdministrativo(req)) {
            const [rows] = await conmysql.query(`
                SELECT pr.*, r.repartidor_codigo, r.id_usuario AS repartidor_id_usuario, r.repartidor_placa,
                       p.pedido_codigo, p.pedido_carrera, p.pedido_propina, p.pedido_total,
                       e.estado_nombre AS pedido_estado_nombre
                FROM pagos_repartidor pr
                LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
                LEFT JOIN pedidos p ON pr.id_pedido = p.id_pedido
                LEFT JOIN estados e ON p.id_estado = e.id_estado
                WHERE pr.id_repartidor = ?
                ORDER BY pr.id_pago_repartidor DESC
            `, [id_repartidor]);
            return res.json(rows);
        }

        if (tieneRol(req, ["REPARTIDOR"])) {
            const repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (!repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });
            if (Number(repartidor.id_repartidor) !== Number(id_repartidor)) return res.status(403).json({ success: false, message: "No puedes consultar pagos de otro repartidor." });

            const [rows] = await conmysql.query(`
                SELECT pr.*, r.repartidor_codigo, r.repartidor_placa,
                       p.pedido_codigo, p.pedido_carrera, p.pedido_propina, p.pedido_total,
                       e.estado_nombre AS pedido_estado_nombre
                FROM pagos_repartidor pr
                LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
                LEFT JOIN pedidos p ON pr.id_pedido = p.id_pedido
                LEFT JOIN estados e ON p.id_estado = e.id_estado
                WHERE pr.id_repartidor = ?
                ORDER BY pr.id_pago_repartidor DESC
            `, [id_repartidor]);
            return res.json(rows);
        }

        return res.status(403).json({ success: false, message: "No tienes permisos para consultar estos pagos." });
    } catch (error) {
        console.error("[PagosRepartidor] Error getPagosRepartidorPorRepartidor:", error);
        return res.status(500).json({ success: false, message: "Error al consultar pagos del repartidor" });
    }
};

// Obtiene pagos asociados a un pedido.
export const getPagosRepartidorPorPedido = async (req, res) => {
    try {
        const { id_pedido } = req.params;
        if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });

        const [rows] = await conmysql.query(`
            SELECT pr.*, r.repartidor_codigo, r.id_usuario AS repartidor_id_usuario,
                   r.repartidor_placa, r.repartidor_tipo_vehiculo,
                   p.pedido_codigo, p.pedido_carrera, p.pedido_propina, p.pedido_total,
                   e.estado_nombre AS pedido_estado_nombre
            FROM pagos_repartidor pr
            LEFT JOIN repartidores r ON pr.id_repartidor = r.id_repartidor
            LEFT JOIN pedidos p ON pr.id_pedido = p.id_pedido
            LEFT JOIN estados e ON p.id_estado = e.id_estado
            WHERE pr.id_pedido = ?
            ORDER BY pr.id_pago_repartidor DESC
        `, [id_pedido]);

        if (esAdministrativo(req)) return res.json(rows);

        if (tieneRol(req, ["REPARTIDOR"])) {
            const repartidor = await obtenerRepartidorDelUsuario(obtenerIdUsuario(req));
            if (!repartidor) return res.status(403).json({ success: false, message: "El usuario no tiene un repartidor asociado." });
            return res.json(rows.filter(pago => Number(pago.id_repartidor) === Number(repartidor.id_repartidor)));
        }

        return res.status(403).json({ success: false, message: "No tienes permisos para consultar pagos por pedido." });
    } catch (error) {
        console.error("[PagosRepartidor] Error getPagosRepartidorPorPedido:", error);
        return res.status(500).json({ success: false, message: "Error al consultar el pago del pedido" });
    }
};

// Crea un pago manual. Solo ADMINISTRADOR y CENTRAL.
export const postPagosRepartidor = async (req, res) => {
    try {
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "Solo ADMINISTRADOR y CENTRAL pueden crear pagos." });

        const {
            id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
            pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
            pago_repartidor_estado, pago_repartidor_fecha_pago
        } = req.body;

        if (!esIdValido(id_repartidor)) return res.status(400).json({ success: false, message: "El ID del repartidor es obligatorio y válido." });
        if (!esIdValido(id_pedido)) return res.status(400).json({ success: false, message: "El ID del pedido es obligatorio y válido." });

        const [repartidores] = await conmysql.query(`SELECT id_repartidor FROM repartidores WHERE id_repartidor = ? LIMIT 1`, [id_repartidor]);
        if (!repartidores.length) return res.status(400).json({ success: false, message: "El repartidor no existe." });

        const [pedidos] = await conmysql.query(`
            SELECT id_pedido, id_repartidor, id_estado, pedido_carrera, pedido_propina
            FROM pedidos WHERE id_pedido = ? LIMIT 1
        `, [id_pedido]);
        if (!pedidos.length) return res.status(400).json({ success: false, message: "El pedido no existe." });

        const [existentes] = await conmysql.query(`SELECT * FROM pagos_repartidor WHERE id_pedido = ? LIMIT 1`, [id_pedido]);
        if (existentes.length) return res.status(409).json({ success: false, message: "El pedido ya tiene un pago registrado para el repartidor.", pago: existentes[0] });

        const carrera = Number(pago_repartidor_carrera ?? 0);
        const propina = Number(pago_repartidor_propina ?? 0);
        const otros = Number(pago_repartidor_otros ?? 0);
        const total = Number(pago_repartidor_total ?? (carrera + propina + otros));

        if (![carrera, propina, otros, total].every(Number.isFinite) || [carrera, propina, otros, total].some(v => v < 0)) {
            return res.status(400).json({ success: false, message: "Los valores del pago no son válidos." });
        }

        const estadoPago = pago_repartidor_estado || "PENDIENTE";
        const [resultado] = await conmysql.query(`
            INSERT INTO pagos_repartidor (
                id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
                pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
                pago_repartidor_estado, pago_repartidor_fecha_pago
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id_repartidor, id_pedido, pago_repartidor_fecha || new Date(), carrera, propina, otros, total, estadoPago, pago_repartidor_fecha_pago || null]);

        const pago = await obtenerPagoPorIdInterno(resultado.insertId);
        return res.status(201).json({ success: true, message: "Pago del repartidor creado correctamente.", pago });
    } catch (error) {
        console.error("[PagosRepartidor] Error postPagosRepartidor:", error);
        return res.status(500).json({ success: false, message: "Error al crear el pago del repartidor", error: process.env.NODE_ENV === "development" ? error.message : undefined });
    }
};

// Actualiza un pago. Solo ADMINISTRADOR y CENTRAL.
export const putPagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pago no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!esAdministrativo(req)) return res.status(403).json({ success: false, message: "Solo ADMINISTRADOR y CENTRAL pueden modificar pagos." });

        const pago = await obtenerPagoPorIdInterno(id);
        if (!pago) return res.status(404).json({ success: false, message: "Pago del repartidor no encontrado." });

        const camposPermitidos = [
            "id_repartidor", "id_pedido", "pago_repartidor_fecha", "pago_repartidor_carrera",
            "pago_repartidor_propina", "pago_repartidor_otros", "pago_repartidor_total",
            "pago_repartidor_estado", "pago_repartidor_fecha_pago"
        ];
        const campos = [], valores = [];

        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(req.body[campo]);
            }
        }

        if (!campos.length) return res.status(400).json({ success: false, message: "No se proporcionaron campos válidos para actualizar." });

        const camposNumericos = [
            "id_repartidor", "id_pedido", "pago_repartidor_carrera",
            "pago_repartidor_propina", "pago_repartidor_otros", "pago_repartidor_total"
        ];

        for (const campo of camposNumericos) {
            if (req.body[campo] !== undefined) {
                const valor = Number(req.body[campo]);
                if (!Number.isFinite(valor) || (campo.startsWith("id_") && valor <= 0) || (!campo.startsWith("id_") && valor < 0)) {
                    return res.status(400).json({ success: false, message: `El valor de ${campo} no es válido.` });
                }
            }
        }

        valores.push(id);
        const [resultado] = await conmysql.query(`
            UPDATE pagos_repartidor SET ${campos.join(", ")}
            WHERE id_pago_repartidor = ?
        `, valores);

        if (!resultado.affectedRows) return res.status(404).json({ success: false, message: "No se pudo actualizar el pago." });

        const pagoActualizado = await obtenerPagoPorIdInterno(id);
        return res.json({ success: true, message: "Pago del repartidor actualizado correctamente.", pago: pagoActualizado });
    } catch (error) {
        console.error("[PagosRepartidor] Error putPagosRepartidor:", error);
        return res.status(500).json({ success: false, message: "Error al actualizar el pago del repartidor" });
    }
};

// PATCH reutiliza la lógica de PUT.
export const patchPagosRepartidor = async (req, res) => putPagosRepartidor(req, res);

// Elimina un pago. Solo ADMINISTRADOR.
export const deletePagosRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        if (!esIdValido(id)) return res.status(400).json({ success: false, message: "El ID del pago no es válido." });
        if (!req.usuario) return res.status(401).json({ success: false, message: "Usuario no autenticado." });
        if (!tieneRol(req, ["ADMINISTRADOR"])) return res.status(403).json({ success: false, message: "Solo ADMINISTRADOR puede eliminar pagos del repartidor." });

        const pago = await obtenerPagoPorIdInterno(id);
        if (!pago) return res.status(404).json({ success: false, message: "Pago del repartidor no encontrado." });

        const [resultado] = await conmysql.query(`DELETE FROM pagos_repartidor WHERE id_pago_repartidor = ?`, [id]);
        if (!resultado.affectedRows) return res.status(404).json({ success: false, message: "No se pudo eliminar el pago." });

        return res.status(204).send();
    } catch (error) {
        console.error("[PagosRepartidor] Error deletePagosRepartidor:", error);
        return res.status(500).json({ success: false, message: "Error al eliminar el pago del repartidor" });
    }
};

// Crea automáticamente el pago cuando el pedido pasa a ENTREGADO (15).
// El repartidor recibe 95% de la carrera + 100% de la propina.
/* export const crearPagoRepartidorDesdePedido = async (id_pedido, conexion = conmysql) => {
    if (!Number.isInteger(Number(id_pedido)) || Number(id_pedido) <= 0) throw new Error("El ID del pedido no es válido.");

    const idPedido = Number(id_pedido);

    // Evita duplicados.
    const [pagosExistentes] = await conexion.query(`
        SELECT * FROM pagos_repartidor
        WHERE id_pedido = ?
        ORDER BY id_pago_repartidor DESC LIMIT 1
    `, [idPedido]);

    if (pagosExistentes.length) {
        console.log(`[PagosRepartidor] El pedido ${idPedido} ya tiene pago. No se duplica.`);
        return { creado: false, existente: true, pago: pagosExistentes[0] };
    }

    // Obtiene el pedido y su estado.
    const [pedidos] = await conexion.query(`
        SELECT p.id_pedido, p.pedido_codigo, p.id_repartidor, p.pedido_carrera,
               p.pedido_propina, p.id_estado, e.estado_nombre
        FROM pedidos p
        LEFT JOIN estados e ON p.id_estado = e.id_estado
        WHERE p.id_pedido = ? LIMIT 1
    `, [idPedido]);

    if (!pedidos.length) throw new Error("El pedido no existe.");

    const pedido = pedidos[0];
    if (!pedido.id_repartidor) throw new Error(`El pedido ${idPedido} no tiene un repartidor asociado.`);
    //if (Number(pedido.id_estado) !== 15) throw new Error(`El pago al repartidor solo puede generarse cuando el pedido está ENTREGADO (estado 15). Estado actual: ${pedido.id_estado}`);

    const estadoPedido = String(pedido.estado_nombre || "")
    .trim()
    .toUpperCase();

    if (estadoPedido !== "ENTREGADO") {
        throw new Error(
            `El pago al repartidor solo puede generarse cuando el pedido está ENTREGADO. Estado actual: ${estadoPedido || "SIN_ESTADO"}`
        );
    }

    // Calcula comisión, carrera neta y total.
    const carrera = Number(pedido.pedido_carrera ?? 0);
    const propina = Number(pedido.pedido_propina ?? 0);

    if (!Number.isFinite(carrera) || carrera < 0) throw new Error(`El pedido ${idPedido} tiene un valor de carrera inválido.`);
    if (!Number.isFinite(propina) || propina < 0) throw new Error(`El pedido ${idPedido} tiene un valor de propina inválido.`);

    const porcentajeComision = PORCENTAJE_COMISION_REPARTIDOR;
    const comisionCarrera = Number((carrera * porcentajeComision / 100).toFixed(2));
    const carreraNeta = Number((carrera - comisionCarrera).toFixed(2));
    const propinaRepartidor = Number(propina.toFixed(2));
    const otros = 0;
    const total = Number((carreraNeta + propinaRepartidor + otros).toFixed(2));

    if (!Number.isFinite(total) || total < 0) throw new Error(`El total del pago del repartidor para el pedido ${idPedido} es inválido.`);

    // Registra el pago como PENDIENTE.
    const [resultado] = await conexion.query(`
        INSERT INTO pagos_repartidor (
            id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
            pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
            pago_repartidor_estado, pago_repartidor_fecha_pago
        ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, NULL)
    `, [pedido.id_repartidor, pedido.id_pedido, carreraNeta, propinaRepartidor, otros, total, "PENDIENTE"]);

    const [pagoCreado] = await conexion.query(`
        SELECT * FROM pagos_repartidor
        WHERE id_pago_repartidor = ? LIMIT 1
    `, [resultado.insertId]);

    console.log("[PagosRepartidor] Pago creado automáticamente:", {
        id_pago_repartidor: resultado.insertId,
        id_pedido: pedido.id_pedido,
        id_repartidor: pedido.id_repartidor,
        carreraOriginal: carrera,
        porcentajeComision,
        comisionCarrera,
        carreraNeta,
        propina: propinaRepartidor,
        otros,
        total
    });

    return { creado: true, existente: false, pago: pagoCreado[0] };
}; */

export const crearPagoRepartidorDesdePedido = async (id_pedido, conexion = conmysql) => {
    // Validar ID y evitar duplicados
    if (!Number.isInteger(Number(id_pedido)) || Number(id_pedido) <= 0) throw new Error("El ID del pedido no es válido.");
    const idPedido = Number(id_pedido);

    const [pagosExistentes] = await conexion.query(`SELECT * FROM pagos_repartidor WHERE id_pedido = ? ORDER BY id_pago_repartidor DESC LIMIT 1`, [idPedido]);
    if (pagosExistentes.length) {
        console.log(`[PagosRepartidor] El pedido ${idPedido} ya tiene pago. No se duplica.`);
        return { creado: false, existente: true, pago: pagosExistentes[0] };
    }

    // Obtener pedido
    const [pedidos] = await conexion.query(`
        SELECT p.id_pedido, p.pedido_codigo, p.id_repartidor, p.pedido_carrera, p.pedido_propina, p.id_estado, e.estado_nombre
        FROM pedidos p LEFT JOIN estados e ON p.id_estado = e.id_estado WHERE p.id_pedido = ? LIMIT 1
    `, [idPedido]);
    if (!pedidos.length) throw new Error("El pedido no existe.");
    const pedido = pedidos[0];

    // Validar repartidor y estado
    if (!pedido.id_repartidor) throw new Error(`El pedido ${idPedido} no tiene un repartidor asociado.`);
    const estadoPedido = String(pedido.estado_nombre || "").trim().toUpperCase();
    if (estadoPedido !== "ENTREGADO") throw new Error(`El pago al repartidor solo puede generarse cuando el pedido está ENTREGADO. Estado actual: ${estadoPedido || "SIN_ESTADO"}`);

    // Obtener y validar valores
    const carrera = Number(pedido.pedido_carrera ?? 0);
    const propina = Number(pedido.pedido_propina ?? 0);
    if (!Number.isFinite(carrera) || carrera < 0) throw new Error(`El pedido ${idPedido} tiene una carrera inválida.`);
    if (!Number.isFinite(propina) || propina < 0) throw new Error(`El pedido ${idPedido} tiene una propina inválida.`);

    // Calcular pago
    const porcentajeComision = PORCENTAJE_COMISION_REPARTIDOR;
    const comisionCarrera = Number((carrera * porcentajeComision / 100).toFixed(2));
    const carreraNeta = Number((carrera - comisionCarrera).toFixed(2));
    const propinaRepartidor = Number(propina.toFixed(2));
    const otros = 0;
    const total = Number((carreraNeta + propinaRepartidor + otros).toFixed(2));
    if (!Number.isFinite(total) || total < 0) throw new Error(`El total del pago del repartidor para el pedido ${idPedido} es inválido.`);

    // Crear pago
    const [resultado] = await conexion.query(`
        INSERT INTO pagos_repartidor (id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera, pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total, pago_repartidor_estado, pago_repartidor_fecha_pago)
        VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, NULL)
    `, [pedido.id_repartidor, pedido.id_pedido, carreraNeta, propinaRepartidor, otros, total, "PENDIENTE"]);

    // Recuperar pago creado
    const [pagoCreado] = await conexion.query(`SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ? LIMIT 1`, [resultado.insertId]);

    console.log("[PagosRepartidor] Pago creado automáticamente:", {
        id_pago_repartidor: resultado.insertId, id_pedido: pedido.id_pedido, id_repartidor: pedido.id_repartidor,
        estado: estadoPedido, carreraOriginal: carrera, porcentajeComision, comisionCarrera, carreraNeta,
        propina: propinaRepartidor, otros, total
    });

    return { creado: true, existente: false, pago: pagoCreado[0] };
};

// Exportaciones auxiliares.
export {
    obtenerRol,
    obtenerIdUsuario,
    obtenerRepartidorDelUsuario,
    obtenerPagoPorIdInterno,
    esAdministrativo,
    tieneRol,
    PORCENTAJE_COMISION_REPARTIDOR
};
