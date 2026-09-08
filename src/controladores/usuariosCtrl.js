/* import bcrypt from "bcrypt";
import { conmysql } from "../db.js";

// Campos públicos: excluye usuario_password.
const camposUsuario = `
    id_usuario, usuario_codigo, id_provincia, id_canton, usuario_cedula,
    usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email,
    usuario_telefono, usuario_foto, usuario_fecha_nacimiento, usuario_latitud,
    usuario_longitud, usuario_referencia, usuario_billetera, id_estado,
    usuario_fecha_registro, usuario_fecha_actualizacion
`;

// Obtener todos los usuarios.
export const getUsuarios = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios ORDER BY usuario_cedula ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getUsuarios:", error);
        return res.status(500).json({ message: "Error al consultar usuarios", error: error.message });
    }
};

// Obtener usuario por ID.
export const getUsuarioxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioxid:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener usuario por cédula.
export const getUsuarioPorCedula = async (req, res) => {
    try {
        const { cedula } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_cedula = ?`, [cedula]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCedula:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener usuario por email.
export const getUsuarioPorEmail = async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email).trim().toLowerCase();
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_email = ?`, [email]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorEmail:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener usuario por código.
export const getUsuarioPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_codigo = ?`, [codigo]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCodigo:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Obtener repartidor asociado al usuario.
export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM repartidores WHERE id_usuario = ?`, [id_usuario]);
        if (!result.length) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error del servidor", error: error.message });
    }
};

// Crear usuario. Solo CENTRAL y ADMINISTRADOR.
export const postUsuarios = async (req, res) => {
    try {
        const {
            usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre,
            usuario_apellido, usuario_email, usuario_telefono, usuario_password,
            usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud,
            usuario_referencia, usuario_billetera, id_estado
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
        const codigo = usuario_codigo?.trim() || null;
        const cedula = usuario_cedula?.trim() || null;
        const foto = usuario_foto?.trim() || null;
        const referencia = usuario_referencia?.trim() || null;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ message: "El correo electrónico no es válido" });

        // Validar saldo.
        let billetera = usuario_billetera ?? 0;
        if (typeof billetera !== "number" && typeof billetera !== "string")
            return res.status(400).json({ message: "El saldo de la billetera no es válido" });
        billetera = Number(billetera);
        if (!Number.isFinite(billetera) || billetera < 0)
            return res.status(400).json({ message: "El saldo de la billetera debe ser un número mayor o igual a 0" });

        const estado = id_estado ?? 1;

        // Verificar datos únicos.
        const [existenteEmail] = await conmysql.query(
            `SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]
        );
        if (existenteEmail.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

        if (cedula) {
            const [existenteCedula] = await conmysql.query(
                `SELECT id_usuario FROM usuarios WHERE usuario_cedula = ? LIMIT 1`, [cedula]
            );
            if (existenteCedula.length) return res.status(409).json({ message: "La cédula ya está registrada" });
        }

        if (codigo) {
            const [existenteCodigo] = await conmysql.query(
                `SELECT id_usuario FROM usuarios WHERE usuario_codigo = ? LIMIT 1`, [codigo]
            );
            if (existenteCodigo.length) return res.status(409).json({ message: "El código de usuario ya está registrado" });
        }

        // Encriptar contraseña e insertar usuario.
        const passwordHash = await bcrypt.hash(usuario_password, 10);
        const [result] = await conmysql.query(`
            INSERT INTO usuarios (
                usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre,
                usuario_apellido, usuario_email, usuario_telefono, usuario_password,
                usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud,
                usuario_referencia, usuario_billetera, id_estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            codigo, id_provincia, id_canton, cedula, nombre, apellido, email, telefono,
            passwordHash, foto, usuario_fecha_nacimiento || null, usuario_latitud ?? null,
            usuario_longitud ?? null, referencia, billetera, estado
        ]);

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [result.insertId]);
        return res.status(201).json({ success: true, message: "Usuario registrado con éxito", usuario: rows[0] });
    } catch (error) {
        console.error("Error postUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY")
            return res.status(409).json({ message: "Uno de los datos únicos ya está registrado" });
        return res.status(500).json({ message: "Error al registrar usuario", error: error.message });
    }
};

// Actualizar usuario completo. Solo CENTRAL y ADMINISTRADOR.
export const putUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre,
            usuario_apellido, usuario_email, usuario_telefono, usuario_password,
            usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud,
            usuario_referencia, usuario_billetera, id_estado
        } = req.body;

        // Buscar usuario actual.
        const [usuarios] = await conmysql.query(
            `SELECT id_usuario, usuario_password FROM usuarios WHERE id_usuario = ?`, [id]
        );
        if (!usuarios.length) return res.status(404).json({ message: "Usuario no encontrado" });

        // Validaciones obligatorias.
        if (!id_provincia) return res.status(400).json({ message: "La provincia es obligatoria" });
        if (!id_canton) return res.status(400).json({ message: "El cantón es obligatorio" });
        if (!usuario_nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio" });
        if (!usuario_apellido?.trim()) return res.status(400).json({ message: "El apellido es obligatorio" });
        if (!usuario_email?.trim()) return res.status(400).json({ message: "El correo electrónico es obligatorio" });

        // Normalizar datos.
        const nombre = usuario_nombre.trim();
        const apellido = usuario_apellido.trim();
        const email = usuario_email.trim().toLowerCase();
        const codigo = usuario_codigo?.trim() || null;
        const cedula = usuario_cedula?.trim() || null;
        const telefono = usuario_telefono?.trim() || null;
        const foto = usuario_foto?.trim() || null;
        const referencia = usuario_referencia?.trim() || null;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ message: "El correo electrónico no es válido" });

        // Validar saldo.
        let billetera = usuario_billetera ?? 0;
        if (typeof billetera !== "number" && typeof billetera !== "string")
            return res.status(400).json({ message: "El saldo de la billetera no es válido" });
        billetera = Number(billetera);
        if (!Number.isFinite(billetera) || billetera < 0)
            return res.status(400).json({ message: "El saldo de la billetera debe ser un número mayor o igual a 0" });

        // Verificar datos únicos.
        const [emailExistente] = await conmysql.query(
            `SELECT id_usuario FROM usuarios WHERE usuario_email = ? AND id_usuario <> ? LIMIT 1`, [email, id]
        );
        if (emailExistente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

        if (cedula) {
            const [cedulaExistente] = await conmysql.query(
                `SELECT id_usuario FROM usuarios WHERE usuario_cedula = ? AND id_usuario <> ? LIMIT 1`, [cedula, id]
            );
            if (cedulaExistente.length) return res.status(409).json({ message: "La cédula ya está registrada" });
        }

        if (codigo) {
            const [codigoExistente] = await conmysql.query(
                `SELECT id_usuario FROM usuarios WHERE usuario_codigo = ? AND id_usuario <> ? LIMIT 1`, [codigo, id]
            );
            if (codigoExistente.length) return res.status(409).json({ message: "El código de usuario ya está registrado" });
        }

        // Mantener o cambiar contraseña.
        let passwordFinal = usuarios[0].usuario_password;
        if (usuario_password !== undefined && usuario_password !== null) {
            if (typeof usuario_password !== "string" || usuario_password.length < 6)
                return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
            passwordFinal = await bcrypt.hash(usuario_password, 10);
        }

        // Actualizar usuario.
        await conmysql.query(`
            UPDATE usuarios SET
                usuario_codigo = ?, id_provincia = ?, id_canton = ?, usuario_cedula = ?,
                usuario_nombre = ?, usuario_apellido = ?, usuario_email = ?, usuario_telefono = ?,
                usuario_password = ?, usuario_foto = ?, usuario_fecha_nacimiento = ?,
                usuario_latitud = ?, usuario_longitud = ?, usuario_referencia = ?,
                usuario_billetera = ?, id_estado = ?, usuario_fecha_actualizacion = NOW()
            WHERE id_usuario = ?
        `, [
            codigo, id_provincia, id_canton, cedula, nombre, apellido, email, telefono,
            passwordFinal, foto, usuario_fecha_nacimiento || null, usuario_latitud ?? null,
            usuario_longitud ?? null, referencia, billetera, id_estado ?? 1, id
        ]);

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        return res.json({ success: true, message: "Usuario actualizado correctamente", usuario: rows[0] });
    } catch (error) {
        console.error("Error putUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY")
            return res.status(409).json({ message: "Uno de los datos únicos ya está registrado" });
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// Actualización parcial. Solo CENTRAL y ADMINISTRADOR.
export const patchUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            "usuario_nombre", "usuario_apellido", "usuario_email", "usuario_telefono",
            "usuario_foto", "usuario_fecha_nacimiento", "usuario_latitud", "usuario_longitud",
            "usuario_referencia", "usuario_billetera"
        ];
        const campos = [], valores = [];

        // Verificar existencia.
        const [usuario] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!usuario.length) return res.status(404).json({ message: "Usuario no encontrado" });

        // Construir actualización.
        for (const campo of camposPermitidos) {
            if (req.body[campo] === undefined) continue;
            let valor = req.body[campo];
            if (typeof valor === "string") valor = valor.trim();

            if (campo === "usuario_email") {
                if (!valor) return res.status(400).json({ message: "El correo electrónico no puede estar vacío" });
                valor = valor.toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))
                    return res.status(400).json({ message: "El correo electrónico no es válido" });
            }

            if (campo === "usuario_billetera") {
                if (typeof valor !== "number" && typeof valor !== "string")
                    return res.status(400).json({ message: "El saldo de la billetera no es válido" });
                valor = Number(valor);
                if (!Number.isFinite(valor) || valor < 0)
                    return res.status(400).json({ message: "El saldo de la billetera debe ser un número mayor o igual a 0" });
            }

            campos.push(`${campo} = ?`);
            valores.push(valor === "" ? null : valor);
        }

        if (!campos.length)
            return res.status(400).json({ message: "No se proporcionaron campos válidos para actualizar" });

        // Verificar email duplicado.
        if (req.body.usuario_email !== undefined) {
            const email = req.body.usuario_email.trim().toLowerCase();
            const [existente] = await conmysql.query(
                `SELECT id_usuario FROM usuarios WHERE usuario_email = ? AND id_usuario <> ? LIMIT 1`, [email, id]
            );
            if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        }

        campos.push("usuario_fecha_actualizacion = NOW()");
        valores.push(id);

        // Ejecutar actualización.
        await conmysql.query(`UPDATE usuarios SET ${campos.join(", ")} WHERE id_usuario = ?`, valores);

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        return res.json({ success: true, message: "Usuario actualizado correctamente", usuario: rows[0] });
    } catch (error) {
        console.error("Error patchUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY")
            return res.status(409).json({ message: "El correo electrónico o dato único ya está registrado" });
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// Eliminar usuario. Solo CENTRAL y ADMINISTRADOR.
export const deleteUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteUsuarios:", error);
        if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED")
            return res.status(409).json({ message: "No se puede eliminar el usuario porque tiene registros relacionados" });
        return res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
    }
};
 */


import bcrypt from "bcrypt";
import { conmysql } from "../db.js";

// Campos públicos; excluye usuario_password.
const camposUsuario = `id_usuario, usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_nombre_completo, usuario_email, usuario_telefono, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado, usuario_fecha_registro, usuario_fecha_actualizacion`;

// GET: todos los usuarios.
export const getUsuarios = async (req, res) => {
    try {
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios ORDER BY usuario_cedula ASC`);
        return res.json(result);
    } catch (error) {
        console.error("Error getUsuarios:", error);
        return res.status(500).json({ message: "Error al consultar usuarios", error: error.message });
    }
};

// GET: usuario por ID.
export const getUsuarioxid = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioxid:", error);
        return res.status(500).json({ message: "Error al consultar usuario", error: error.message });
    }
};

// GET: usuario por cédula.
export const getUsuarioPorCedula = async (req, res) => {
    try {
        const { cedula } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_cedula = ?`, [cedula]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCedula:", error);
        return res.status(500).json({ message: "Error al consultar usuario", error: error.message });
    }
};

// GET: usuario por email.
export const getUsuarioPorEmail = async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email).trim().toLowerCase();
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_email = ?`, [email]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorEmail:", error);
        return res.status(500).json({ message: "Error al consultar usuario", error: error.message });
    }
};

// GET: usuario por código.
export const getUsuarioPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const [result] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE usuario_codigo = ?`, [codigo]);
        if (!result.length) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getUsuarioPorCodigo:", error);
        return res.status(500).json({ message: "Error al consultar usuario", error: error.message });
    }
};

// GET: repartidor asociado al usuario.
export const getRepartidorPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const [result] = await conmysql.query(`SELECT * FROM repartidores WHERE id_usuario = ?`, [id_usuario]);
        if (!result.length) return res.status(404).json({ message: "No existe un repartidor asociado a este usuario" });
        return res.json(result[0]);
    } catch (error) {
        console.error("Error getRepartidorPorUsuario:", error);
        return res.status(500).json({ message: "Error al consultar repartidor", error: error.message });
    }
};

// POST: crear usuario.
export const postUsuarios = async (req, res) => {
    try {
        const { usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado } = req.body;

        // Validar datos obligatorios.
        if (!usuario_nombre || !usuario_apellido || !usuario_email || !usuario_password)
            return res.status(400).json({ message: "Nombre, apellido, correo y contraseña son obligatorios" });

        if (typeof usuario_password !== "string" || usuario_password.length < 6)
            return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });

        const codigo = usuario_codigo?.trim() || null;
        const cedula = usuario_cedula?.trim() || null;
        const nombre = usuario_nombre.trim();
        const apellido = usuario_apellido.trim();
        const email = usuario_email.trim().toLowerCase();
        const telefono = usuario_telefono?.trim() || null;
        const foto = usuario_foto?.trim() || null;
        const referencia = usuario_referencia?.trim() || null;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ message: "El correo electrónico no es válido" });

        const estado = id_estado ?? 1;

        // Validar campos únicos.
        const [existenteEmail] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]);
        if (existenteEmail.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

        if (cedula) {
            const [existenteCedula] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_cedula = ? LIMIT 1`, [cedula]);
            if (existenteCedula.length) return res.status(409).json({ message: "La cédula ya está registrada" });
        }

        if (codigo) {
            const [existenteCodigo] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_codigo = ? LIMIT 1`, [codigo]);
            if (existenteCodigo.length) return res.status(409).json({ message: "El código de usuario ya está registrado" });
        }

        // Generar hash e insertar usuario.
        const passwordHash = await bcrypt.hash(usuario_password, 10);
        const [result] = await conmysql.query(
            `INSERT INTO usuarios (usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [codigo, id_provincia, id_canton, cedula, nombre, apellido, email, telefono, passwordHash, foto, usuario_fecha_nacimiento || null, usuario_latitud ?? null, usuario_longitud ?? null, referencia, estado]
        );

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [result.insertId]);
        return res.status(201).json({ success: true, message: "Usuario registrado con éxito", usuario: rows[0] });
    } catch (error) {
        console.error("Error postUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Uno de los datos únicos ya está registrado" });
        return res.status(500).json({ message: "Error al registrar usuario", error: error.message });
    }
};

// PUT: actualizar usuario completo.
export const putUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario_codigo, id_provincia, id_canton, usuario_cedula, usuario_nombre, usuario_apellido, usuario_email, usuario_telefono, usuario_password, usuario_foto, usuario_fecha_nacimiento, usuario_latitud, usuario_longitud, usuario_referencia, id_estado } = req.body;

        const [usuarios] = await conmysql.query(`SELECT id_usuario, usuario_password FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!usuarios.length) return res.status(404).json({ message: "Usuario no encontrado" });

        if (!usuario_nombre || !usuario_apellido || !usuario_email)
            return res.status(400).json({ message: "Nombre, apellido y correo son obligatorios" });

        const codigo = usuario_codigo?.trim() || null;
        const cedula = usuario_cedula?.trim() || null;
        const nombre = usuario_nombre.trim();
        const apellido = usuario_apellido.trim();
        const email = usuario_email.trim().toLowerCase();
        const telefono = usuario_telefono?.trim() || null;
        const foto = usuario_foto?.trim() || null;
        const referencia = usuario_referencia?.trim() || null;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ message: "El correo electrónico no es válido" });

        // Validar campos únicos.
        const [emailExistente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? AND id_usuario <> ? LIMIT 1`, [email, id]);
        if (emailExistente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

        if (cedula) {
            const [cedulaExistente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_cedula = ? AND id_usuario <> ? LIMIT 1`, [cedula, id]);
            if (cedulaExistente.length) return res.status(409).json({ message: "La cédula ya está registrada" });
        }

        if (codigo) {
            const [codigoExistente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_codigo = ? AND id_usuario <> ? LIMIT 1`, [codigo, id]);
            if (codigoExistente.length) return res.status(409).json({ message: "El código de usuario ya está registrado" });
        }

        // Mantener o actualizar contraseña.
        let passwordFinal = usuarios[0].usuario_password;
        if (usuario_password !== undefined && usuario_password !== null) {
            if (typeof usuario_password !== "string" || usuario_password.length < 6)
                return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
            passwordFinal = await bcrypt.hash(usuario_password, 10);
        }

        await conmysql.query(
            `UPDATE usuarios SET usuario_codigo = ?, id_provincia = ?, id_canton = ?, usuario_cedula = ?, usuario_nombre = ?, usuario_apellido = ?, usuario_email = ?, usuario_telefono = ?, usuario_password = ?, usuario_foto = ?, usuario_fecha_nacimiento = ?, usuario_latitud = ?, usuario_longitud = ?, usuario_referencia = ?, id_estado = ?, usuario_fecha_actualizacion = NOW() WHERE id_usuario = ?`,
            [codigo, id_provincia, id_canton, cedula, nombre, apellido, email, telefono, passwordFinal, foto, usuario_fecha_nacimiento || null, usuario_latitud ?? null, usuario_longitud ?? null, referencia, id_estado ?? 1, id]
        );

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        return res.json({ success: true, message: "Usuario actualizado correctamente", usuario: rows[0] });
    } catch (error) {
        console.error("Error putUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Uno de los datos únicos ya está registrado" });
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// PATCH: actualizar parcialmente campos permitidos.
export const patchUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = ["usuario_nombre", "usuario_apellido", "usuario_email", "usuario_telefono", "usuario_foto", "usuario_fecha_nacimiento", "usuario_latitud", "usuario_longitud", "usuario_referencia"];

        const [usuario] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE id_usuario = ?`, [id]);
        if (!usuario.length) return res.status(404).json({ message: "Usuario no encontrado" });

        const campos = [], valores = [];

        // Construir UPDATE dinámico.
        for (const campo of camposPermitidos) {
            if (req.body[campo] === undefined) continue;
            let valor = req.body[campo];
            if (typeof valor === "string") valor = valor.trim();

            if (campo === "usuario_email") {
                if (!valor) return res.status(400).json({ message: "El correo electrónico no puede estar vacío" });
                valor = valor.toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))
                    return res.status(400).json({ message: "El correo electrónico no es válido" });
            }

            campos.push(`${campo} = ?`);
            valores.push(valor === "" ? null : valor);
        }

        if (!campos.length)
            return res.status(400).json({ message: "No se proporcionaron campos válidos para actualizar" });

        // Validar email único.
        if (req.body.usuario_email !== undefined) {
            const email = req.body.usuario_email.trim().toLowerCase();
            const [existente] = await conmysql.query(`SELECT id_usuario FROM usuarios WHERE usuario_email = ? AND id_usuario <> ? LIMIT 1`, [email, id]);
            if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });
        }

        campos.push("usuario_fecha_actualizacion = NOW()");
        valores.push(id);

        await conmysql.query(`UPDATE usuarios SET ${campos.join(", ")} WHERE id_usuario = ?`, valores);

        const [rows] = await conmysql.query(`SELECT ${camposUsuario} FROM usuarios WHERE id_usuario = ?`, [id]);
        return res.json({ success: true, message: "Usuario actualizado correctamente", usuario: rows[0] });
    } catch (error) {
        console.error("Error patchUsuarios:", error);
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "El correo electrónico o dato único ya está registrado" });
        return res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
    }
};

// DELETE: eliminar usuario.
export const deleteUsuarios = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(`DELETE FROM usuarios WHERE id_usuario = ?`, [id]);

        if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.status(204).send();
    } catch (error) {
        console.error("Error deleteUsuarios:", error);
        if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED")
            return res.status(409).json({ message: "No se puede eliminar el usuario porque tiene registros relacionados" });
        return res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
    }
};
