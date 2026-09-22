// Variables de entorno requeridas: BREVO_API_KEY, MAIL_FROM (ej: multicouriersoporte@gmail.com)
// BREVO_API_KEY se obtiene en Brevo > SMTP & API > API Keys.
// El remitente (MAIL_FROM) debe estar verificado en Brevo > Senders, Domains & Dedicated IPs.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

async function enviarViaBrevo({ to, subject, html }) {
    const { BREVO_API_KEY, MAIL_FROM } = process.env;
    if (!BREVO_API_KEY || !MAIL_FROM) {
        throw new Error(
            "Configuracion de correo incompleta: revisa BREVO_API_KEY y MAIL_FROM en las variables de entorno."
        );
    }

    const respuesta = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "api-key": BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: { name: "MultiCourier", email: MAIL_FROM },
            to: [{ email: to }],
            subject,
            htmlContent: html
        })
    });

    if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => "");
        throw new Error(`Brevo respondio ${respuesta.status}: ${detalle}`);
    }
}

// Prueba la configuracion sin enviar un correo real (chequeo simple de credenciales).
export const verificarConexionCorreo = async () => {
    const { BREVO_API_KEY } = process.env;
    if (!BREVO_API_KEY) throw new Error("Falta BREVO_API_KEY");
    return true;
};

// Envia el correo con el codigo de verificacion de 6 digitos.
export const enviarCorreoCodigo = async (destino, codigo) => {
    await enviarViaBrevo({
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
