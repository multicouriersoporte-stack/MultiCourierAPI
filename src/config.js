import { config } from "dotenv";
config()

/* export const BD_HOST = process.env.BD_HOST || "localhost";
export const BD_DATABASE = process.env.BD_DATABASE || "multicourier_bd";
export const DB_USER=process.env.DB_USER || root
export const DB_PASSWORD=process.env.DB_PASSWORD || ''
export const DB_PORT=process.env.DB_PORT || 3306
export const PORT=process.env.PORT || 3000 */

export const BD_HOST = process.env.BD_HOST || br50harbrx0i1xuzghve-mysql.services.clever-cloud.com;
export const BD_DATABASE = process.env.BD_DATABASE || br50harbrx0i1xuzghve;
export const DB_USER=process.env.DB_USER || root
export const DB_PASSWORD=process.env.DB_PASSWORD || klMBKwOJdfTAEJZ9r1Hh
export const DB_PORT=process.env.DB_PORT || 3306
export const PORT=process.env.PORT || 3000