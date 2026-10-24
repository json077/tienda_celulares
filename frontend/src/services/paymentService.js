import { api, TOKEN_KEY } from './api'
import { saleService } from './saleService'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
export const paymentPayload = (values) => ({
  id_venta: Number(values.id_venta),
  id_moneda: Number(values.id_moneda),
  metodo: values.metodo,
  monto: Number(values.monto),
  id_sesion_caja: values.metodo === 'EFECTIVO' ? Number(values.id_sesion_caja) : null,
  referencia: values.referencia?.trim() || null,
})
export const paymentService = {
  listForSale: (id, signal) => saleService.payments(id, signal),
  register: (values) => api.post('/pagos', paymentPayload(values), options()),
  rate: (id, signal) => api.get(`/tipos-cambio/moneda/${id}`, options(signal)),
}
