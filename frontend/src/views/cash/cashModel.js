import { round } from '../sales/saleModel'

export const dateTime = (value) => {
  if (!value) return '—'
  // MySQL DATETIME without offset is a local wall-clock value, not UTC.
  const text = String(value)
  const date = new Date(
    /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(text) ? text.replace(' ', 'T') + '-06:00' : value,
  )
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleString('es-NI', { timeZone: 'America/Managua' })
}
export const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0
const amount = (value, zero = false) =>
  String(value ?? '').trim() !== '' &&
  Number.isFinite(Number(value)) &&
  (zero ? Number(value) >= 0 : Number(value) > 0)

// Informational balance only; every definitive total is calculated by the server.
export const paymentBalance = (sale, payments) => {
  if (!sale || !Array.isArray(payments) || sale.total == null || !amount(sale.total, true))
    return null
  const applied = payments.filter((p) => p.estado === 'APLICADO')
  if (applied.some((p) => !amount(p.monto_base, true))) return null
  const paid = round(applied.reduce((sum, p) => sum + Number(p.monto_base), 0))
  return { paid, pending: round(Number(sale.total) - paid) }
}
export const validateCash = (mode, values, session, boxes) => {
  if (mode === 'open') {
    const box = boxes.find((b) => String(b.id_caja) === String(values.id_caja))
    if (!box || Number(box.activo) !== 1) throw new Error('Selecciona una caja activa.')
    if (session?.estado === 'ABIERTA' && Number(session.id_caja) === Number(box.id_caja))
      throw new Error('Esta caja ya tiene una sesión abierta.')
    if (!amount(values.monto_apertura, true))
      throw new Error('El monto inicial debe ser mayor o igual a cero.')
  } else {
    if (!session || session.estado !== 'ABIERTA') throw new Error('La sesión debe estar ABIERTA.')
    if (mode === 'close' && !amount(values.monto_cierre_real, true))
      throw new Error('Indica un monto contado mayor o igual a cero.')
    if (mode === 'movement') {
      if (!['INGRESO', 'EGRESO'].includes(values.tipo) || !amount(values.monto))
        throw new Error('Selecciona INGRESO o EGRESO e indica un monto mayor que cero.')
      if (!values.concepto?.trim() || values.concepto.length > 255)
        throw new Error('El concepto es obligatorio y admite hasta 255 caracteres.')
    }
  }
  if ((values.observacion || '').length > 500)
    throw new Error('La observación admite hasta 500 caracteres.')
}
export const validatePayment = (values, sale, payments, session, rate) => {
  if (!sale || sale.estado !== 'CONFIRMADA' || sale.tipo_venta !== 'CONTADO')
    throw new Error('Solo se registran pagos de ventas CONTADO confirmadas en este módulo.')
  if (Number(values.id_venta) !== Number(sale.id_venta))
    throw new Error('Consulta nuevamente la venta.')
  const balance = paymentBalance(sale, payments)
  if (!balance || balance.pending <= 0)
    throw new Error('No hay saldo pendiente consultado para cobrar.')
  if (!['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].includes(values.metodo))
    throw new Error('Método inválido.')
  if (
    !positiveId(values.id_moneda) ||
    Number(rate?.id_moneda) !== Number(values.id_moneda) ||
    !['NIO', 'USD'].includes(rate?.moneda) ||
    Number(rate?.activo) !== 1 ||
    !amount(rate?.tasa)
  )
    throw new Error('Consulta una moneda NIO/USD activa con tipo de cambio válido.')
  if (!amount(values.monto)) throw new Error('El monto debe ser mayor que cero.')
  if (round(Number(values.monto) * Number(rate.tasa)) > balance.pending)
    throw new Error('El pago supera el saldo pendiente consultado.')
  if (
    values.metodo === 'EFECTIVO' &&
    (!session ||
      session.estado !== 'ABIERTA' ||
      Number(values.id_sesion_caja) !== Number(session.id_sesion_caja) ||
      Number(session.id_sucursal) !== Number(sale.id_sucursal))
  )
    throw new Error('Selecciona una sesión ABIERTA de la sucursal de la venta.')
  if (values.metodo !== 'EFECTIVO' && !values.referencia?.trim())
    throw new Error('La referencia es obligatoria.')
  if ((values.referencia || '').length > 150)
    throw new Error('La referencia admite hasta 150 caracteres.')
}
