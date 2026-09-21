import nodemailer from "nodemailer";

// Variables de entorno requeridas (configúralas en Render → Environment):
//   MAIL_HOST  -> ej. smtp.gmail.com  o el host SMTP de tu proveedor (Resend, SendGrid, etc.)
//   MAIL_PORT  -> 587 (STARTTLS) o 465 (SSL)
//   MAIL_USER  -> usuario/cuenta remitente
//   MAIL_PASS  -> contraseña de aplicación (NUNCA la contraseña normal de la cuenta)
//
// Si usas Gmail: activa verificación en 2 pasos y genera una "contraseña de aplicación"
// en https://myaccount.google.com/apppasswords — Gmail bloquea el login con la clave normal.

const configCompleta = !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);

if (!configCompleta) {
    console.error(
        "[Mailer] Faltan variables de entorno MAIL_HOST / MAIL_USER / MAIL_PASS. " +
        "El envío de correos fallará hasta que se configuren en el servidor."
    );
}

export const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_PORT === "465",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// Envía el correo con el código de verificación de 6 dígitos.
export const enviarCorreoCodigo = async (destino, codigo) => {
    if (!configCompleta) {
        // Error controlado y explícito en vez de un ECONNREFUSED confuso.
        throw new Error("El servidor de correo no está configurado (faltan variables de entorno MAIL_HOST/MAIL_USER/MAIL_PASS)");
    }

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
