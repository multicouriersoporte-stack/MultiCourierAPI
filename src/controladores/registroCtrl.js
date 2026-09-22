/* import bcrypt from "bcrypt";
import { conmysql } from "../db.js";

// Rol asignado automáticamente al autorregistrarse como cliente.
const ID_ROL_CLIENTE = 1;

// Longitud del número secuencial en los códigos (CLIAABBXXXX / USRAABBXXXX).
const DIGITOS_SECUENCIA = 4;
const MAX_INTENTOS = 5;

const camposUsuario = `
    id_usuario, usuario_codigo, id_provincia, id_canton, usuario_cedula,
    usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email,
    usuario_telefono, usuario_foto, usuario_fecha_nacimiento, usuario_latitud,
    usuario_longitud, usuario_referencia, usuario_billetera, id_estado,
    usuario_fecha_registro, usuario_fecha_actualizacion
`;

// Genera el siguiente código disponible con formato PREFIJO+AA+BB+XXXX.
// Debe llamarse dentro de una transacción abierta (conn), para que el
// FOR UPDATE bloquee la fila y evite duplicados entre registros simultáneos.
async function generarSiguienteCodigo(conn, tabla, columna, prefijo, codProvincia, codCanton) {
    const patron = `${prefijo}${codProvincia}${codCanton}`;
    const [rows] = await conn.query(
        `SELECT ${columna} FROM ${tabla} WHERE ${columna} LIKE ? ORDER BY ${columna} DESC LIMIT 1 FOR UPDATE`,
        [`${patron}%`]
    );

    let siguiente = 1;
    if (rows.length) {
        const anterior = rows[0][columna];
        const numeroAnterior = parseInt(anterior.slice(patron.length), 10);
        if (Number.isFinite(numeroAnterior)) siguiente = numeroAnterior + 1;
    }

    const numeroFormateado = String(siguiente).padStart(DIGITOS_SECUENCIA, "0");
    return `${patron}${numeroFormateado}`;
}

// Obtiene los códigos (AA, BB) de provincia y cantón a partir de sus IDs.
async function obtenerCodigosUbicacion(conn, idProvincia, idCanton) {
    const [provincias] = await conn.query(
        `SELECT provincia_codigo FROM provincias WHERE id_provincia = ? LIMIT 1`, [idProvincia]
    );
    if (!provincias.length) throw { httpStatus: 400, message: "La provincia indicada no existe" };

    const [cantones] = await conn.query(
        `SELECT canton_codigo, id_provincia FROM cantones WHERE id_canton = ? LIMIT 1`, [idCanton]
    );
    if (!cantones.length) throw { httpStatus: 400, message: "El cantón indicado no existe" };
    if (Number(cantones[0].id_provincia) !== Number(idProvincia))
        throw { httpStatus: 400, message: "El cantón no pertenece a la provincia indicada" };

    return {
        codProvincia: provincias[0].provincia_codigo,
        codCanton: cantones[0].canton_codigo
    };
}

// Registro público de un CLIENTE: crea usuario + cliente + rol en una sola transacción.
export const registrarCliente = async (req, res) => {
    const {
        id_provincia, id_canton, usuario_nombre, usuario_apellido, usuario_email,
        usuario_telefono, usuario_password, usuario_referencia,
        usuario_latitud, usuario_longitud
    } = req.body;

    // Validaciones obligatorias.
    if (!id_provincia) return res.status(400).json({ message: "La provincia es obligatoria" });
    if (!id_canton) return res.status(400).json({ message: "El cantón es obligatorio" });
    if (!usuario_nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio" });
    if (!usuario_apellido?.trim()) return res.status(400).json({ message: "El apellido es obligatorio" });
    if (!usuario_email?.trim()) return res.status(400).json({ message: "El correo electrónico es obligatorio" });
    if (!usuario_password) return res.status(400).json({ message: "La contraseña es obligatoria" });
    if (usuario_password.length < 6) return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });

    // Normalizar datos.
    const nombre = usuario_nombre.trim();
    const apellido = usuario_apellido.trim();
    const email = usuario_email.trim().toLowerCase();
    const telefono = usuario_telefono?.trim() || null;
    const referencia = usuario_referencia?.trim() || null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ message: "El correo electrónico no es válido" });

    // Verificación de email fuera de la transacción, para responder rápido en el caso común.
    const [existente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]);
    if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

    const passwordHash = await bcrypt.hash(usuario_password, 10);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        let conn;
        try {
            conn = await conmysql.getConnection();
            await conn.beginTransaction();

            // Ubicación -> códigos AA/BB.
            const { codProvincia, codCanton } = await obtenerCodigosUbicacion(conn, id_provincia, id_canton);

            // Códigos secuenciales bajo bloqueo (evitan duplicados entre registros concurrentes).
            const usuarioCodigo = await generarSiguienteCodigo(conn, "usuarios", "usuario_codigo", "USR", codProvincia, codCanton);
            const clienteCodigo = await generarSiguienteCodigo(conn, "clientes", "cliente_codigo", "CLI", codProvincia, codCanton);

            // 1. Crear usuario.
            const [resultUsuario] = await conn.query(`
                INSERT INTO usuarios (
                    usuario_codigo, id_provincia, id_canton, usuario_nombre, usuario_apellido, usuario_email,
                    usuario_telefono, usuario_password, usuario_referencia,
                    usuario_latitud, usuario_longitud, id_estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                usuarioCodigo, id_provincia, id_canton, nombre, apellido, email, telefono,
                passwordHash, referencia, usuario_latitud ?? null, usuario_longitud ?? null, 1
            ]);
            const idUsuario = resultUsuario.insertId;

            // 2. Crear cliente asociado.
            await conn.query(
                `INSERT INTO clientes (id_usuario, cliente_codigo) VALUES (?, ?)`,
                [idUsuario, clienteCodigo]
            );

            // 3. Asignar el rol CLIENTE.
            await conn.query(
                `INSERT INTO usuario_roles (id_usuario, id_rol) VALUES (?, ?)`,
                [idUsuario, ID_ROL_CLIENTE]
            );

            await conn.commit();

            const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [idUsuario]);
            return res.status(201).json({ success: true, message: "Cuenta creada con éxito", usuario: rows[0] });
        } catch (error) {
            if (conn) await conn.rollback();

            // Choque de código único por carrera entre registros simultáneos: reintentar con código nuevo.
            const esChoqueDeCodigo = error.code === "ER_DUP_ENTRY" &&
                (error.sqlMessage?.includes("usuario_codigo") || error.sqlMessage?.includes("cliente_codigo"));
            if (esChoqueDeCodigo && intento < MAX_INTENTOS) continue;

            if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message });
            if (error.code === "ER_DUP_ENTRY")
                return res.status(409).json({ message: "Uno de los datos ya está registrado" });

            console.error("Error registrarCliente:", error);
            return res.status(500).json({ message: "Error al registrar la cuenta", error: error.message });
        } finally {
            if (conn) conn.release();
        }
    }
};
 */

import bcrypt from "bcrypt";
import { conmysql } from "../db.js";
import admin from "../config/firebaseAdmin.js"; // ajusta la ruta a donde guardes firebaseAdmin.js

// Rol asignado automáticamente al autorregistrarse como cliente.
const ID_ROL_CLIENTE = 1;

// Longitud del número secuencial en los códigos (CLIAABBXXXX / USRAABBXXXX).
const DIGITOS_SECUENCIA = 4;
const MAX_INTENTOS = 5;

const camposUsuario = `
    id_usuario, usuario_codigo, id_provincia, id_canton, usuario_cedula,
    usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email,
    usuario_telefono, usuario_foto, usuario_fecha_nacimiento, usuario_latitud,
    usuario_longitud, usuario_referencia, usuario_billetera, id_estado,
    usuario_fecha_registro, usuario_fecha_actualizacion
`;

// Genera el siguiente código disponible con formato PREFIJO+AA+BB+XXXX.
// Debe llamarse dentro de una transacción abierta (conn), para que el
// FOR UPDATE bloquee la fila y evite duplicados entre registros simultáneos.
async function generarSiguienteCodigo(conn, tabla, columna, prefijo, codProvincia, codCanton) {
    const patron = `${prefijo}${codProvincia}${codCanton}`;
    const [rows] = await conn.query(
        `SELECT ${columna} FROM ${tabla} WHERE ${columna} LIKE ? ORDER BY ${columna} DESC LIMIT 1 FOR UPDATE`,
        [`${patron}%`]
    );

    let siguiente = 1;
    if (rows.length) {
        const anterior = rows[0][columna];
        const numeroAnterior = parseInt(anterior.slice(patron.length), 10);
        if (Number.isFinite(numeroAnterior)) siguiente = numeroAnterior + 1;
    }

    const numeroFormateado = String(siguiente).padStart(DIGITOS_SECUENCIA, "0");
    return `${patron}${numeroFormateado}`;
}

// Obtiene los códigos (AA, BB) de provincia y cantón a partir de sus IDs.
async function obtenerCodigosUbicacion(conn, idProvincia, idCanton) {
    const [provincias] = await conn.query(
        `SELECT provincia_codigo FROM provincias WHERE id_provincia = ? LIMIT 1`, [idProvincia]
    );
    if (!provincias.length) throw { httpStatus: 400, message: "La provincia indicada no existe" };

    const [cantones] = await conn.query(
        `SELECT canton_codigo, id_provincia FROM cantones WHERE id_canton = ? LIMIT 1`, [idCanton]
    );
    if (!cantones.length) throw { httpStatus: 400, message: "El cantón indicado no existe" };
    if (Number(cantones[0].id_provincia) !== Number(idProvincia))
        throw { httpStatus: 400, message: "El cantón no pertenece a la provincia indicada" };

    return {
        codProvincia: provincias[0].provincia_codigo,
        codCanton: cantones[0].canton_codigo
    };
}

// Registro público de un CLIENTE: crea usuario + cliente + rol en una sola transacción.
export const registrarCliente = async (req, res) => {
    const {
        id_provincia, id_canton, usuario_nombre, usuario_apellido, usuario_email,
        usuario_telefono, usuario_password, usuario_referencia,
        usuario_latitud, usuario_longitud
    } = req.body;

    // Validaciones obligatorias.
    if (!id_provincia) return res.status(400).json({ message: "La provincia es obligatoria" });
    if (!id_canton) return res.status(400).json({ message: "El cantón es obligatorio" });
    if (!usuario_nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio" });
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(usuario_nombre.trim()))
        return res.status(400).json({ message: "El nombre solo puede contener letras" });
    if (usuario_nombre.trim().length > 100) return res.status(400).json({ message: "El nombre no puede superar 100 caracteres" });

    if (!usuario_apellido?.trim()) return res.status(400).json({ message: "El apellido es obligatorio" });
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(usuario_apellido.trim()))
        return res.status(400).json({ message: "El apellido solo puede contener letras" });
    if (usuario_apellido.trim().length > 100) return res.status(400).json({ message: "El apellido no puede superar 100 caracteres" });

    if (!usuario_email?.trim()) return res.status(400).json({ message: "El correo electrónico es obligatorio" });
    if (!usuario_password) return res.status(400).json({ message: "La contraseña es obligatoria" });
    if (usuario_password.length < 6) return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    if (usuario_password.length > 50) return res.status(400).json({ message: "La contraseña no puede superar 50 caracteres" });

    if (usuario_telefono && !/^[0-9]+$/.test(usuario_telefono.trim()))
        return res.status(400).json({ message: "El teléfono solo puede contener números" });
    if (usuario_telefono && usuario_telefono.trim().length > 13)
        return res.status(400).json({ message: "El teléfono no puede superar 13 dígitos" });

    // Normalizar datos.
    const nombre = usuario_nombre.trim();
    const apellido = usuario_apellido.trim();
    const email = usuario_email.trim().toLowerCase();
    const telefono = usuario_telefono?.trim() || null;
    const referencia = usuario_referencia?.trim() || null;

    if (email.length > 100) return res.status(400).json({ message: "El correo no puede superar 100 caracteres" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
        return res.status(400).json({ message: "El correo electrónico no es válido" });

    // Exige que el correo haya sido verificado en Firebase (link de verificación enviado
    // desde el frontend con sendEmailVerification). Reemplaza al viejo "interruptor" en MySQL.
    let usuarioFirebase;
    try {
        usuarioFirebase = await admin.auth().getUserByEmail(email);
    } catch {
        return res.status(400).json({ message: "Debes verificar tu correo electrónico antes de crear la cuenta" });
    }
    if (!usuarioFirebase.emailVerified)
        return res.status(400).json({ message: "Debes verificar tu correo electrónico antes de crear la cuenta" });

    // Verificación de email fuera de la transacción, para responder rápido en el caso común.
    const [existente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]);
    if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

    const passwordHash = await bcrypt.hash(usuario_password, 10);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        let conn;
        try {
            conn = await conmysql.getConnection();
            await conn.beginTransaction();

            // Ubicación -> códigos AA/BB.
            const { codProvincia, codCanton } = await obtenerCodigosUbicacion(conn, id_provincia, id_canton);

            // Códigos secuenciales bajo bloqueo (evitan duplicados entre registros concurrentes).
            const usuarioCodigo = await generarSiguienteCodigo(conn, "usuarios", "usuario_codigo", "USR", codProvincia, codCanton);
            const clienteCodigo = await generarSiguienteCodigo(conn, "clientes", "cliente_codigo", "CLI", codProvincia, codCanton);

            // 1. Crear usuario.
            const [resultUsuario] = await conn.query(`
                INSERT INTO usuarios (
                    usuario_codigo, id_provincia, id_canton, usuario_nombre, usuario_apellido, usuario_email,
                    usuario_telefono, usuario_password, usuario_referencia,
                    usuario_latitud, usuario_longitud, id_estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                usuarioCodigo, id_provincia, id_canton, nombre, apellido, email, telefono,
                passwordHash, referencia, usuario_latitud ?? null, usuario_longitud ?? null, 1
            ]);
            const idUsuario = resultUsuario.insertId;

            // 2. Crear cliente asociado.
            await conn.query(
                `INSERT INTO clientes (id_usuario, cliente_codigo) VALUES (?, ?)`,
                [idUsuario, clienteCodigo]
            );

            // 3. Asignar el rol CLIENTE.
            await conn.query(
                `INSERT INTO usuario_roles (id_usuario, id_rol) VALUES (?, ?)`,
                [idUsuario, ID_ROL_CLIENTE]
            );

            await conn.commit();

            // Borra el usuario temporal de Firebase; solo se usó para confirmar el correo,
            // no es el sistema de autenticación de MultiCourier (eso sigue siendo tu JWT propio).
            admin.auth().deleteUser(usuarioFirebase.uid).catch(() => {});

            const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [idUsuario]);
            return res.status(201).json({ success: true, message: "Cuenta creada con éxito", usuario: rows[0] });
        } catch (error) {
            if (conn) await conn.rollback();

            // Choque de código único por carrera entre registros simultáneos: reintentar con código nuevo.
            const esChoqueDeCodigo = error.code === "ER_DUP_ENTRY" &&
                (error.sqlMessage?.includes("usuario_codigo") || error.sqlMessage?.includes("cliente_codigo"));
            if (esChoqueDeCodigo && intento < MAX_INTENTOS) continue;

            if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message });
            if (error.code === "ER_DUP_ENTRY")
                return res.status(409).json({ message: "Uno de los datos ya está registrado" });

            console.error("Error registrarCliente:", error);
            return res.status(500).json({ message: "Error al registrar la cuenta", error: error.message });
        } finally {
            if (conn) conn.release();
        }
    }
};
