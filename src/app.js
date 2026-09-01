// src/app.js

import express from "express";
import cors from "cors";
import { config } from "dotenv";

import rutasRoutes from "./routes/ruta.routes.js";
import trazabilidadRoutes from "./routes/trazabilidad.routes.js";
import mapapedidosRoutes from "./routes/mapapedidos.routes.js";

import authRoutes from "./routes/auth.routes.js";
import authlocalRoutes from "./routes/authlocal.routes.js";
import estadosRoutes from "./routes/estados.routes.js";
import repartidoresRoutes from "./routes/repartidores.routes.js";
import repartidorubicacionRoutes from "./routes/repartidorubicacion.routes.js";
import estadosrepartidorRoutes from "./routes/estadosrepartidor.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import localesRoutes from "./routes/locales.routes.js";
import localproductosRoutes from "./routes/localproductos.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";
import pedidodetallesRoutes from "./routes/pedidodetalles.routes.js";
import pedidorepartidoresRoutes from "./routes/pedidorepartidores.routes.js";
import pedidosseleccionrepartidorRoutes from "./routes/pedidosseleccionrepartidor.routes.js";
import pedidoobservacionesRoutes from "./routes/pedidoobservaciones.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import pagolocalesRoutes from "./routes/pagoslocales.routes.js";
import pagorepartidorRoutes from "./routes/pagosrepartidor.routes.js";
import billeterasRoutes from "./routes/billeteras.routes.js";
import metodospagoRoutes from "./routes/metodospago.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import usuariorolesRoutes from "./routes/usuarioroles.routes.js";
import provinciasRoutes from "./routes/provincias.routes.js";
import cantonesRoutes from "./routes/cantones.routes.js";

import { iniciarAsignacionAutomatica } from "./servicios/asignacionAutomatica.js";

config();

const app = express();

// MIDDLEWARES
app.use(express.json());

const corsOptions = {
    origin: "*",
    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ]
};

app.use(cors(corsOptions));

// RUTAS
app.use("/api/auth", authRoutes);
app.use("/api/authlocal", authlocalRoutes);

app.use("/api", rutasRoutes);
app.use("/api", trazabilidadRoutes);
app.use("/api", mapapedidosRoutes);

app.use("/api", clientesRoutes);
app.use("/api", estadosRoutes);
app.use("/api", repartidoresRoutes);
app.use("/api", repartidorubicacionRoutes);
app.use("/api", estadosrepartidorRoutes);
app.use("/api", usuariosRoutes);
app.use("/api", localesRoutes);
app.use("/api", localproductosRoutes);

app.use("/api", pedidosRoutes);
app.use("/api", pedidodetallesRoutes);
app.use("/api", pedidorepartidoresRoutes);
app.use("/api", pedidosseleccionrepartidorRoutes);
app.use("/api", pedidoobservacionesRoutes);

app.use("/api", productosRoutes);
app.use("/api", pagolocalesRoutes);
app.use("/api", pagorepartidorRoutes);
app.use("/api", billeterasRoutes);
app.use("/api", metodospagoRoutes);

app.use("/api", rolesRoutes);
app.use("/api", usuariorolesRoutes);
app.use("/api", provinciasRoutes);
app.use("/api", cantonesRoutes);

// PRUEBA API
app.get("/api", (req, res) => {
    res.json({
        success: true,
        mensaje: "API funcionando correctamente"
    });
});

// ENDPOINT NO ENCONTRADO
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Endpoint not found"
    });
});

iniciarAsignacionAutomatica();

export default app;
