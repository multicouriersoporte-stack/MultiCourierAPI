// IMPORTANTE: esta línea debe ejecutarse antes de leer cualquier process.env.*
// Si tu archivo de entrada (index.js / server.js) ya llama a dotenv.config()
// ANTES de importar cualquier ruta/controlador, esta línea es redundante pero
// inofensiva (dotenv no sobreescribe variables ya cargadas). Si el orden estaba
// mal, esta línea es la que soluciona tu ECONNREFUSED 127.0.0.1:587.
import "dotenv/config";
import nodemailer from "nodemailer";

const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;

// Falla rápido y con mensaje claro en vez de conectarse silenciosamente a
// localhost:587 (que es justo lo que te está pasando ahora).
if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
    console.error(
        "[mailer] Faltan variables de entorno de correo. " +
        `MAIL_HOST=${MAIL_HOST ?? "(vacío)"} MAIL_USER=${MAIL_USER ? "OK" : "(vacío)"} MAIL_PASS=${MAIL_PASS ? "OK" : "(vacío)"}. ` +
        "Revisa tu .env local y las variables de entorno en Render (y redeploy tras agregarlas)."
    );
}

export const transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT || 587),
    secure: Number(MAIL_PORT) === 465,
    auth: {
        user: MAIL_USER,
        pass: MAIL_PASS
    }
});

// Envía el correo con el código de verificación de 6 dígitos.
export const enviarCorreoCodigo = async (destino, codigo) => {
    if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
        throw new Error("El servicio de correo no está configurado (faltan variables MAIL_HOST/MAIL_USER/MAIL_PASS)");
    }

    await transporter.sendMail({
        from: `"MultiCourier" <${MAIL_USER}>`,
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
