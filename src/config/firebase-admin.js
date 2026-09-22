// src/config/firebase-admin.js
//
// Punto único de inicialización de Firebase Admin para todo el proyecto.
// FCMPush.js (envío de push) debe consumir getFCMMessaging() de aquí en
// lugar de inicializar su propia instancia de `admin`.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let appInicializada = null;

const validarVariablesEntorno = () => {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error(
            "Configuración de Firebase incompleta: revisa FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en las variables de entorno."
        );
    }
};

// Evita el error "app already exists" si el módulo se importa más de una
// vez (p. ej. hot-reload en desarrollo).
export const getFirebaseApp = () => {
    if (appInicializada) return appInicializada;

    if (getApps().length) {
        appInicializada = getApps()[0];
        return appInicializada;
    }

    validarVariablesEntorno();
    appInicializada = initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
    });

    console.log("🔥 Firebase Admin inicializado correctamente.");
    return appInicializada;
};

export const getFCMMessaging = () => getMessaging(getFirebaseApp());

export default { getFirebaseApp, getFCMMessaging };