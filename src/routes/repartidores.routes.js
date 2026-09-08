/* // src/routes/repartidores.routes.js

import { Router } from "express";
import {
    getRepartidores, getRepartidorxid, getRepartidorPorUsuario, getRepartidorPorCodigo,
    postRepartidores, putRepartidores, patchRepartidores, deleteRepartidores, cambiarEstadoRepartidor
} from "../controladores/repartidoresCtrl.js";

const router = Router();

// Rutas de consulta
router.get("/repartidores", getRepartidores);
router.get("/repartidores/codigo/:codigo", getRepartidorPorCodigo); // Ruta específica antes del ID
router.get("/usuarios/:id_usuario/repartidor", getRepartidorPorUsuario);
router.get("/repartidores/:id", getRepartidorxid);

// Rutas CRUD
router.post("/repartidores", postRepartidores);
router.put("/repartidores/:id", putRepartidores);
router.patch("/repartidores/:id", patchRepartidores);
router.delete("/repartidores/:id", deleteRepartidores);

router.patch("/repartidores/:id/estado", cambiarEstadoRepartidor);

export default router;
 */
// src/app/MultiCourierServicios/Usuarios/repartidores.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IRepartidores } from 'src/app/MultiCourierInterfaces/usuarios';
import { PedidoRepartidorResumen } from 'src/app/MultiCourierServicios/Pedidos/pedidos.service';

@Injectable({ providedIn: 'root' })
export class RepartidoresService {

  private readonly apiUrl = 'https://multicourierapi.onrender.com/api';

  constructor(private http: HttpClient) { }

  /** Lista todos los repartidores. */
  getRepartidores(): Observable<IRepartidores[]> {
    return this.http.get<IRepartidores[]>(`${this.apiUrl}/repartidores`);
  }

  /** Lista repartidores disponibles para recibir pedidos. */
  getRepartidoresDisponibles(): Observable<IRepartidores[]> {
    return this.http.get<IRepartidores[]>(`${this.apiUrl}/repartidores/disponibles`);
  }

  /** Obtiene un repartidor por su ID. */
  getRepartidorPorId(idRepartidor: number): Observable<IRepartidores> {
    return this.http.get<IRepartidores>(`${this.apiUrl}/repartidores/${idRepartidor}`);
  }

  /** Obtiene las ofertas/asignaciones de repartidores para un pedido específico. */
  getRepartidoresPorPedido(idPedido: number): Observable<PedidoRepartidorResumen[]> {
    return this.http.get<PedidoRepartidorResumen[]>(`${this.apiUrl}/pedidos/${idPedido}/repartidores`);
  }

  /** Obtiene una relación específica pedido-repartidor por su ID. */
  getPedidoRepartidor(idPedidoRepartidor: number): Observable<PedidoRepartidorResumen> {
    return this.http.get<PedidoRepartidorResumen>(`${this.apiUrl}/pedidos-repartidor/${idPedidoRepartidor}`);
  }
}
