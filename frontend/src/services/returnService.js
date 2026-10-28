import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
export const returnPayload = (values) => ({
  numero_devolucion: values.numero_devolucion.trim(),
  id_venta: Number(values.id_venta),
  motivo: values.motivo.trim(),
  observacion: values.observacion?.trim() || null,
  detalles: values.detalles.map((d) => ({
    id_detalle_venta: Number(d.id_detalle_venta),
    cantidad: Number(d.cantidad),
    id_unidad: d.id_unidad == null ? null : Number(d.id_unidad),
    condicion: d.condicion,
    reintegra_inventario: d.reintegra_inventario,
    motivo: d.motivo?.trim() || null,
  })),
})

// Reutiliza JWT, errores de red y errores[].msg; no presentar detalles internos de un 500.
const safe = async (promise) => {
  try {
    return await promise
  } catch (error) {
    if (error.status >= 500) {
      error.message = 'Error interno del servidor. No se pudo completar la devolución.'
      error.errores = []
    }
    throw error
  }
}
export const returnService = {
  list: (signal) => safe(api.get('/devoluciones', options(signal))),
  get: (id, signal) => safe(api.get(`/devoluciones/${id}`, options(signal))),
  create: (values) => safe(api.post('/devoluciones', returnPayload(values), options())),
  confirm: (id) => safe(api.post(`/devoluciones/${id}/confirmar`, {}, options())),
  cancel: (id) => safe(api.post(`/devoluciones/${id}/anular`, {}, options())),
}
