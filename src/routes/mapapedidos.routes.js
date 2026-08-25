import { Router } from "express";
import { getMapaPedidos } from '../controladores/mapapedidosCtrl.js'

const router = Router()

//Armar nuestras rutas
router.get('/mapapedidos', getMapaPedidos) //SELECT

export default router