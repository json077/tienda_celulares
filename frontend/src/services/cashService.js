import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
export const openingPayload = (values) => ({
  id_caja: Number(values.id_caja),
  monto_apertura: Number(values.monto_apertura ?? 0),
  observacion: values.observacion?.trim() || null,
})
export const closingPayload = (values) => ({
  monto_cierre_real: Number(values.monto_cierre_real),
  observacion: values.observacion?.trim() || null,
})
export const movementPayload = (values) => ({
  tipo: values.tipo,
  monto: Number(values.monto),
  concepto: values.concepto.trim(),
})
export const cashService = {
  list: (signal) => api.get('/cajas', options(signal)),
  session: (id, signal) => api.get(`/cajas/sesiones/${id}`, options(signal)),
  open: (values) => api.post('/cajas/abrir', openingPayload(values), options()),
  close: (id, values) =>
    api.post(`/cajas/sesiones/${id}/cerrar`, closingPayload(values), options()),
  movement: (id, values) =>
    api.post(`/cajas/sesiones/${id}/movimientos`, movementPayload(values), options()),
}
