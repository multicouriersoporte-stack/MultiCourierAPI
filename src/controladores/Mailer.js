import nodemailer from "nodemailer";

// Variables de entorno requeridas (.env local y variables de entorno en Render):
//   MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS
//
// El transporter se crea de forma PEREZOSA (solo la primera vez que se necesita enviar
// un correo), para no depender del orden en que se cargan los modulos / dotenv.

let transporterCache = null;

function obtenerTransporter() {
    if (transporterCache) return transporterCache;

    const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;

    if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
        throw new Error(
            "Configuracion de correo incompleta: revisa MAIL_HOST, MAIL_USER y MAIL_PASS en las variables de entorno."
        );
    }

    transporterCache = nodemailer.createTransport({
        host: MAIL_HOST,
        port: Number(MAIL_PORT || 587),
        secure: String(MAIL_PORT) === "465",
        auth: { user: MAIL_USER, pass: MAIL_PASS },
        // Render no tiene salida IPv6; Gmail a veces resuelve a una IP IPv6 y la conexion
        // falla con ENETUNREACH. Forzamos IPv4 explicitamente.
        family: 4,
        // Temporal: deja ver en los logs de Render el intercambio SMTP real (auth, TLS, etc.)
        // Quita estas dos lineas una vez que el envio funcione, para no llenar los logs.
        logger: true,
        debug: true
    });

    return transporterCache;
}

// Prueba la conexion/autenticacion SMTP sin enviar ningun correo.
// Utilidad de diagnostico: expone el error real (auth invalida, puerto bloqueado, timeout, etc.)
export const verificarConexionCorreo = async () => {
    const transporter = obtenerTransporter();
    return transporter.verify(); // Lanza si algo falla; resuelve true si todo esta bien.
};

// Envia el correo con el codigo de verificacion de 6 digitos.
export const enviarCorreoCodigo = async (destino, codigo) => {
    const transporter = obtenerTransporter();

    await transporter.sendMail({
        from: `"MultiCourier" <${process.env.MAIL_USER}>`,
        to: destino,
        subject: "Tu codigo de verificacion - MultiCourier",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
                <h2 style="color:#08592b; margin-bottom: 4px;">MultiCourier</h2>
                <p style="color:#26342c;">Usa el siguiente codigo para verificar tu correo electronico:</p>
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color:#08592b; text-align:center; padding: 18px 0; background:#f2f7f4; border-radius: 14px; margin: 14px 0;">
                    ${codigo}
                </div>
                <p style="color:#728078; font-size: 13px;">Este codigo vence en 10 minutos. Si no solicitaste este registro, puedes ignorar este mensaje.</p>
            </div>
        `
    });
};
