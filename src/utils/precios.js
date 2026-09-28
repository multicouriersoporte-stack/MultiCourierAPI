// src/utils/precios.js
// Única fuente de verdad del precio que ve el cliente en la app.
// El frontend NO calcula ni envía local_producto_precio_app.

// Recargo de la app expresado en milésimas (75 = 7.5%).
export const RECARGO_APP_MILESIMAS = 75;

// Calcula el precio de la app a partir del precio del local (aritmética en centavos, sin errores de flotantes).
export const calcularPrecioApp = (precioLocal) => {
    const centavos = Math.round(Number(precioLocal) * 100);
    return Math.round((centavos * (1000 + RECARGO_APP_MILESIMAS)) / 1000) / 100;
};