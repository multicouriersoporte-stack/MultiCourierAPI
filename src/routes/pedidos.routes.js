/* // src/routes/pedidos.routes.js

import express from "express";
import {
    getPedidos, getPedidoPorId, getPedidosPorCliente, getPedidosPorLocal, getPedidoPorCodigo,
    getPedidosPorEstado, postPedido, putPedido, patchPedido, deletePedido
} from "../controladores/pedidosCtrl.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { permitirRoles } from "../middlewares/roles.middleware.js";

const router = express.Router();

// Consultas de pedidos
router.get("/pedidos", verificarToken, permitirRoles("CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidos);
router.get("/pedidos/codigo/:codigo", verificarToken, permitirRoles("CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidoPorCodigo);
router.get("/pedidos/estado/:id_estado", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidosPorEstado); // Solo administrativos
router.get("/pedidos/cliente/:id_cliente", verificarToken, permitirRoles("CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidosPorCliente);
router.get("/clientes/:id_cliente/pedidos", verificarToken, permitirRoles("CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidosPorCliente);
router.get("/pedidos/local/:id_local", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidosPorLocal); // Solo administrativos
router.get("/pedidos/:id", verificarToken, permitirRoles("CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE"), getPedidoPorId);

// Operaciones CRUD
router.post("/pedidos", verificarToken, permitirRoles("CLIENTE", "CENTRAL", "SUPERVISOR", "SOPORTE"), postPedido);
router.put("/pedidos/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"), putPedido);
router.patch("/pedidos/:id", verificarToken, permitirRoles("CENTRAL", "SUPERVISOR", "SOPORTE"), patchPedido);
router.delete("/pedidos/:id", verificarToken, permitirRoles("SUPERVISOR", "SOPORTE"), deletePedido);

export default router;
 */


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

// ---------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// CREAR
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// ACTUALIZAR
// ---------------------------------------------------------

router.put(
    "/pedidos/:id",
    verificarToken,
    permitirRoles(
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
        "CENTRAL",
        "SUPERVISOR",
        "SOPORTE"
    ),
    patchPedido
);

// ---------------------------------------------------------
// ELIMINAR
// ---------------------------------------------------------

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
