export const creditStates = ['ACTIVO', 'PAGADO', 'ANULADO']
export const installmentStates = ['PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA', 'ANULADA']
export const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0
const amount = (value) =>
  value != null &&
  String(value).trim() !== '' &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
export const money = (value) =>
  amount(value)
    ? new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(Number(value))
    : 'No disponible'
export const creditDate = (value) => {
  if (!value) return '—'
  const text = String(value)
  const dateOnly = /^\d{4}-\d\d-\d\d$/.test(text)
  const date = new Date(
    dateOnly
      ? text + 'T12:00:00-06:00'
      : /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(text)
        ? text.replace(' ', 'T') + '-06:00'
        : text,
  )
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-NI', { timeZone: 'America/Managua' })
}
export const stateColor = (state) =>
  ({
    ACTIVO: 'primary',
    PAGADO: 'success',
    ANULADO: 'secondary',
    PAGADA: 'success',
    ANULADA: 'secondary',
    PARCIAL: 'info',
    VENCIDA: 'danger',
    PENDIENTE: 'warning',
  })[state] || 'secondary'
export const normalizeCredit = (row, expectedId) => {
  if (
    !row ||
    !positiveId(row.id_credito) ||
    !positiveId(row.id_venta) ||
    (expectedId !== undefined && Number(row.id_credito) !== Number(expectedId)) ||
    typeof row.cliente !== 'string' ||
    typeof row.numero_venta !== 'string' ||
    !creditStates.includes(row.estado) ||
    ['monto_financiado', 'tasa_interes', 'monto_interes', 'monto_total', 'saldo_pendiente'].some(
      (key) => !amount(row[key]),
    ) ||
    !positiveId(row.numero_cuotas) ||
    !['SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(row.frecuencia)
  )
    throw new Error('El servidor devolvió un crédito inválido.')
  return { ...row, id_credito: Number(row.id_credito), id_venta: Number(row.id_venta) }
}
export const creditList = (response) => {
  if (!Array.isArray(response?.data))
    throw new Error('El servidor devolvió un listado de créditos inválido.')
  return response.data.map((row) => normalizeCredit(row))
}
export const creditDetail = (response, id) => {
  const row = normalizeCredit(response?.data, id)
  if (
    !Array.isArray(row.cuotas) ||
    row.cuotas.some(
      (q) =>
        !q ||
        !positiveId(q.id_cuota) ||
        Number(q.id_credito) !== row.id_credito ||
        !positiveId(q.numero_cuota) ||
        !installmentStates.includes(q.estado) ||
        ['monto_cuota', 'monto_pagado', 'saldo_cuota'].some((key) => !amount(q[key])),
    )
  )
    throw new Error('El servidor devolvió cuotas inválidas.')
  return row
}
export const creditPaymentHistory = (response, saleId) => {
  if (
    !Array.isArray(response?.data) ||
    response.data.some(
      (p) =>
        !p ||
        !positiveId(p.id_pago) ||
        Number(p.id_venta) !== Number(saleId) ||
        !amount(p.monto) ||
        !amount(p.monto_base) ||
        !amount(p.tipo_cambio),
    )
  )
    throw new Error('El servidor devolvió un historial de pagos inválido.')
  return response.data
}
export const filterCredits = (rows, query = '', state = '') =>
  rows.filter(
    (row) =>
      (!state || row.estado === state) &&
      [row.cliente, row.identificacion, row.numero_venta].some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('es')
          .includes(query.trim().toLocaleLowerCase('es')),
      ),
  )
export const canPay = (credit, quota) =>
  credit?.estado === 'ACTIVO' &&
  credit?.estado_venta === 'CONFIRMADA' &&
  Number(credit.saldo_pendiente) > 0 &&
  ['PENDIENTE', 'PARCIAL', 'VENCIDA'].includes(quota?.estado) &&
  Number(quota.saldo_cuota) > 0
export const validateInstallment = (values, credit, quota, rate, session, sale) => {
  if (
    !canPay(credit, quota) ||
    !credit.cuotas.some((q) => Number(q.id_cuota) === Number(quota.id_cuota))
  )
    return 'Consulta una cuota con saldo de un crédito activo y venta confirmada.'
  if (!['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].includes(values.metodo))
    return 'Selecciona un método válido.'
  if (
    !positiveId(values.id_moneda) ||
    Number(rate?.id_moneda) !== Number(values.id_moneda) ||
    Number(rate?.activo) !== 1 ||
    !rate?.moneda ||
    !amount(rate?.tasa) ||
    Number(rate.tasa) <= 0
  )
    return 'Consulta primero una moneda activa y su tasa.'
  if (!amount(values.monto) || Number(values.monto) <= 0) return 'El monto debe ser mayor que cero.'
  // No convertir moneda ni recalcular intereses/saldos: el servidor valida el sobrepago.
  if (
    rate.moneda === 'NIO' &&
    (Number(values.monto) > Number(quota.saldo_cuota) ||
      Number(values.monto) > Number(credit.saldo_pendiente))
  )
    return 'El monto supera el saldo consultado.'
  if (
    values.metodo === 'EFECTIVO' &&
    (!positiveId(values.id_sesion_caja) ||
      Number(session?.id_sesion_caja) !== Number(values.id_sesion_caja) ||
      session?.estado !== 'ABIERTA' ||
      Number(sale?.id_venta) !== Number(credit.id_venta) ||
      !positiveId(sale?.id_sucursal) ||
      Number(session?.id_sucursal) !== Number(sale.id_sucursal))
  )
    return 'Consulta una sesión ABIERTA de la sucursal de la venta.'
  if (values.metodo !== 'EFECTIVO' && !values.referencia?.trim())
    return 'La referencia es obligatoria para tarjeta o transferencia.'
  if ((values.referencia || '').trim().length > 100)
    return 'La referencia admite hasta 100 caracteres.'
  return ''
}

// Exclusión síncrona: también cubre dos clics antes del siguiente render de React.
export const createOperationGate = () => {
  let pending = false
  return {
    run: async (operation) => {
      if (pending) return false
      pending = true
      try {
        await operation()
        return true
      } finally {
        pending = false
      }
    },
  }
}
