import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
export const salePayload = (sale) => ({
  id_cliente: Number(sale.id_cliente),
  id_sucursal: Number(sale.id_sucursal),
  numero_venta: sale.numero_venta.trim(),
  tipo_venta: sale.tipo_venta,
  observacion: sale.observacion?.trim() || null,
  detalles: sale.detalles.map((line) => ({
    id_producto: Number(line.id_producto),
    cantidad: Number(line.cantidad),
    descuento: Number(line.descuento || 0),
    impuesto: Number(line.impuesto || 0),
  })),
})
export const saleService = {
  list: (signal) => api.get('/ventas', options(signal)),
  get: (id, signal) => api.get(`/ventas/${id}`, options(signal)),
  create: (sale) => api.post('/ventas', salePayload(sale), options()),
  confirm: (id, unidades) =>
    api.post(
      `/ventas/${id}/confirmar`,
      {
        unidades: unidades.map((u) => ({
          id_detalle_venta: Number(u.id_detalle_venta),
          id_unidad: Number(u.id_unidad),
        })),
      },
      options(),
    ),
  cancel: (id) => api.post(`/ventas/${id}/anular`, {}, options()),
  invoice: (id, signal) => api.get(`/ventas/${id}/factura`, options(signal)),
  payments: (id, signal) => api.get(`/pagos/venta/${id}`, options(signal)),
}
