// src/index.js

import app from "./app.js";
import { PORT } from "./config.js";
import http from "http";
import { Server } from "socket.io";
import { setupWebSocket } from "./ws/websocket.js";

// Servidor HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

// IO global y configuración WebSocket
global._io = io;
setupWebSocket(io);

// Iniciar servidor
server.listen(PORT, () => {
    console.log("========================================");
    console.log("🚀 Servidor iniciado correctamente");
    console.log(`🌐 API + WebSocket: puerto ${PORT}`);
    console.log("📡 Socket.IO habilitado");
    console.log("☁️ Base de Datos en Clever Cloud");
    console.log("========================================");
});
