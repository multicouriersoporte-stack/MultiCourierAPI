import admin from "firebase-admin";

// Inicializa el Admin SDK una sola vez (evita el error "app already exists" si el
// módulo se importa más de una vez, p. ej. con hot-reload en desarrollo).
if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        throw new Error(
            "Configuracion de Firebase incompleta: revisa FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en las variables de entorno."
        );
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey
        })
    });
}

export default admin;
