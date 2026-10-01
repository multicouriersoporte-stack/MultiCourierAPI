import { conmysql } from "../db.js";
import { obtenerLocalDelUsuario } from "./pedidosCtrl.js";
import { diaSemanaEC, diasEntre, fechaEC, parseRango, periodoAnterior, sumarDias } from "../utils/periodos.js";

const LIMITE_VENTAS = 1500;

const num = (n) => Number(n || 0);
const redondear = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;
const variacion = (actual, previo) => (num(previo) > 0 ? redondear(((num(actual) - num(previo)) / num(previo)) * 100) : null);

// Mismo criterio de visibilidad que getPedidos para LOCAL: no cuenta pedidos con transferencia/tarjeta sin confirmar.
const VISIBLE_LOCAL = `(p.pedido_pago_confirmado = 1 OR (UPPER(TRIM(COALESCE(mp.metodo_pago_nombre,''))) <> 'TRANSFERENCIA' AND COALESCE(p.id_metodo_pago,0) <> 3))`;
const ULTIMO_PAGO = `LEFT JOIN pagos_locales pl ON pl.id_pago_local = (SELECT MAX(x.id_pago_local) FROM pagos_locales x WHERE x.id_pedido = p.id_pedido)`;

const resolverLocal = async (req, res) => {
    const local = await obtenerLocalDelUsuario(req);
    if (!local) {
        res.status(403).json({ success: false, message: "El usuario autenticado no tiene un local asociado." });
        return null;
    }
    return local;
};

// ============================================================
// GET /ventas/mis-ventas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
// Ventas = pedidos ENTREGADOS del local, fechados por su entrega.
// ============================================================
export const getMisVentas = async (req, res) => {
    try {
        const local = await resolverLocal(req, res);
        if (!local) return;

        const rango = parseRango(req.query.desde, req.query.hasta, 366);
        if (rango.error) return res.status(400).json({ success: false, message: rango.error });

        const BASE = `
            FROM pedidos p
            INNER JOIN estados e ON e.id_estado = p.id_estado
            LEFT JOIN metodos_pago mp ON mp.id_metodo_pago = p.id_metodo_pago
            LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
            LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
            ${ULTIMO_PAGO}
            WHERE p.id_local = ? AND UPPER(TRIM(e.estado_nombre)) = 'ENTREGADO'
              AND p.pedido_fecha_entrega BETWEEN ? AND ? AND ${VISIBLE_LOCAL}`;
        const params = [local.id_local, rango.inicio, rango.fin];

        const [filas] = await conmysql.query(
            `SELECT p.id_pedido, p.pedido_codigo, p.pedido_fecha_entrega AS fecha_venta, p.pedido_cantidad_productos, p.pedido_subtotal_local,
                    mp.metodo_pago_nombre, u.usuario_nombre_completo AS cliente_nombre, c.cliente_codigo,
                    pl.id_pago_local, pl.pago_local_comision_porcentaje, pl.pago_local_comision, pl.pago_local_total, pl.pago_local_estado
             ${BASE} ORDER BY p.pedido_fecha_entrega DESC, p.id_pedido DESC LIMIT ${LIMITE_VENTAS}`, params);

        // Totales exactos sobre todo el periodo (aunque la lista se recorte)
        const [[totales]] = await conmysql.query(
            `SELECT COUNT(*) AS cantidad,
                    COALESCE(SUM(p.pedido_subtotal_local), 0) AS bruto,
                    COALESCE(SUM(CASE WHEN pl.id_pago_local IS NOT NULL THEN pl.pago_local_comision ELSE 0 END), 0) AS comision,
                    COALESCE(SUM(CASE WHEN pl.id_pago_local IS NOT NULL THEN pl.pago_local_total ELSE p.pedido_subtotal_local END), 0) AS neto,
                    COALESCE(SUM(CASE WHEN UPPER(TRIM(pl.pago_local_estado)) = 'PENDIENTE' THEN pl.pago_local_total ELSE 0 END), 0) AS por_cobrar
             ${BASE}`, params);

        const ventas = filas.map(r => {
            const tienePago = r.id_pago_local !== null && r.id_pago_local !== undefined;
            const subtotal = num(r.pedido_subtotal_local);
            return {
                id_pedido: r.id_pedido,
                pedido_codigo: r.pedido_codigo,
                fecha_venta: r.fecha_venta,
                cliente_nombre: r.cliente_nombre || r.cliente_codigo || "Cliente",
                metodo_pago: r.metodo_pago_nombre || "No especificado",
                cantidad_productos: num(r.pedido_cantidad_productos),
                subtotal: redondear(subtotal),
                comision_porcentaje: tienePago ? num(r.pago_local_comision_porcentaje) : 0,
                comision: tienePago ? redondear(r.pago_local_comision) : 0,
                neto: tienePago ? redondear(r.pago_local_total) : redondear(subtotal),
                pago_estado: tienePago ? String(r.pago_local_estado || "").trim().toUpperCase() : "SIN_REGISTRO"
            };
        });

        const cantidad = num(totales.cantidad);
        return res.json({
            success: true,
            desde: rango.desde,
            hasta: rango.hasta,
            truncado: cantidad > ventas.length,
            resumen: {
                cantidad,
                bruto: redondear(totales.bruto),
                comision: redondear(totales.comision),
                neto: redondear(totales.neto),
                por_cobrar: redondear(totales.por_cobrar),
                ticket_promedio: cantidad ? redondear(num(totales.bruto) / cantidad) : 0
            },
            ventas
        });
    } catch (error) {
        console.error("[Ventas] Error getMisVentas:", error);
        return res.status(500).json({ success: false, message: "Error al consultar las ventas del local." });
    }
};

// ============================================================
// GET /ventas/mi-rendimiento?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
// ============================================================
const pedidosDelPeriodo = async (idLocal, inicio, fin) => {
    const [rows] = await conmysql.query(
        `SELECT UPPER(TRIM(e.estado_nombre)) AS estado, p.pedido_subtotal_local, p.pedido_fecha_entrega,
                UPPER(TRIM(COALESCE(p.pedido_cancelado_por_rol, ''))) AS cancelado_por_rol,
                mp.metodo_pago_nombre, pl.id_pago_local, pl.pago_local_comision, pl.pago_local_total
         FROM pedidos p
         INNER JOIN estados e ON e.id_estado = p.id_estado
         LEFT JOIN metodos_pago mp ON mp.id_metodo_pago = p.id_metodo_pago
         ${ULTIMO_PAGO}
         WHERE p.id_local = ? AND ${VISIBLE_LOCAL}
           AND UPPER(TRIM(e.estado_nombre)) IN ('ENTREGADO', 'NO_ENTREGADO', 'CANCELADO')
           AND COALESCE(p.pedido_fecha_entrega, p.pedido_cancelado_fecha, p.pedido_fecha) BETWEEN ? AND ?`,
        [idLocal, inicio, fin]
    );
    return rows;
};

const calcularMetricas = (rows) => {
    const m = { entregados: 0, no_entregados: 0, cancelados: 0, cancelados_por_local: 0, cancelados_por_cliente: 0, ventas_brutas: 0, comision: 0, ventas_netas: 0 };
    for (const p of rows) {
        if (p.estado === "ENTREGADO") {
            const tienePago = p.id_pago_local !== null && p.id_pago_local !== undefined;
            m.entregados++;
            m.ventas_brutas += num(p.pedido_subtotal_local);
            m.comision += tienePago ? num(p.pago_local_comision) : 0;
            m.ventas_netas += tienePago ? num(p.pago_local_total) : num(p.pedido_subtotal_local);
        } else if (p.estado === "NO_ENTREGADO") {
            m.no_entregados++;
        } else if (p.estado === "CANCELADO") {
            m.cancelados++;
            if (p.cancelado_por_rol === "LOCAL") m.cancelados_por_local++;
            else if (p.cancelado_por_rol === "CLIENTE") m.cancelados_por_cliente++;
        }
    }
    const concluidos = m.entregados + m.no_entregados + m.cancelados;
    return {
        ...m,
        ventas_brutas: redondear(m.ventas_brutas),
        comision: redondear(m.comision),
        ventas_netas: redondear(m.ventas_netas),
        ticket_promedio: m.entregados ? redondear(m.ventas_brutas / m.entregados) : 0,
        pedidos_concluidos: concluidos,
        tasa_exito: concluidos ? redondear((m.entregados / concluidos) * 100) : null
    };
};

export const getMiRendimiento = async (req, res) => {
    try {
        const local = await resolverLocal(req, res);
        if (!local) return;

        const rango = parseRango(req.query.desde, req.query.hasta, 93);
        if (rango.error) return res.status(400).json({ success: false, message: rango.error });
        const anterior = periodoAnterior(rango);

        const [actuales, previos, [datosLocal], [topProductos]] = await Promise.all([
            pedidosDelPeriodo(local.id_local, rango.inicio, rango.fin),
            pedidosDelPeriodo(local.id_local, anterior.inicio, anterior.fin),
            conmysql.query(`SELECT local_nombre_comercial, local_calificacion, local_tiempo_preparacion_promedio FROM locales WHERE id_local = ? LIMIT 1`, [local.id_local]).then(r => r[0]),
            conmysql.query(
                `SELECT COALESCE(pr.producto_nombre, 'Producto') AS nombre, SUM(pd.pedido_detalle_cantidad) AS cantidad, SUM(pd.pedido_detalle_subtotal_local) AS total
                 FROM pedido_detalles pd
                 INNER JOIN pedidos p ON p.id_pedido = pd.id_pedido
                 INNER JOIN estados e ON e.id_estado = p.id_estado
                 LEFT JOIN metodos_pago mp ON mp.id_metodo_pago = p.id_metodo_pago
                 INNER JOIN local_productos lp ON lp.id_local_producto = pd.id_local_producto
                 LEFT JOIN productos pr ON pr.id_producto = lp.id_producto
                 WHERE p.id_local = ? AND UPPER(TRIM(e.estado_nombre)) = 'ENTREGADO'
                   AND p.pedido_fecha_entrega BETWEEN ? AND ? AND ${VISIBLE_LOCAL}
                 GROUP BY lp.id_local_producto, pr.producto_nombre
                 ORDER BY cantidad DESC, total DESC LIMIT 5`,
                [local.id_local, rango.inicio, rango.fin])
        ]);

        const metricas = calcularMetricas(actuales);
        const metricasPrevias = calcularMetricas(previos);
        const entregadosActuales = actuales.filter(p => p.estado === "ENTREGADO");

        // Ventas por día (rellena los días sin ventas con 0)
        const porDia = new Map();
        const porSemana = Array.from({ length: 7 }, (_, dia) => ({ dia, total: 0, pedidos: 0 }));
        const porMetodo = new Map();

        for (const p of entregadosActuales) {
            const neto = p.id_pago_local !== null && p.id_pago_local !== undefined ? num(p.pago_local_total) : num(p.pedido_subtotal_local);
            const fecha = fechaEC(p.pedido_fecha_entrega);
            const d = porDia.get(fecha) || { fecha, total: 0, pedidos: 0 };
            d.total += neto; d.pedidos++;
            porDia.set(fecha, d);

            const s = porSemana[diaSemanaEC(p.pedido_fecha_entrega)];
            s.total += neto; s.pedidos++;

            const nombre = p.metodo_pago_nombre || "No especificado";
            const mm = porMetodo.get(nombre) || { nombre, total: 0, pedidos: 0 };
            mm.total += neto; mm.pedidos++;
            porMetodo.set(nombre, mm);
        }

        const ventasPorDia = [];
        for (let i = 0; i < diasEntre(rango.desde, rango.hasta) + 1; i++) {
            const fecha = sumarDias(rango.desde, i);
            const d = porDia.get(fecha);
            ventasPorDia.push({ fecha, total: redondear(d?.total), pedidos: d?.pedidos ?? 0 });
        }

        return res.json({
            success: true,
            periodo: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
            local: {
                nombre: datosLocal?.[0]?.local_nombre_comercial ?? null,
                calificacion: datosLocal?.[0] ? num(datosLocal[0].local_calificacion) : null,
                tiempo_preparacion: datosLocal?.[0] ? num(datosLocal[0].local_tiempo_preparacion_promedio) : null
            },
            resumen: metricas,
            comparacion: {
                ventas_netas_pct: variacion(metricas.ventas_netas, metricasPrevias.ventas_netas),
                entregados_pct: variacion(metricas.entregados, metricasPrevias.entregados),
                ticket_promedio_pct: variacion(metricas.ticket_promedio, metricasPrevias.ticket_promedio),
                ventas_netas_previas: metricasPrevias.ventas_netas,
                entregados_previos: metricasPrevias.entregados
            },
            ventas_por_dia: ventasPorDia,
            ventas_por_dia_semana: porSemana.map(s => ({ ...s, total: redondear(s.total) })),
            metodos_pago: [...porMetodo.values()].map(m => ({ ...m, total: redondear(m.total) })).sort((a, b) => b.total - a.total),
            top_productos: topProductos.map(t => ({ nombre: t.nombre, cantidad: num(t.cantidad), total: redondear(t.total) }))
        });
    } catch (error) {
        console.error("[Ventas] Error getMiRendimiento:", error);
        return res.status(500).json({ success: false, message: "Error al consultar el rendimiento del local." });
    }
};