// src/routes/pedidos.routes.js

import express from "express";

import {
    getPedidos,
    getPedidoPorId,
    getPedidosPorCliente,
    getPedidosPorLocal,
    getPedidoPorCodigo,
    getPedidosPorEstado,
    getTodosLosPedidosAdmin,
    postPedido,
    putPedido,
    patchPedido,
    deletePedido
} from "../controladores/pedidosCtrl.js";

import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// ============================================================
// CONSULTAS GENERALES
// ============================================================

// Cada rol recibe únicamente los pedidos que le corresponden.
router.get(
    "/pedidos",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR",
        "REPARTIDOR"
    ),
    getPedidos
);

// Buscar por código.
router.get(
    "/pedidos/codigo/:codigo",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR",
        "REPARTIDOR"
    ),
    getPedidoPorCodigo
);

// Buscar por estado: solamente administración.
router.get(
    "/pedidos/estado/:id_estado",
    verificarToken,
    permitirRoles(
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    getPedidosPorEstado
);

// Pedidos de un cliente.
router.get(
    "/pedidos/cliente/:id_cliente",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
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
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    getPedidosPorCliente
);

// Pedidos de un local.
router.get(
    "/pedidos/local/:id_local",
    verificarToken,
    permitirRoles(
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    getPedidosPorLocal
);

// Pedido individual.
router.get(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR",
        "REPARTIDOR"
    ),
    getPedidoPorId
);

// ============================================================
// ADMINISTRACIÓN
// ============================================================

// IMPORTANTE:
// Esta ruta utiliza getTodosLosPedidosAdmin.
// Un CLIENTE ni siquiera puede entrar aquí porque
// permitirRoles lo bloquea.
router.get(
    "/pedidos/admin",
    verificarToken,
    permitirRoles(
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    getTodosLosPedidosAdmin
);

// ============================================================
// CREAR
// ============================================================

router.post(
    "/pedidos",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    postPedido
);

// ============================================================
// ACTUALIZAR
// ============================================================

router.put(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    putPedido
);

router.patch(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "CLIENTE",
        "LOCAL",
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    patchPedido
);

// ============================================================
// ELIMINAR
// ============================================================

router.delete(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
        "SUPERVISOR",
        "SOPORTE",
        "ADMINISTRADOR"
    ),
    deletePedido
);

export default router;
