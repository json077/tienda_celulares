import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
export const warrantyPayload = (v) => ({
  id_venta: Number(v.id_venta),
  id_detalle_venta: Number(v.id_detalle_venta),
  id_unidad: v.id_unidad == null ? null : Number(v.id_unidad),
})
export const claimPayload = (v) => ({
  id_sucursal: Number(v.id_sucursal),
  numero_reclamo: v.numero_reclamo.trim(),
  motivo: v.motivo.trim(),
  observacion: v.observacion?.trim() || null,
})
export const resolutionPayload = (v) => ({
  estado: v.estado,
  // undefined conserva los valores existentes; null los borra según el contrato.
  ...(v.solucion !== undefined && { solucion: v.solucion || null }),
  ...(v.diagnostico !== undefined && { diagnostico: v.diagnostico?.trim() || null }),
  ...(v.observacion !== undefined && { observacion: v.observacion?.trim() || null }),
})
const safe = async (promise) => {
  try {
    return await promise
  } catch (e) {
    if (e.status >= 500) {
      e.message = 'Error interno del servidor. No se pudo completar la operación de garantía.'
      e.errores = []
    }
    throw e
  }
}
export const warrantyService = {
  list: (signal) => safe(api.get('/garantias', options(signal))),
  get: (id, signal) => safe(api.get(`/garantias/${id}`, options(signal))),
  create: (values) => safe(api.post('/garantias', warrantyPayload(values), options())),
  claims: (id, signal) => safe(api.get(`/garantias/${id}/reclamos`, options(signal))),
  claim: (id, signal) => safe(api.get(`/garantias/reclamos/${id}`, options(signal))),
  createClaim: (id, values) =>
    safe(api.post(`/garantias/${id}/reclamos`, claimPayload(values), options())),
  resolve: (id, values) =>
    safe(api.post(`/garantias/reclamos/${id}/resolver`, resolutionPayload(values), options())),
}
