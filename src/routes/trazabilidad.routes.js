import { Router } from "express";
import { getTrazabilidad } from '../controladores/trazabilidadCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/trazabilidad', getTrazabilidad) //SELECT

export default router