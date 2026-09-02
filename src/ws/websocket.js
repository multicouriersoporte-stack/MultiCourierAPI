const usuariosConectados = new Map();
const repartidoresConectados = new Map();

export const setupWebSocket = (io) => {
    io.on("connection", (socket) => {
        console.log("🟢 Cliente WebSocket conectado:", socket.id);

        // Identificación de usuarios y repartidores.
        socket.on("identificar_usuario", (data) => {
            const { usuario_id, tipo_usuario, nombre } = data || {};
            if (!usuario_id) return socket.emit("error_websocket", { success: false, mensaje: "usuario_id es obligatorio" });

            socket.usuario_id = usuario_id;
            socket.tipo_usuario = tipo_usuario;
            socket.nombre = nombre;
            usuariosConectados.set(String(usuario_id), socket.id);
            socket.join(`usuario_${usuario_id}`);

            console.log(`👤 Usuario ${usuario_id} conectado`);
            socket.emit("usuario_identificado", { success: true, socket_id: socket.id, usuario_id });
            io.emit("usuario_online", { usuario_id, tipo_usuario, nombre });
        });

        socket.on("identificar_repartidor", (data) => {
            const { repartidor_id, usuario_id, nombre } = data || {};
            if (!repartidor_id) return socket.emit("error_websocket", { success: false, mensaje: "repartidor_id es obligatorio" });

            socket.repartidor_id = repartidor_id;
            repartidoresConectados.set(String(repartidor_id), socket.id);
            socket.join(`repartidor_${repartidor_id}`);

            console.log(`🚚 Repartidor ${repartidor_id} conectado`);
            socket.emit("repartidor_identificado", { success: true, repartidor_id, socket_id: socket.id });
            socket.broadcast.emit("repartidor_online", { repartidor_id, usuario_id, nombre });
        });

        // Rooms de pedidos, locales y rutas.
        socket.on("unirse_pedido", ({ pedido_id } = {}) => {
            if (!pedido_id) return;
            socket.join(`pedido_${pedido_id}`);
            console.log(`📦 ${socket.id} unido al pedido_${pedido_id}`);
            socket.emit("pedido_room_unida", { success: true, pedido_id });
        });

        socket.on("salir_pedido", ({ pedido_id } = {}) => {
            if (!pedido_id) return;
            socket.leave(`pedido_${pedido_id}`);
            console.log(`📦 ${socket.id} salió del pedido_${pedido_id}`);
        });

        socket.on("unirse_local", ({ local_id } = {}) => {
            if (!local_id) return;
            socket.join(`local_${local_id}`);
            console.log(`🏪 ${socket.id} unido al local_${local_id}`);
            socket.emit("local_room_unida", { success: true, local_id });
        });

        socket.on("salir_local", ({ local_id } = {}) => {
            if (!local_id) return;
            socket.leave(`local_${local_id}`);
            console.log(`🏪 ${socket.id} salió del local_${local_id}`);
        });

        socket.on("unirse_ruta", ({ ruta_id } = {}) => {
            if (!ruta_id) return;
            socket.join(`ruta_${ruta_id}`);
            console.log(`🛣️ ${socket.id} unido a ruta_${ruta_id}`);
        });

        // Eventos relacionados con pedidos.
        socket.on("nuevo_pedido", (data) => {
            console.log("📦 Nuevo pedido:", data);
            io.emit("nuevo_pedido", data);
            if (data?.local_id) io.to(`local_${data.local_id}`).emit("nuevo_pedido_local", data);
        });

        socket.on("pedido_actualizado", (data) => {
            console.log("✏️ Pedido actualizado:", data);
            if (data?.pedido_id) {
                io.to(`pedido_${data.pedido_id}`).emit("pedido_actualizado", data);
            } else {
                socket.broadcast.emit("pedido_actualizado", data);
            }
            if (data?.local_id) io.to(`local_${data.local_id}`).emit("pedido_actualizado_local", data);
        });

        socket.on("pedido_estado_actualizado", (data) => {
            const { pedido_id, estado_id, estado, local_id } = data || {};
            console.log("🔄 Estado del pedido:", data);

            if (pedido_id) {
                io.to(`pedido_${pedido_id}`).emit("pedido_estado_actualizado", { pedido_id, estado_id, estado, local_id });
            }
            if (local_id) io.to(`local_${local_id}`).emit("pedido_estado_actualizado_local", data);
            socket.broadcast.emit("pedido_estado_actualizado", data);
        });

        socket.on("pedido_asignado", (data) => {
            const { pedido_id, repartidor_id, local_id } = data || {};
            console.log("🚚 Pedido asignado:", data);

            if (repartidor_id) io.to(`repartidor_${repartidor_id}`).emit("pedido_asignado", { pedido_id, repartidor_id });
            if (pedido_id) io.to(`pedido_${pedido_id}`).emit("pedido_asignado", data);
            if (local_id) io.to(`local_${local_id}`).emit("pedido_asignado_local", data);
            io.emit("pedido_asignado_global", data);
        });

        socket.on("pedido_entregado", (data) => {
            const { pedido_id, repartidor_id, local_id } = data || {};
            console.log("✅ Pedido entregado:", data);

            if (pedido_id) io.to(`pedido_${pedido_id}`).emit("pedido_entregado", data);
            if (repartidor_id) io.to(`repartidor_${repartidor_id}`).emit("pedido_entregado", data);
            if (local_id) io.to(`local_${local_id}`).emit("pedido_entregado_local", data);
            io.emit("pedido_entregado_global", data);
        });

        socket.on("pedido_cancelado", (data) => {
            const { pedido_id, local_id } = data || {};
            console.log("❌ Pedido cancelado:", data);

            if (pedido_id) io.to(`pedido_${pedido_id}`).emit("pedido_cancelado", data);
            if (local_id) io.to(`local_${local_id}`).emit("pedido_cancelado_local", data);
            io.emit("pedido_cancelado_global", data);
        });

        // Ubicación y estado del repartidor.
        socket.on("ubicacion_repartidor", (data) => {
            const { repartidor_id, latitud, longitud, pedido_id, ruta_id } = data || {};

            if (!repartidor_id || latitud === undefined || longitud === undefined) {
                return socket.emit("error_websocket", { success: false, mensaje: "Datos de ubicación incompletos" });
            }

            const ubicacion = { repartidor_id, latitud, longitud, pedido_id, ruta_id, fecha: new Date() };
            io.emit("ubicacion_repartidor_actualizada", ubicacion);
            if (pedido_id) io.to(`pedido_${pedido_id}`).emit("ubicacion_repartidor", ubicacion);
            if (ruta_id) io.to(`ruta_${ruta_id}`).emit("ubicacion_repartidor", ubicacion);
        });

        socket.on("estado_repartidor", (data) => {
            const { repartidor_id, estado_id, estado } = data || {};
            console.log("🚚 Estado repartidor:", data);
            io.emit("estado_repartidor_actualizado", { repartidor_id, estado_id, estado });
        });

        // Notificaciones dirigidas a usuarios y repartidores.
        socket.on("notificar_usuario", (data) => {
            const { usuario_id, titulo, mensaje, tipo, datos } = data || {};
            if (!usuario_id) return;
            io.to(`usuario_${usuario_id}`).emit("notificacion", { titulo, mensaje, tipo, datos, fecha: new Date() });
        });

        socket.on("notificar_repartidor", (data) => {
            const { repartidor_id, titulo, mensaje, tipo, datos } = data || {};
            if (!repartidor_id) return;
            io.to(`repartidor_${repartidor_id}`).emit("notificacion_repartidor", { titulo, mensaje, tipo, datos, fecha: new Date() });
        });

        // Trazabilidad y heartbeat.
        socket.on("trazabilidad_actualizada", (data) => {
            console.log("📊 Trazabilidad actualizada:", data);
            if (data?.pedido_id) io.to(`pedido_${data.pedido_id}`).emit("trazabilidad_actualizada", data);
            io.emit("trazabilidad_global", data);
        });

        socket.on("ping_cliente", () => socket.emit("pong_servidor", { fecha: new Date() }));

        // Limpia la conexión solo si el socket registrado sigue siendo este.
        socket.on("disconnect", (reason) => {
            console.log("🔴 Cliente WebSocket desconectado:", socket.id, reason);

            if (socket.usuario_id) {
                const id = String(socket.usuario_id);
                if (usuariosConectados.get(id) === socket.id) usuariosConectados.delete(id);
                io.emit("usuario_offline", { usuario_id: socket.usuario_id });
            }

            if (socket.repartidor_id) {
                const id = String(socket.repartidor_id);
                if (repartidoresConectados.get(id) === socket.id) repartidoresConectados.delete(id);
                io.emit("repartidor_offline", { repartidor_id: socket.repartidor_id });
            }
        });
    });

    console.log("📡 WebSocket configurado correctamente");
};

// Funciones auxiliares para emitir directamente a un room.
export const enviarAUsuario = (io, usuario_id, evento, data) => io.to(`usuario_${usuario_id}`).emit(evento, data);
export const enviarARepartidor = (io, repartidor_id, evento, data) => io.to(`repartidor_${repartidor_id}`).emit(evento, data);
export const enviarAPedido = (io, pedido_id, evento, data) => io.to(`pedido_${pedido_id}`).emit(evento, data);
export const enviarALocal = (io, local_id, evento, data) => io.to(`local_${local_id}`).emit(evento, data);
export const enviarARuta = (io, ruta_id, evento, data) => io.to(`ruta_${ruta_id}`).emit(evento, data);
