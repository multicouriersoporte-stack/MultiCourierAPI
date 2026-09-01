import { conmysql } from "../db.js";

// Comisión descontada de la carrera del repartidor.
const PORCENTAJE_COMISION_REPARTIDOR = 5;

/**
 * Crea el pago del repartidor cuando el pedido está ENTREGADO (15).
 * Recibe 95% de la carrera + 100% de la propina. Es idempotente.
 */
export const crearPagoRepartidorDesdePedido = async (id_pedido, conexion = conmysql) => {
    if (!Number.isInteger(Number(id_pedido)) || Number(id_pedido) <= 0) throw new Error("El ID del pedido no es válido.");
    const idPedido = Number(id_pedido);

    // Evitar pagos duplicados.
    const [pagosExistentes] = await conexion.query(
        `SELECT * FROM pagos_repartidor WHERE id_pedido = ? ORDER BY id_pago_repartidor DESC LIMIT 1`,
        [idPedido]
    );
    if (pagosExistentes.length) {
        console.log(`[PagosRepartidor] El pedido ${idPedido} ya tiene pago. No se duplica.`);
        return { creado: false, existente: true, pago: pagosExistentes[0] };
    }

    // Obtener pedido y estado actual.
    const [pedidos] = await conexion.query(
        `SELECT p.id_pedido, p.pedido_codigo, p.id_repartidor, p.pedido_carrera, p.pedido_propina, p.id_estado, e.estado_nombre
         FROM pedidos p LEFT JOIN estados e ON p.id_estado = e.id_estado WHERE p.id_pedido = ? LIMIT 1`,
        [idPedido]
    );
    if (!pedidos.length) throw new Error("El pedido no existe.");
    const pedido = pedidos[0];

    // Validar repartidor y estado ENTREGADO.
    if (!pedido.id_repartidor) throw new Error(`El pedido ${idPedido} no tiene un repartidor asociado.`);
    if (Number(pedido.id_estado) !== 15) {
        throw new Error(`El pago al repartidor solo puede generarse cuando el pedido está ENTREGADO (estado 15). Estado actual: ${pedido.id_estado}`);
    }

    // Validar y calcular valores del pago.
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
    if (!Number.isFinite(total) || total < 0) {
        throw new Error(`El total del pago del repartidor para el pedido ${idPedido} es inválido.`);
    }

    // Registrar el pago como pendiente.
    const estadoPago = "PENDIENTE";
    const [resultado] = await conexion.query(
        `INSERT INTO pagos_repartidor (
            id_repartidor, id_pedido, pago_repartidor_fecha, pago_repartidor_carrera,
            pago_repartidor_propina, pago_repartidor_otros, pago_repartidor_total,
            pago_repartidor_estado, pago_repartidor_fecha_pago
        ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, NULL)`,
        [pedido.id_repartidor, pedido.id_pedido, carreraNeta, propinaRepartidor, otros, total, estadoPago]
    );

    // Retornar el pago recién creado.
    const [pagoCreado] = await conexion.query(
        `SELECT * FROM pagos_repartidor WHERE id_pago_repartidor = ? LIMIT 1`,
        [resultado.insertId]
    );

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
};
