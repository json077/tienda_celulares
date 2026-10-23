import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })

const payload = (record, includeStatus = false) => ({
  tipo_identificacion: record.tipo_identificacion?.trim() || null,
  identificacion: record.identificacion?.trim() || null,
  nombre: record.nombre.trim(),
  telefono: record.telefono?.trim() || null,
  email: record.email?.trim() || null,
  direccion: record.direccion?.trim() || null,
  ...(includeStatus && { activo: Number(record.activo) === 1 }),
})

export const supplierService = {
  list: (signal) => api.get('/proveedores', options(signal)),
  get: (id, signal) => api.get(`/proveedores/${id}`, options(signal)),
  create: (record) => api.post('/proveedores', payload(record), options()),
  update: (id, record) => api.put(`/proveedores/${id}`, payload(record, true), options()),
  deactivate: (id) => api.delete(`/proveedores/${id}`, options()),
}
