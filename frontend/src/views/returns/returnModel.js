import { listData } from '../sales/saleModel'
import { apiErrorMessage } from '../../services/api'

export const returnStates = ['BORRADOR', 'CONFIRMADA', 'ANULADA']
export const positiveId = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0
const same = (a, b) => Number(a) === Number(b)
const amount = (v) =>
  v != null && String(v).trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0
export const returnRows = (response) => {
  const rows = listData(response)
  if (
    rows.some(
      (r) =>
        !r ||
        !positiveId(r.id_devolucion) ||
        !positiveId(r.id_venta) ||
        !returnStates.includes(r.estado),
    )
  )
    throw new Error('El servidor devolvió un listado de devoluciones inválido.')
  return rows
}
export const assertReturn = (row, expectedId) => {
  if (
    !row ||
    !positiveId(row.id_devolucion) ||
    !positiveId(row.id_venta) ||
    (expectedId !== undefined && !same(expectedId, row.id_devolucion)) ||
    !returnStates.includes(row.estado) ||
    !amount(row.total_devuelto) ||
    !Array.isArray(row.detalles) ||
    !row.detalles.length ||
    row.detalles.some(
      (d) =>
        !d ||
        !positiveId(d.id_detalle_venta) ||
        !positiveId(d.cantidad) ||
        !['APTO', 'DEFECTUOSO'].includes(d.condicion) ||
        !['CANTIDAD', 'SERIALIZADO'].includes(d.tipo_control) ||
        ![0, 1].includes(Number(d.reintegra_inventario)) ||
        !amount(d.precio_unitario) ||
        !amount(d.subtotal),
    )
  )
    throw new Error('El servidor devolvió una devolución inválida. Consulta nuevamente.')
  return row
}
export const eligibleSales = (sales) => sales.filter((s) => s.estado === 'CONFIRMADA')
export const filterReturns = (rows, query = '', state = '') =>
  rows.filter(
    (r) =>
      (!state || r.estado === state) &&
      [r.numero_devolucion, r.numero_venta, r.id_devolucion, r.motivo, r.usuario, r.sucursal].some(
        (v) =>
          String(v ?? '')
            .toLocaleLowerCase('es')
            .includes(query.trim().toLocaleLowerCase('es')),
      ),
  )

const tag = async (promise, permission) => {
  try {
    return await promise
  } catch (e) {
    e.permission = permission
    throw e
  }
}

// La API no expone un saldo retornable por venta. Solo CONFIRMADA consume ese saldo.
export const loadReturnContext = async ({ id, sales, returns, signal }) => {
  if (!positiveId(id)) throw new Error('Selecciona una venta válida.')
  const [saleResponse, rowsResponse] = await Promise.all([
    tag(sales.get(id, signal), 'VENTA_VER'),
    tag(returns.list(signal), 'DEVOLUCIONES_VER'),
  ])
  const sale = saleResponse.data
  if (
    !sale ||
    !same(sale.id_venta, id) ||
    sale.estado !== 'CONFIRMADA' ||
    !Array.isArray(sale.detalles) ||
    !sale.detalles.length ||
    sale.detalles.some(
      (d) =>
        !d ||
        !positiveId(d.id_detalle_venta) ||
        !positiveId(d.cantidad) ||
        !['CANTIDAD', 'SERIALIZADO'].includes(d.tipo_control),
    )
  )
    throw new Error('La devolución requiere una venta CONFIRMADA con detalles válidos.')
  const headers = returnRows(rowsResponse).filter(
    (r) => same(r.id_venta, id) && r.estado === 'CONFIRMADA',
  )
  const history = await Promise.all(
    headers.map(async (r) => {
      const current = assertReturn(
        (await tag(returns.get(r.id_devolucion, signal), 'DEVOLUCIONES_VER')).data,
        r.id_devolucion,
      )
      if (!same(current.id_venta, id) || current.estado !== 'CONFIRMADA')
        throw new Error('El historial cambió. Consulta nuevamente antes de devolver.')
      return current
    }),
  )
  let invoice = null
  let serialError = ''
  if (sale.detalles.some((d) => d.tipo_control === 'SERIALIZADO')) {
    try {
      invoice = (await sales.invoice(id, signal)).data
      if (!invoice || !same(invoice.id_venta, id) || !Array.isArray(invoice.detalles))
        throw new Error('La factura no contiene los dispositivos vendidos.')
    } catch (e) {
      if (signal?.aborted) throw e
      invoice = null
      serialError =
        'No se pudieron verificar los IMEI vendidos. Solo puedes devolver productos por cantidad. Revisa el acceso FACTURA_IMPRIMIR y la factura de la venta. ' +
        apiErrorMessage(e)
    }
  }
  const returnedUnits = new Set(
    history.flatMap((r) =>
      r.detalles.filter((d) => d.id_unidad != null).map((d) => Number(d.id_unidad)),
    ),
  )
  const lines = sale.detalles.map((d) => {
    const returned = history
      .flatMap((r) => r.detalles)
      .filter((p) => same(p.id_detalle_venta, d.id_detalle_venta))
      .reduce((sum, p) => sum + Number(p.cantidad), 0)
    if (returned > Number(d.cantidad))
      throw new Error(
        'El historial supera la cantidad vendida. No se puede determinar lo pendiente.',
      )
    const invoiceLine = invoice?.detalles.find((p) => same(p.id_detalle_venta, d.id_detalle_venta))
    const units = invoiceLine?.unidades
    const validUnits =
      Array.isArray(units) &&
      units.length === Number(d.cantidad) &&
      units.every((u) => u && positiveId(u.id_unidad)) &&
      new Set(units.map((u) => Number(u.id_unidad))).size === units.length
    return {
      ...d,
      returned,
      remaining: Number(d.cantidad) - returned,
      units: validUnits ? units.filter((u) => !returnedUnits.has(Number(u.id_unidad))) : [],
    }
  })
  return { sale, lines, serialError, history }
}

export const reintegrates = (type, condition, requested = true) =>
  condition === 'APTO' && (type === 'SERIALIZADO' || requested === true)

export const validateReturn = (values, context) => {
  if (
    !context ||
    context.sale.estado !== 'CONFIRMADA' ||
    !same(values.id_venta, context.sale.id_venta)
  )
    throw new Error('Consulta una venta CONFIRMADA antes de registrar.')
  if (!values.numero_devolucion?.trim() || values.numero_devolucion.trim().length > 50)
    throw new Error('El número de devolución es obligatorio y admite hasta 50 caracteres.')
  if (!values.motivo?.trim() || values.motivo.trim().length > 500)
    throw new Error('El motivo es obligatorio y admite hasta 500 caracteres.')
  if ((values.observacion?.trim().length || 0) > 500)
    throw new Error('La observación admite hasta 500 caracteres.')
  if (!values.detalles?.length) throw new Error('Agrega al menos un artículo.')
  const quantities = new Map()
  const units = new Set()
  for (const d of values.detalles) {
    const line = context.lines.find((p) => same(p.id_detalle_venta, d.id_detalle_venta))
    if (!line) throw new Error('El artículo no pertenece a la venta consultada.')
    if (!positiveId(d.cantidad) || Number(d.cantidad) > 4294967295)
      throw new Error('La cantidad debe ser un entero positivo válido.')
    if (
      !['APTO', 'DEFECTUOSO'].includes(d.condicion) ||
      typeof d.reintegra_inventario !== 'boolean'
    )
      throw new Error('Revisa la condición y el reintegro de inventario.')
    if ((d.motivo?.trim().length || 0) > 500)
      throw new Error('El motivo del artículo admite hasta 500 caracteres.')
    const count = (quantities.get(Number(d.id_detalle_venta)) || 0) + Number(d.cantidad)
    quantities.set(Number(d.id_detalle_venta), count)
    if (count > line.remaining)
      throw new Error(`La cantidad supera lo pendiente de devolver para ${line.producto}.`)
    if (line.tipo_control === 'SERIALIZADO') {
      if (
        Number(d.cantidad) !== 1 ||
        !positiveId(d.id_unidad) ||
        !line.units.some((u) => same(u.id_unidad, d.id_unidad))
      )
        throw new Error('Selecciona exactamente un IMEI vendido y pendiente por línea.')
      if (units.has(Number(d.id_unidad))) throw new Error('No devuelvas dos veces el mismo IMEI.')
      units.add(Number(d.id_unidad))
    } else if (d.id_unidad != null) throw new Error('Los accesorios por cantidad no admiten IMEI.')
    if (
      d.reintegra_inventario !==
      reintegrates(line.tipo_control, d.condicion, d.reintegra_inventario)
    )
      throw new Error('El reintegro no coincide con la condición del producto.')
  }
}

export const acquireReturnOperation = (pending) => {
  if (pending.current) return false
  pending.current = true
  return true
}
export const createReturn = async ({ values, sales, returns, signal, onCommitted }) => {
  const context = await loadReturnContext({ id: values.id_venta, sales, returns, signal })
  if (signal?.aborted) return
  validateReturn(values, context)
  const response = await returns.create(values)
  onCommitted(response)
  return response
}
export const processReturn = async ({
  action,
  record,
  returns,
  signal,
  onCurrent,
  onCommitted,
}) => {
  if (!['confirm', 'cancel'].includes(action) || !positiveId(record?.id_devolucion))
    throw new Error('Operación inválida.')
  const current = assertReturn(
    (await tag(returns.get(record.id_devolucion, signal), 'DEVOLUCIONES_VER')).data,
    record.id_devolucion,
  )
  onCurrent(current)
  if (signal?.aborted) return
  if (current.estado !== 'BORRADOR') throw new Error(`La devolución ya está ${current.estado}.`)
  const response = await returns[action](current.id_devolucion)
  onCommitted(response)
  return response
}
