// src/routes/pedidos.routes.js

import express from "express";

import {
    getPedidos,
    getPedidoPorId,
    getPedidosPorCliente,
    getPedidosPorLocal,
    getPedidoPorCodigo,
    getPedidosPorEstado,
    postPedido,
    putPedido,
    patchPedido,
    deletePedido
} from "../controladores/pedidosCtrl.js";

import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// =====================================================
// CONSULTAS ADMIN
// IMPORTANTE: antes de /pedidos/:id
// =====================================================

router.get(
    "/pedidos/admin",
    verificarToken,
    permitirRoles(
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    getPedidos
);

// =====================================================
// CONSULTAS
// =====================================================

router.get(
    "/pedidos",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "REPARTIDOR"
    ),
    getPedidos
);

router.get(
    "/pedidos/codigo/:codigo",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "REPARTIDOR"
    ),
    getPedidoPorCodigo
);

router.get(
    "/pedidos/estado/:id_estado",
    verificarToken,
    permitirRoles(
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    getPedidosPorEstado
);

router.get(
    "/pedidos/cliente/:id_cliente",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    getPedidosPorCliente
);

router.get(
    "/clientes/:id_cliente/pedidos",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    getPedidosPorCliente
);

// =====================================================
// PEDIDOS POR LOCAL
// =====================================================

router.get(
    "/pedidos/local/:id_local",
    verificarToken,
    permitirRoles(
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    getPedidosPorLocal
);

// =====================================================
// PEDIDO POR ID
// IMPORTANTE: después de las rutas estáticas
// =====================================================

router.get(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "REPARTIDOR"
    ),
    getPedidoPorId
);

// =====================================================
// CREAR
// =====================================================

router.post(
    "/pedidos",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    postPedido
);

// =====================================================
// ACTUALIZAR
// =====================================================

router.put(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    putPedido
);

router.patch(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    patchPedido
);

// =====================================================
// ELIMINAR
// =====================================================

router.delete(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "SUPERVISOR",
        "SOPORTE"
    ),
    deletePedido
);

export default router;
