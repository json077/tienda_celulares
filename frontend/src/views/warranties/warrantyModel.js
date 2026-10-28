import { listData } from '../sales/saleModel'
import { apiErrorMessage } from '../../services/api'

export const warrantyStates = ['VIGENTE', 'VENCIDA', 'ANULADA']
export const claimTransitions = {
  RECIBIDO: ['EN_REVISION'],
  EN_REVISION: ['APROBADO', 'RECHAZADO'],
  APROBADO: ['RESUELTO'],
  RECHAZADO: ['RESUELTO'],
  RESUELTO: [],
}
export const solutions = ['REPARACION', 'REEMPLAZO', 'DEVOLUCION', 'SIN_COBERTURA']
export const validId = (v) =>
  ['number', 'string'].includes(typeof v) &&
  /^\d+$/.test(String(v)) &&
  Number.isSafeInteger(Number(v)) &&
  Number(v) > 0
const same = (a, b) => Number(a) === Number(b)
const length = (text) => [...(text?.trim() || '')].length
const dateOnly = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-')
export const assertWarranty = (r, expectedId) => {
  if (
    !r ||
    !validId(r.id_garantia) ||
    !validId(r.id_venta) ||
    !validId(r.id_detalle_venta) ||
    !validId(r.id_producto) ||
    (r.id_unidad != null && !validId(r.id_unidad)) ||
    (expectedId !== undefined && !same(r.id_garantia, expectedId)) ||
    !warrantyStates.includes(r.estado) ||
    !dateOnly(r.fecha_inicio) ||
    !dateOnly(r.fecha_fin) ||
    !Number.isInteger(Number(r.dias_garantia)) ||
    Number(r.dias_garantia) <= 0 ||
    Number(r.dias_garantia) > 65535
  )
    throw new Error('El servidor devolvió una garantía inválida. Consulta nuevamente.')
  return r
}
export const warrantyRows = (response) => listData(response).map((r) => assertWarranty(r))
export const assertClaim = (r, expectedId) => {
  if (
    !r ||
    !validId(r.id_reclamo) ||
    !validId(r.id_garantia) ||
    !validId(r.id_sucursal) ||
    (expectedId !== undefined && !same(r.id_reclamo, expectedId)) ||
    !Object.hasOwn(claimTransitions, r.estado) ||
    (r.solucion != null && !solutions.includes(r.solucion))
  )
    throw new Error('El servidor devolvió un reclamo inválido. Consulta nuevamente.')
  return r
}
export const claimRows = (response, warrantyId) =>
  listData(response).map((r) => {
    assertClaim(r)
    if (!same(r.id_garantia, warrantyId))
      throw new Error('El reclamo no corresponde a la garantía consultada.')
    return r
  })
export const hasOpenClaim = (rows) => rows.some((r) => r.estado !== 'RESUELTO')
export const warrantySale = (r, sales) => sales.find((s) => same(s.id_venta, r.id_venta))
export const warrantyLine = (r, sale) =>
  sale?.detalles?.find((d) => same(d.id_detalle_venta, r.id_detalle_venta))
export const filterWarranties = (rows, sales, query = '', state = '') =>
  rows.filter((r) => {
    const sale = warrantySale(r, sales)
    const line = warrantyLine(r, sale)
    return (
      (!state || r.estado === state) &&
      [
        r.id_garantia,
        r.id_venta,
        r.id_unidad,
        sale?.numero_venta,
        sale?.cliente,
        line?.producto,
        line?.sku,
      ].some((v) =>
        String(v ?? '')
          .toLocaleLowerCase('es')
          .includes(query.trim().toLocaleLowerCase('es')),
      )
    )
  })
export const knownWarrantyBranches = (sales) => [
  ...new Map(
    sales
      .filter((s) => validId(s.id_sucursal) && s.sucursal)
      .map((s) => [String(s.id_sucursal), { id: String(s.id_sucursal), label: s.sucursal }]),
  ).values(),
]
const tag = async (promise, permission) => {
  try {
    return await promise
  } catch (e) {
    e.permission = permission
    throw e
  }
}

// La factura es la única lectura existente del vínculo histórico detalle/dispositivo.
export const loadWarrantySale = async ({ id, sales, signal }) => {
  if (!validId(id)) throw new Error('Selecciona una venta válida.')
  const sale = (await tag(sales.get(id, signal), 'VENTA_VER')).data
  if (
    !sale ||
    !same(sale.id_venta, id) ||
    !Array.isArray(sale.detalles) ||
    sale.detalles.some((d) => !d || !validId(d.id_detalle_venta) || !validId(d.id_producto))
  )
    throw new Error('La venta consultada no contiene detalles válidos.')
  let warning = ''
  let invoice = null
  if (sale.detalles.some((d) => d.tipo_control === 'SERIALIZADO')) {
    try {
      invoice = (await sales.invoice(id, signal)).data
      if (!invoice || !same(invoice.id_venta, id) || !Array.isArray(invoice.detalles))
        throw new Error('Factura inválida.')
    } catch (e) {
      if (signal?.aborted) throw e
      warning = 'No se pudieron verificar los IMEI históricos. ' + apiErrorMessage(e)
      invoice = null
    }
  }
  const lines = sale.detalles.map((d) => {
    const historic = invoice?.detalles.find(
      (p) =>
        p && same(p.id_detalle_venta, d.id_detalle_venta) && same(p.id_producto, d.id_producto),
    )
    const units = historic?.unidades
    const valid =
      Array.isArray(units) &&
      units.every((u) => u && validId(u.id_unidad)) &&
      new Set(units.map((u) => Number(u.id_unidad))).size === units.length
    return { ...d, units: valid ? units : [] }
  })
  return { sale, lines, warning }
}
export const validateWarranty = (v, context, existing) => {
  if (!context || context.sale.estado !== 'CONFIRMADA' || !same(v.id_venta, context.sale.id_venta))
    throw new Error('Selecciona una venta CONFIRMADA.')
  const d = context.lines.find((r) => same(r.id_detalle_venta, v.id_detalle_venta))
  if (
    !d ||
    !Number.isInteger(Number(d.dias_garantia)) ||
    Number(d.dias_garantia) < 1 ||
    Number(d.dias_garantia) > 65535
  )
    throw new Error(
      'Selecciona un artículo con días históricos de garantía válidos y mayores que cero.',
    )
  if (d.tipo_control === 'CANTIDAD') {
    if (v.id_unidad != null || !validId(d.cantidad))
      throw new Error('La garantía por cantidad cubre todo el detalle, sin IMEI.')
  } else if (d.tipo_control === 'SERIALIZADO') {
    if (!validId(v.id_unidad) || !d.units.some((u) => same(u.id_unidad, v.id_unidad)))
      throw new Error('Selecciona el dispositivo exacto vendido según su factura.')
  } else throw new Error('Tipo de control no válido.')
  if (
    existing.some(
      (r) =>
        same(r.id_venta, v.id_venta) &&
        (v.id_unidad == null
          ? same(r.id_detalle_venta, v.id_detalle_venta)
          : r.id_unidad != null && same(r.id_unidad, v.id_unidad)),
    )
  )
    throw new Error('Ya existe una garantía para ese detalle o unidad de la venta.')
}
export const validateClaim = (v, warranty, claims) => {
  if (warranty.estado !== 'VIGENTE')
    throw new Error(
      'La garantía no está vigente. El servidor verifica además el intervalo de cobertura.',
    )
  if (hasOpenClaim(claims)) throw new Error('La garantía ya tiene un reclamo abierto.')
  if (!validId(v.id_sucursal)) throw new Error('Selecciona una sucursal de recepción válida.')
  if (!length(v.numero_reclamo) || length(v.numero_reclamo) > 50)
    throw new Error('El número de reclamo es obligatorio y admite hasta 50 caracteres.')
  if (!length(v.motivo) || length(v.motivo) > 500)
    throw new Error('El motivo es obligatorio y admite hasta 500 caracteres.')
  if (length(v.observacion) > 500) throw new Error('La observación admite hasta 500 caracteres.')
}
export const validateResolution = (v, claim) => {
  if (!claimTransitions[claim.estado]?.includes(v.estado))
    throw new Error('Transición de estado no permitida. Consulta nuevamente el reclamo.')
  const solution = v.solucion === undefined ? claim.solucion : v.solucion || null
  const diagnosis = v.diagnostico === undefined ? claim.diagnostico : v.diagnostico
  if (solution != null && !solutions.includes(solution)) throw new Error('Solución no válida.')
  if (length(diagnosis) > 1000 || length(v.observacion) > 500)
    throw new Error('Diagnóstico: máximo 1000 caracteres. Observación: máximo 500.')
  if (v.estado === 'EN_REVISION' && solution != null)
    throw new Error('EN_REVISION no admite solución.')
  if (v.estado === 'RECHAZADO' && solution != null && solution !== 'SIN_COBERTURA')
    throw new Error('RECHAZADO requiere SIN_COBERTURA.')
  if ((v.estado === 'APROBADO' || claim.estado === 'APROBADO') && solution === 'SIN_COBERTURA')
    throw new Error('APROBADO no admite SIN_COBERTURA.')
  if (claim.estado === 'RECHAZADO' && solution !== 'SIN_COBERTURA')
    throw new Error('Un reclamo rechazado debe cerrarse con SIN_COBERTURA.')
  if (v.estado !== 'EN_REVISION' && !length(diagnosis))
    throw new Error('El diagnóstico es obligatorio para decidir o resolver.')
  if (v.estado === 'RESUELTO' && !solution) throw new Error('RESUELTO requiere solución.')
}
export const acquireWarrantyOperation = (pending) => {
  if (pending.current) return false
  pending.current = true
  return true
}
export const createWarranty = async ({ values, sales, service, signal, onCommitted }) => {
  const [context, rows] = await Promise.all([
    loadWarrantySale({ id: values.id_venta, sales, signal }),
    tag(service.list(signal), 'GARANTIAS_VER').then(warrantyRows),
  ])
  if (signal?.aborted) return
  validateWarranty(values, context, rows)
  const response = await service.create(values)
  onCommitted(response)
  return response
}
export const receiveClaim = async ({ id, values, service, signal, onCommitted }) => {
  const [warranty, claims] = await Promise.all([
    tag(service.get(id, signal), 'GARANTIAS_VER').then((r) => assertWarranty(r.data, id)),
    tag(service.claims(id, signal), 'GARANTIAS_VER').then((r) => claimRows(r, id)),
  ])
  if (signal?.aborted) return
  validateClaim(values, warranty, claims)
  const response = await service.createClaim(id, values)
  onCommitted(response)
  return response
}
export const resolveClaim = async ({ record, values, service, signal, onCurrent, onCommitted }) => {
  const current = assertClaim(
    (await tag(service.claim(record.id_reclamo, signal), 'GARANTIAS_VER')).data,
    record.id_reclamo,
  )
  onCurrent(current)
  if (signal?.aborted) return
  if (!same(current.id_garantia, record.id_garantia) || current.estado !== record.estado)
    throw new Error('El reclamo cambió. Revisa y confirma nuevamente.')
  validateResolution(values, current)
  const response = await service.resolve(current.id_reclamo, values)
  onCommitted(response)
  return response
}
