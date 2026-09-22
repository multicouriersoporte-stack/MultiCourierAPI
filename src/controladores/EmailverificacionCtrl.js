import dns from "dns/promises";
import { conmysql } from "../db.js";
import { enviarCorreoCodigo } from "./Mailer.js";

const VIGENCIA_MINUTOS = 10;
const MAX_INTENTOS = 5;
const REENVIO_SEGUNDOS = 60;

const generarCodigo = () => String(Math.floor(100000 + Math.random() * 900000));

// Comprueba que el dominio del correo tenga registros MX (servidores de correo reales).
async function dominioTieneServidorDeCorreo(email) {
    const dominio = email.split("@")[1];
    try {
        const registros = await dns.resolveMx(dominio);
        return Array.isArray(registros) && registros.length > 0;
    } catch {
        return false;
    }
}

// Genera y envia un codigo de 6 digitos al correo indicado.
// Si el correo YA esta verificado (interruptor encendido), no reenvia nada: responde yaVerificado.
export const enviarCodigoVerificacion = async (req, res) => {
    try {
        const email = req.body?.email?.trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "El correo es obligatorio" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
            return res.status(400).json({ message: "El correo electronico no es valido" });

        const [existente] = await conmysql.query(
            `SELECT id_usuario FROM usuarios WHERE usuario_email = ? LIMIT 1`, [email]
        );
        if (existente.length) return res.status(409).json({ message: "El correo electronico ya esta registrado" });

        // INTERRUPTOR: si ya quedo verificado antes, no se vuelve a pedir codigo.
        const [verificadoPrevio] = await conmysql.query(
            `SELECT verificado FROM email_verificaciones WHERE email = ? AND verificado = 1 LIMIT 1`, [email]
        );
        if (verificadoPrevio.length) {
            return res.json({ success: true, yaVerificado: true, message: "El correo ya estaba verificado" });
        }

        const dominioValido = await dominioTieneServidorDeCorreo(email);
        if (!dominioValido)
            return res.status(400).json({ message: "El dominio del correo no existe o no recibe correos" });

        // Evita reenvios inmediatos (protege contra abuso / spam del propio remitente).
        const [previo] = await conmysql.query(
            `SELECT TIMESTAMPDIFF(SECOND, creado_en, NOW()) AS segundos_transcurridos
             FROM email_verificaciones WHERE email = ? LIMIT 1`,
            [email]
        );

        if (previo.length) {
            const segundosTranscurridos = Number(previo[0].segundos_transcurridos);
            if (segundosTranscurridos < REENVIO_SEGUNDOS) {
                const restantes = REENVIO_SEGUNDOS - segundosTranscurridos;
                return res.status(429).json({
                    message: `Espera ${restantes} segundos antes de reenviar el codigo`,
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

        return res.json({ success: true, message: "Codigo enviado correctamente" });
    } catch (error) {
        console.error("Error enviarCodigoVerificacion:", error);
        return res.status(500).json({ message: error.message || "No se pudo enviar el codigo de verificacion" });
    }
};

// Valida el codigo de 6 digitos ingresado por el usuario. Al coincidir, enciende el interruptor.
export const verificarCodigoEmail = async (req, res) => {
    try {
        const email = req.body?.email?.trim().toLowerCase();
        const codigo = req.body?.codigo?.trim();
        if (!email || !codigo) return res.status(400).json({ message: "Correo y codigo son obligatorios" });

        const [rows] = await conmysql.query(`SELECT * FROM email_verificaciones WHERE email = ? LIMIT 1`, [email]);
        if (!rows.length) return res.status(404).json({ message: "No se ha solicitado un codigo para este correo" });

        const registro = rows[0];
        if (registro.verificado) return res.json({ success: true, message: "El correo ya estaba verificado" });

        if (registro.intentos >= MAX_INTENTOS)
            return res.status(429).json({ message: "Se supero el numero de intentos permitidos. Solicita un nuevo codigo" });

        if (new Date(registro.expira_en) < new Date())
            return res.status(400).json({ message: "El codigo ha expirado. Solicita uno nuevo" });

        if (registro.codigo !== codigo) {
            await conmysql.query(`UPDATE email_verificaciones SET intentos = intentos + 1 WHERE email = ?`, [email]);
            return res.status(400).json({ message: "El codigo ingresado es incorrecto" });
        }

        await conmysql.query(`UPDATE email_verificaciones SET verificado = 1 WHERE email = ?`, [email]);
        return res.json({ success: true, message: "Correo verificado correctamente" });
    } catch (error) {
        console.error("Error verificarCodigoEmail:", error);
        return res.status(500).json({ message: "No se pudo verificar el codigo" });
    }
};

// GET publico: permite al frontend consultar si un correo ya quedo verificado (para
// encender el interruptor al cargar el formulario o al salir del campo de correo).
export const consultarEstadoVerificacion = async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email || "").trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "El correo es obligatorio" });

        const verificado = await correoFueVerificado(email);
        return res.json({ verificado });
    } catch (error) {
        console.error("Error consultarEstadoVerificacion:", error);
        return res.status(500).json({ message: "No se pudo consultar el estado del correo" });
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
