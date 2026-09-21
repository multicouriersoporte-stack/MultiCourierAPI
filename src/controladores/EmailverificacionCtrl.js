import dns from "dns/promises";
import { conmysql } from "../db.js";
import { enviarCorreoCodigo } from "./Mailer.js";

const VIGENCIA_MINUTOS = 10;
const MAX_INTENTOS = 5;
const REENVIO_SEGUNDOS = 60;

const generarCodigo = () => String(Math.floor(100000 + Math.random() * 900000));

// Comprueba que el dominio del correo tenga registros MX (servidores de correo reales).
// Esto filtra dominios inventados como "direccioninvalida.com" sin necesidad de un
// servicio de terceros pago.
async function dominioTieneServidorDeCorreo(email) {
    const dominio = email.split("@")[1];
    try {
        const registros = await dns.resolveMx(dominio);
        return Array.isArray(registros) && registros.length > 0;
    } catch {
        return false;
    }
}

// Genera y envía un código de 6 dígitos al correo indicado.
export const enviarCodigoVerificacion = async (req, res) => {
    try {
        const email = req.body?.email?.trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "El correo es obligatorio" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
            return res.status(400).json({ message: "El correo electrónico no es válido" });

        const [existente] = await conmysql.query(
            `SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]
        );
        if (existente.length) return res.status(409).json({ message: "El correo electrónico ya está registrado" });

        const dominioValido = await dominioTieneServidorDeCorreo(email);
        if (!dominioValido)
            return res.status(400).json({ message: "El dominio del correo no existe o no recibe correos" });

        // Evita reenvíos inmediatos (protege contra abuso / spam del propio remitente).
        /* const [previo] = await conmysql.query(
            `SELECT creado_en FROM email_verificaciones WHERE email = ? LIMIT 1`, [email]
        );
        if (previo.length) {
            const segundos = (Date.now() - new Date(previo[0].creado_en).getTime()) / 1000;
            if (segundos < REENVIO_SEGUNDOS) {
                return res.status(429).json({
                    message: `Espera ${Math.ceil(REENVIO_SEGUNDOS - segundos)} segundos antes de reenviar el código`
                });
            }
        } */

        const [previo] = await conmysql.query(
            `SELECT creado_en FROM email_verificaciones WHERE email = ? LIMIT 1`,
            [email]
        );
        
        if (previo.length) {
            const creadoEn = new Date(previo[0].creado_en);
            const ahora = Date.now();
        
            const segundosTranscurridos = Math.floor(
                (ahora - creadoEn.getTime()) / 1000
            );
        
            console.log("creado_en:", creadoEn);
            console.log("Ahora:", new Date(ahora));
            console.log("Segundos transcurridos:", segundosTranscurridos);
        
            if (segundosTranscurridos < REENVIO_SEGUNDOS) {
                const restantes = REENVIO_SEGUNDOS - segundosTranscurridos;
        
                return res.status(429).json({
                    message: `Espera ${restantes} segundos antes de reenviar el código`,
                    segundosRestantes: restantes
                });
            }
        }

        const codigo = generarCodigo();
        const expiraEn = new Date(Date.now() + VIGENCIA_MINUTOS * 60000);

        await conmysql.query(
            `INSERT INTO email_verificaciones (email, codigo, expira_en, intentos, verificado, creado_en)
             VALUES (?, ?, ?, 0, 0, NOW())
             ON DUPLICATE KEY UPDATE codigo = VALUES(codigo), expira_en = VALUES(expira_en),
                                     intentos = 0, verificado = 0, creado_en = NOW()`,
            [email, codigo, expiraEn]
        );

        await enviarCorreoCodigo(email, codigo);

        return res.json({ success: true, message: "Código enviado correctamente" });
    } catch (error) {
        console.error("Error enviarCodigoVerificacion:", error);
        return res.status(500).json({ message: "No se pudo enviar el código de verificación" });
    }
};

// Valida el código de 6 dígitos ingresado por el usuario.
export const verificarCodigoEmail = async (req, res) => {
    try {
        const email = req.body?.email?.trim().toLowerCase();
        const codigo = req.body?.codigo?.trim();
        if (!email || !codigo) return res.status(400).json({ message: "Correo y código son obligatorios" });

        const [rows] = await conmysql.query(`SELECT * FROM email_verificaciones WHERE email = ? LIMIT 1`, [email]);
        if (!rows.length) return res.status(404).json({ message: "No se ha solicitado un código para este correo" });

        const registro = rows[0];
        if (registro.verificado) return res.json({ success: true, message: "El correo ya estaba verificado" });

        if (registro.intentos >= MAX_INTENTOS)
            return res.status(429).json({ message: "Se superó el número de intentos permitidos. Solicita un nuevo código" });

        if (new Date(registro.expira_en) < new Date())
            return res.status(400).json({ message: "El código ha expirado. Solicita uno nuevo" });

        if (registro.codigo !== codigo) {
            await conmysql.query(`UPDATE email_verificaciones SET intentos = intentos + 1 WHERE email = ?`, [email]);
            return res.status(400).json({ message: "El código ingresado es incorrecto" });
        }

        await conmysql.query(`UPDATE email_verificaciones SET verificado = 1 WHERE email = ?`, [email]);
        return res.json({ success: true, message: "Correo verificado correctamente" });
    } catch (error) {
        console.error("Error verificarCodigoEmail:", error);
        return res.status(500).json({ message: "No se pudo verificar el código" });
    }
};

// Uso interno desde registroCtrl.js: confirma que el correo fue verificado antes de crear la cuenta.
export const correoFueVerificado = async (email) => {
    const [rows] = await conmysql.query(
        `SELECT verificado FROM email_verificaciones WHERE email = ? AND verificado = 1 LIMIT 1`,
        [email.trim().toLowerCase()]
    );
    return rows.length > 0;
};

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: '-05:00'
});
