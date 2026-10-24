export const money = (value) =>
  Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100
export const listData = (response) => {
  if (!Array.isArray(response.data)) throw new Error('El servidor devolvió un listado inválido.')
  return response.data
}
export const availableUnits = (units, branch, product) =>
  units.filter(
    (u) =>
      String(u.id_sucursal_actual) === String(branch) &&
      String(u.id_producto) === String(product) &&
      u.estado === 'DISPONIBLE',
  )
export const stockFor = (stock, branch, product) =>
  stock.find(
    (r) => String(r.id_sucursal) === String(branch) && String(r.id_producto) === String(product),
  )?.stock_actual
export const unitLabel = (u) =>
  [
    `Unidad ${u.id_unidad}`,
    u.imei1 && `IMEI ${u.imei1}`,
    u.imei2 && `IMEI2 ${u.imei2}`,
    u.numero_serie && `Serie ${u.numero_serie}`,
  ]
    .filter(Boolean)
    .join(' · ')
export const validateLines = (sale, stock, units, confirming = false) => {
  if (!sale.detalles.length) throw new Error('Agrega al menos un producto.')
  const used = new Set()
  const quantities = new Map()
  for (const line of sale.detalles) {
    if (!['CANTIDAD', 'SERIALIZADO'].includes(line.tipo_control))
      throw new Error('El producto tiene un tipo de control inválido.')
    const quantity = Number(line.cantidad)
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new Error('La cantidad debe ser un entero mayor que cero.')
    const total = (quantities.get(String(line.id_producto)) || 0) + quantity
    quantities.set(String(line.id_producto), total)
    const stockValue = stockFor(stock, sale.id_sucursal, line.id_producto)
    if (stockValue == null || !Number.isFinite(Number(stockValue)) || total > Number(stockValue))
      throw new Error(`Stock insuficiente o no consultado: ${line.producto}.`)
    if (line.tipo_control === 'SERIALIZADO') {
      const selected = line.selected || []
      if (selected.length !== quantity)
        throw new Error(`Selecciona ${quantity} unidades para ${line.producto}.`)
      const available = availableUnits(units, sale.id_sucursal, line.id_producto)
      for (const id of selected) {
        if (used.has(String(id)) || !available.some((u) => String(u.id_unidad) === String(id)))
          throw new Error('Hay una unidad duplicada o que ya no está disponible.')
        used.add(String(id))
      }
    }
    if (!confirming) {
      if (!Number.isFinite(Number(line.precio_unitario)) || Number(line.precio_unitario) < 0)
        throw new Error('El precio del catálogo no es válido.')
      const gross = round(quantity * round(line.precio_unitario))
      const discount = round(line.descuento || 0)
      const max =
        Number(line.permite_descuento) === 1
          ? round((gross * Number(line.porcentaje_descuento_maximo || 0)) / 100)
          : 0
      if (!Number.isFinite(discount) || discount < 0 || discount > gross || discount > max)
        throw new Error(`Descuento inválido para ${line.producto}. Máximo ${money(max)}.`)
      if (!Number.isFinite(Number(line.impuesto)) || Number(line.impuesto) < 0)
        throw new Error('El impuesto debe ser un importe no negativo.')
    }
  }
}
export const totals = (lines) =>
  lines.reduce(
    (sum, l) => {
      sum.subtotal = round(sum.subtotal + round(Number(l.cantidad) * round(l.precio_unitario)))
      sum.descuento = round(sum.descuento + round(l.descuento || 0))
      sum.impuesto = round(sum.impuesto + round(l.impuesto || 0))
      sum.total = round(sum.subtotal - sum.descuento + sum.impuesto)
      return sum
    },
    { subtotal: 0, descuento: 0, impuesto: 0, total: 0 },
  )
