// pedidoService.js — Consultas de pedido necesarias para el módulo Balance.
import { conmysql } from "../db.js";

/**
 * Obtener pedido con método de pago. Solo campos necesarios para Balance.
 */
export async function obtenerPedidoParaBalance(conexion, id_pedido) {
    const [rows] = await (
        conexion || conmysql
    ).query(
        `SELECT
       p.id_pedido,
       p.pedido_codigo,
       p.pedido_total,
       p.id_repartidor,
       mp.metodo_pago_nombre,
       e.estado_nombre
     FROM pedidos p
     LEFT JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
     LEFT JOIN estados e ON p.id_estado = e.id_estado
     WHERE p.id_pedido = ? LIMIT 1`,
        [id_pedido]
    );
    return rows.length ? rows[0] : null;
}

/**
 * Verificar si el método de pago del pedido es "EFECTIVO" (case-insensitive).
 */
export function esPedidoEfectivo(pedido) {
    if (!pedido) return false;
    return String(pedido.metodo_pago_nombre || "").trim().toUpperCase() === "EFECTIVO";
}