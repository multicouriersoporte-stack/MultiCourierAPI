import nodemailer from "nodemailer";

// Variables de entorno requeridas (.env local y variables de entorno en Render):
//   MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS
//
// IMPORTANTE: el transporter se crea de forma PEREZOSA (la primera vez que se necesita
// enviar un correo), nunca al cargar este archivo. Si se crea al cargar el módulo y tu
// dotenv.config() todavía no corrió (por orden de imports), nodemailer usa localhost:587
// por defecto y truena con ECONNREFUSED 127.0.0.1:587 — que es justo lo que estabas viendo.

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
        auth: { user: MAIL_USER, pass: MAIL_PASS }
    });

    return transporterCache;
}

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
