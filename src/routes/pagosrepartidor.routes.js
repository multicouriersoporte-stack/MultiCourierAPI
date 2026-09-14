import express from "express";
import {
  postPagoRepartidor,
  getPagoRepartidorPorPedido,
  getMisPagosRepartidor,
  actualizarEstadoPagoRepartidor,
  getPagosRepartidores
} from "../controladores/pagosrepartidorCtrl.js";

const router = express.Router();

// Listar todos los pagos.
router.get("/", getPagosRepartidores);

// Pagos del repartidor autenticado. Debe ir antes de /:id.
router.get("/mis-pagos", getMisPagosRepartidor);

// Consultar el pago de un pedido.
router.get("/pedido/:id_pedido", getPagoRepartidorPorPedido);

// Crear el pago de un pedido.
router.post("/pedido/:id_pedido", postPagoRepartidor);

// Actualizar el estado del pago.
router.patch("/:id/estado", actualizarEstadoPagoRepartidor);

export default router;
