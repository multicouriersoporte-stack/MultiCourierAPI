/* import bcrypt from "bcrypt";
import { conmysql } from "./src/db.js";

const hashAdmin = await bcrypt.hash("Al7746Ly2450", 10);
const hashGeneral = await bcrypt.hash("passwordmulticourier", 10);

await conmysql.query(
    `
    UPDATE usuarios
    SET usuario_password = ?
    WHERE usuario_email IN (
        'admin@multicourier.com',
        'cliente@multicourier.com'
    )
    `,
    [hashAdmin]
);

await conmysql.query(
    `
    UPDATE usuarios
    SET usuario_password = ?
    WHERE usuario_email LIKE '%@multicourier.com'
      AND usuario_email NOT IN (
          'admin@multicourier.com',
          'cliente@multicourier.com'
      )
    `,
    [hashGeneral]
);

console.log("✅ Contraseñas actualizadas correctamente.");

process.exit(0);
 */

import bcrypt from "bcrypt";
import { conmysql } from "./src/db.js";

// Detecta hashes bcrypt válidos ($2a$, $2b$ o $2y$)
const esBcrypt = (password) => {
    return /^\$2[aby]\$\d{2}\$.{53}$/.test(String(password));
};

try {
    // Obtener todos los usuarios
    const [usuarios] = await conmysql.query(`
        SELECT
            id_usuario,
            usuario_codigo,
            usuario_email,
            usuario_password
        FROM usuarios
        ORDER BY id_usuario ASC
    `);

    console.log(`🔎 Usuarios encontrados: ${usuarios.length}`);
    console.log("");

    let actualizados = 0;
    let yaBcrypt = 0;
    let vacios = 0;

    for (const usuario of usuarios) {

        const password = String(usuario.usuario_password ?? "");

        // Contraseña vacía o NULL
        if (!password.trim()) {
            console.log(
                `⚠️ ID ${usuario.id_usuario} | ${usuario.usuario_email} | contraseña vacía`
            );

            vacios++;
            continue;
        }

        // Ya está en bcrypt
        if (esBcrypt(password)) {
            console.log(
                `✓ ID ${usuario.id_usuario} | ${usuario.usuario_email} | ya está en bcrypt`
            );

            yaBcrypt++;
            continue;
        }

        // La contraseña NO está en bcrypt
        console.log(
            `🔄 ID ${usuario.id_usuario} | ${usuario.usuario_email} | convirtiendo contraseña...`
        );

        // Generar hash bcrypt
        const hash = await bcrypt.hash(password, 10);

        // Actualizar contraseña
        await conmysql.query(
            `
            UPDATE usuarios
            SET usuario_password = ?
            WHERE id_usuario = ?
            `,
            [hash, usuario.id_usuario]
        );

        actualizados++;

        console.log(
            `   ✅ Contraseña convertida a bcrypt`
        );
    }

    console.log("");
    console.log("==========================================");
    console.log("          PROCESO FINALIZADO");
    console.log("==========================================");
    console.log(`👥 Total usuarios:       ${usuarios.length}`);
    console.log(`🔐 Ya estaban bcrypt:    ${yaBcrypt}`);
    console.log(`🔄 Convertidos:          ${actualizados}`);
    console.log(`⚠️ Contraseñas vacías:   ${vacios}`);
    console.log("==========================================");

} catch (error) {

    console.error("❌ Error convirtiendo contraseñas:", error);

    process.exit(1);

} finally {

    await conmysql.end();

}
