export const purchaseStates = ['BORRADOR', 'CONFIRMADA', 'ANULADA']
export const purchaseStateLabel = (state) =>
  ({ BORRADOR: 'Borrador', CONFIRMADA: 'Confirmada', ANULADA: 'Anulada' })[state] || state
export const purchaseStateColor = (state) =>
  ({ BORRADOR: 'warning', CONFIRMADA: 'success', ANULADA: 'secondary' })[state] || 'secondary'

export const formatAmount = (value) =>
  Number(value).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatPurchaseDate = (value) => {
  if (!value) return '—'
  const date = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-NI')
}

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100
const positiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0
const nonnegative = (value) =>
  String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

export const lineAmounts = (line) => {
  const gross = round(Number(line.cantidad) * round(Number(line.costo_unitario)))
  const discount = round(Number(line.descuento || 0))
  const tax = round(Number(line.impuesto || 0))
  return { gross, discount, tax, total: round(gross - discount + tax) }
}

export const draftTotals = (lines) =>
  lines.reduce(
    (sum, line) => {
      const amounts = lineAmounts(line)
      return {
        subtotal: round(sum.subtotal + amounts.gross),
        descuento: round(sum.descuento + amounts.discount),
        impuesto: round(sum.impuesto + amounts.tax),
        total: round(sum.total + amounts.total),
      }
    },
    { subtotal: 0, descuento: 0, impuesto: 0, total: 0 },
  )

export const validateDraft = (values, products, suppliers) => {
  if (
    !positiveInteger(values.id_proveedor) ||
    !suppliers.some(
      (s) => Number(s.id_proveedor) === Number(values.id_proveedor) && Number(s.activo) === 1,
    )
  )
    return 'Selecciona un proveedor activo.'
  if (!positiveInteger(values.id_sucursal)) return 'Indica una sucursal válida.'
  if (!values.numero_documento.trim() || values.numero_documento.trim().length > 80)
    return 'El número de documento es obligatorio y admite hasta 80 caracteres.'
  if (values.observacion.trim().length > 500) return 'La observación admite hasta 500 caracteres.'
  if (!values.detalles.length) return 'Agrega al menos un producto.'
  for (const [index, line] of values.detalles.entries()) {
    const prefix = `Línea ${index + 1}: `
    const product = products.find((p) => Number(p.id_producto) === Number(line.id_producto))
    if (!product || Number(product.activo) !== 1) return `${prefix}selecciona un producto activo.`
    if (!positiveInteger(line.cantidad)) return `${prefix}la cantidad debe ser un entero positivo.`
    if (!nonnegative(line.costo_unitario)) return `${prefix}el costo debe ser mayor o igual a cero.`
    if (!nonnegative(line.descuento || 0) || !nonnegative(line.impuesto || 0))
      return `${prefix}el descuento y el impuesto deben ser mayores o iguales a cero.`
    const amounts = lineAmounts(line)
    if (!Object.values(amounts).every(Number.isFinite))
      return `${prefix}los importes no son válidos.`
    if (amounts.discount > amounts.gross) return `${prefix}el descuento supera el importe bruto.`
  }
  return ''
}

export const knownBranches = (...datasets) => {
  const branches = new Map()
  datasets.flat().forEach((row) => {
    if (positiveInteger(row.id_sucursal) && row.sucursal) {
      branches.set(String(row.id_sucursal), {
        id: String(row.id_sucursal),
        label: [row.codigo_sucursal, row.sucursal].filter(Boolean).join(' · '),
      })
    }
  })
  return [...branches.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export const filterPurchases = (rows, query, state, branch) => {
  const search = query.trim().toLocaleLowerCase('es')
  return rows.filter(
    (row) =>
      (!state || row.estado === state) &&
      (!branch || String(row.id_sucursal) === branch) &&
      [row.id_compra, row.numero_documento, row.proveedor, row.sucursal, row.usuario].some(
        (value) =>
          String(value ?? '')
            .toLocaleLowerCase('es')
            .includes(search),
      ),
  )
}

export const serializedDetails = (purchase) =>
  purchase.detalles.filter((line) => line.tipo_control === 'SERIALIZADO')

export const unitComplete = (unit) =>
  /^\d{15}$/.test(unit.imei1?.trim() || '') &&
  (!unit.imei2?.trim() || /^\d{15}$/.test(unit.imei2.trim())) &&
  (unit.numero_serie?.trim().length || 0) <= 80

export const validateUnits = (purchase, units) => {
  const lines = serializedDetails(purchase)
  const imeis = new Set()
  const series = new Set()
  for (const line of lines) {
    if (
      units.filter((u) => Number(u.id_detalle_compra) === Number(line.id_detalle_compra)).length !==
      Number(line.cantidad)
    )
      return `${line.producto}: completa exactamente ${line.cantidad} unidades con IMEI.`
  }
  for (const unit of units) {
    if (!lines.some((line) => Number(line.id_detalle_compra) === Number(unit.id_detalle_compra)))
      return 'Una unidad no pertenece a un detalle serializado de esta compra.'
    if (!unitComplete(unit))
      return 'Revisa los IMEI (15 dígitos) y las series (hasta 80 caracteres).'
    for (const imei of [unit.imei1.trim(), unit.imei2?.trim()].filter(Boolean)) {
      if (imeis.has(imei)) return `El IMEI ${imei} está repetido en esta compra.`
      imeis.add(imei)
    }
    const serial = unit.numero_serie?.trim()
    if (serial && series.has(serial)) return `La serie ${serial} está repetida en esta compra.`
    if (serial) series.add(serial)
  }
  return ''
}

export const assertPurchase = (data, expectedId) => {
  if (
    !data ||
    !positiveInteger(data.id_compra) ||
    (expectedId !== undefined && Number(data.id_compra) !== Number(expectedId)) ||
    !purchaseStates.includes(data.estado) ||
    !Array.isArray(data.detalles) ||
    !data.detalles.length ||
    data.detalles.some(
      (line) => !positiveInteger(line.id_detalle_compra) || !positiveInteger(line.cantidad),
    )
  )
    throw new Error('El servidor devolvió una compra inválida. Actualiza el listado.')
  return data
}
