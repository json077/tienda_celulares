import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
export const creditPlanPayload = (values) => ({
  id_venta: Number(values.id_venta),
  tasa_interes: Number(values.tasa_interes),
  numero_cuotas: Number(values.numero_cuotas),
  frecuencia: values.frecuencia.trim().toUpperCase(),
  fecha_inicio: values.fecha_inicio.trim(),
  observacion: values.observacion?.trim() || null,
})
export const installmentPayload = (values) => ({
  id_moneda: Number(values.id_moneda),
  metodo: values.metodo,
  monto: Number(values.monto),
  id_sesion_caja: values.metodo === 'EFECTIVO' ? Number(values.id_sesion_caja) : null,
  referencia: values.referencia?.trim() || null,
})
export const creditService = {
  list: (signal) => api.get('/creditos', options(signal)),
  get: (id, signal) => api.get(`/creditos/${id}`, options(signal)),
  create: (values) => api.post('/creditos', creditPlanPayload(values), options()),
  pay: (id, values) =>
    api.post(`/creditos/cuotas/${id}/pagar`, installmentPayload(values), options()),
}
