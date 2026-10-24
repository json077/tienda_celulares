import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })

export const purchasePayload = (values) => ({
  id_proveedor: Number(values.id_proveedor),
  id_sucursal: Number(values.id_sucursal),
  numero_documento: values.numero_documento.trim(),
  observacion: values.observacion?.trim() || null,
  detalles: values.detalles.map((line) => ({
    id_producto: Number(line.id_producto),
    cantidad: Number(line.cantidad),
    costo_unitario: Number(line.costo_unitario),
    descuento: Number(line.descuento || 0),
    impuesto: Number(line.impuesto || 0),
  })),
})

export const confirmationPayload = (units) => ({
  unidades: units.map((unit) => ({
    id_detalle_compra: Number(unit.id_detalle_compra),
    imei1: unit.imei1.trim(),
    imei2: unit.imei2?.trim() || null,
    numero_serie: unit.numero_serie?.trim() || null,
  })),
})

export const purchaseService = {
  list: (signal) => api.get('/compras', options(signal)),
  get: (id, signal) => api.get(`/compras/${id}`, options(signal)),
  create: (values) => api.post('/compras', purchasePayload(values), options()),
  confirm: (id, units) =>
    api.post(`/compras/${id}/confirmar`, confirmationPayload(units), options()),
  cancel: (id) => api.post(`/compras/${id}/anular`, {}, options()),
}
