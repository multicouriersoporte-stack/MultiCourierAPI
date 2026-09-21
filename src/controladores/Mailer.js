import nodemailer from "nodemailer";

// El transporter se crea la PRIMERA VEZ que se necesita enviar un correo,
// no al importar este archivo. Esto evita el bug de ECONNREFUSED 127.0.0.1:587:
// si mailer.js se importa (indirectamente, vía las rutas) antes de que
// dotenv.config() haya cargado el .env, process.env.MAIL_HOST llega undefined
// y nodemailer se conecta a localhost por defecto.
let transporterInstance = null;

function crearTransporter() {
    const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;

    if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
        throw new Error(
            "Configuración de correo incompleta: revisa MAIL_HOST, MAIL_USER y MAIL_PASS " +
            "en las variables de entorno (.env local y variables de Render)."
        );
    }

    return nodemailer.createTransport({
        host: MAIL_HOST,
        port: Number(MAIL_PORT || 587),
        secure: Number(MAIL_PORT) === 465,
        auth: { user: MAIL_USER, pass: MAIL_PASS }
    });
}

function obtenerTransporter() {
    if (!transporterInstance) transporterInstance = crearTransporter();
    return transporterInstance;
}

// Envía el correo con el código de verificación de 6 dígitos.
export const enviarCorreoCodigo = async (destino, codigo) => {
    const transporter = obtenerTransporter();
    await transporter.sendMail({
        from: `"MultiCourier" <${process.env.MAIL_USER}>`,
        to: destino,
        subject: "Tu código de verificación - MultiCourier",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
                <h2 style="color:#08592b; margin-bottom: 4px;">MultiCourier</h2>
                <p style="color:#26342c;">Usa el siguiente código para verificar tu correo electrónico:</p>
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color:#08592b; text-align:center; padding: 18px 0; background:#f2f7f4; border-radius: 14px; margin: 14px 0;">
                    ${codigo}
                </div>
                <p style="color:#728078; font-size: 13px;">Este código vence en 10 minutos. Si no solicitaste este registro, puedes ignorar este mensaje.</p>
            </div>
        `
    });
};
