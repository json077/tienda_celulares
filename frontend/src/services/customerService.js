import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })

export const customerPayload = (record, includeStatus = false) => ({
  tipo_identificacion: record.tipo_identificacion.trim(),
  identificacion: record.identificacion.trim(),
  nombres: record.nombres.trim(),
  apellidos: record.apellidos?.trim() || null,
  telefono: record.telefono?.trim() || null,
  email: record.email?.trim() || null,
  direccion: record.direccion?.trim() || null,
  ...(includeStatus && { activo: Number(record.activo) === 1 }),
})

export const customerService = {
  list: (signal) => api.get('/clientes', options(signal)),
  get: (id, signal) => api.get(`/clientes/${id}`, options(signal)),
  create: (record) => api.post('/clientes', customerPayload(record), options()),
  update: (id, record) => api.put(`/clientes/${id}`, customerPayload(record, true), options()),
  deactivate: (id) => api.delete(`/clientes/${id}`, options()),
}
