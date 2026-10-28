export const transferStates = ['BORRADOR', 'CONFIRMADA', 'ANULADA']
const id = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0
const same = (a, b) => Number(a) === Number(b)

export const assertTransfer = (row, expectedId) => {
  if (
    !row ||
    !id(row.id_transferencia) ||
    (expectedId !== undefined && !same(row.id_transferencia, expectedId)) ||
    !transferStates.includes(row.estado) ||
    !Array.isArray(row.detalles) ||
    !row.detalles.length ||
    row.detalles.some(
      (line) =>
        !id(line.id_producto) ||
        !id(line.cantidad) ||
        !['CANTIDAD', 'SERIALIZADO'].includes(line.tipo_control) ||
        !Array.isArray(line.unidades),
    )
  )
    throw new Error('El servidor devolvió una transferencia inválida. Consulta nuevamente.')
  return row
}

export const transferList = (response) => {
  if (
    !Array.isArray(response?.data) ||
    response.data.some((r) => !r || !id(r.id_transferencia) || !transferStates.includes(r.estado))
  )
    throw new Error('El servidor devolvió un listado de transferencias inválido.')
  return response.data
}

export const transferBranches = (stock = [], transfers = []) => {
  const rows = new Map()
  const add = (value, label) => {
    if (id(value) && label) rows.set(String(value), { id: String(value), label })
  }
  stock.forEach((r) => add(r.id_sucursal, r.sucursal))
  transfers.forEach((r) => {
    add(r.id_sucursal_origen, r.sucursal_origen)
    add(r.id_sucursal_destino, r.sucursal_destino)
  })
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export const filterTransfers = (rows, query = '', state = '', origin = '', destination = '') => {
  const search = query.trim().toLocaleLowerCase('es')
  return rows.filter(
    (r) =>
      (!state || r.estado === state) &&
      (!origin || String(r.id_sucursal_origen) === origin) &&
      (!destination || String(r.id_sucursal_destino) === destination) &&
      [
        r.numero_transferencia,
        r.id_transferencia,
        r.sucursal_origen,
        r.sucursal_destino,
        r.usuario_solicita,
        r.usuario_confirma,
      ].some((v) =>
        String(v ?? '')
          .toLocaleLowerCase('es')
          .includes(search),
      ),
  )
}

export const availableUnits = (units, origin, product) =>
  units.filter(
    (u) =>
      same(u.id_sucursal_actual, origin) &&
      same(u.id_producto, product) &&
      u.estado === 'DISPONIBLE',
  )

export const availableProducts = (catalog, origin) =>
  catalog.products.filter(
    (p) =>
      Number(p.activo) === 1 &&
      ['CANTIDAD', 'SERIALIZADO'].includes(p.tipo_control) &&
      catalog.stock.some(
        (s) =>
          same(s.id_sucursal, origin) &&
          same(s.id_producto, p.id_producto) &&
          Number(s.stock_actual) > 0,
      ) &&
      (p.tipo_control !== 'SERIALIZADO' ||
        (catalog.units !== null &&
          availableUnits(catalog.units, origin, p.id_producto).length > 0)),
  )

export const validateTransfer = (values, catalog) => {
  if (!values.numero_transferencia?.trim() || values.numero_transferencia.trim().length > 50)
    throw new Error('El número de transferencia es obligatorio y admite hasta 50 caracteres.')
  if (!id(values.id_sucursal_origen) || !id(values.id_sucursal_destino))
    throw new Error('Selecciona sucursales válidas.')
  if (same(values.id_sucursal_origen, values.id_sucursal_destino))
    throw new Error('Origen y destino deben ser diferentes.')
  if ((values.observacion?.trim().length || 0) > 500)
    throw new Error('La observación admite hasta 500 caracteres.')
  if (!values.detalles?.length) throw new Error('Agrega al menos un producto.')
  const products = new Set()
  const units = new Set()
  const imeis = new Set()
  for (const line of values.detalles) {
    const product = catalog.products.find((p) => same(p.id_producto, line.id_producto))
    if (!product || Number(product.activo) !== 1) throw new Error('Selecciona un producto activo.')
    if (products.has(Number(line.id_producto)))
      throw new Error('No repitas productos; reúne sus unidades en una línea.')
    products.add(Number(line.id_producto))
    const stock = catalog.stock.find(
      (s) =>
        same(s.id_sucursal, values.id_sucursal_origen) && same(s.id_producto, line.id_producto),
    )
    const quantity =
      product.tipo_control === 'SERIALIZADO' ? line.unidades?.length : Number(line.cantidad)
    if (!id(quantity))
      throw new Error(
        'La cantidad debe ser un entero positivo; selecciona al menos una unidad si es serializado.',
      )
    if (
      !stock ||
      !Number.isFinite(Number(stock.stock_actual)) ||
      quantity > Number(stock.stock_actual)
    )
      throw new Error(`Inventario insuficiente para ${product.nombre}.`)
    if (product.tipo_control === 'CANTIDAD') {
      if (line.unidades !== undefined)
        throw new Error('Un producto por cantidad no admite unidades IMEI.')
    } else if (product.tipo_control === 'SERIALIZADO') {
      if (catalog.units === null)
        throw new Error('Consulta las unidades antes de transferir un teléfono.')
      const available = availableUnits(catalog.units, values.id_sucursal_origen, line.id_producto)
      for (const value of line.unidades) {
        const unit = available.find((u) => same(u.id_unidad, value))
        if (!id(value) || !unit) throw new Error('La unidad/IMEI ya no está disponible en origen.')
        if (units.has(Number(value)))
          throw new Error('No selecciones dos veces la misma unidad/IMEI.')
        units.add(Number(value))
        for (const imei of [unit.imei1, unit.imei2].filter(Boolean)) {
          if (imeis.has(imei))
            throw new Error('Hay un IMEI duplicado entre las unidades seleccionadas.')
          imeis.add(imei)
        }
      }
    } else throw new Error('Tipo de control no soportado.')
  }
}

export const acquireTransferOperation = (pending) => {
  if (pending.current) return false
  pending.current = true
  return true
}

// No reintentar POST aunque falle una lectura posterior.
export const processTransfer = async ({
  action,
  record,
  service,
  signal,
  onCurrent,
  onCommitted,
}) => {
  if (!['confirm', 'cancel'].includes(action) || !id(record?.id_transferencia))
    throw new Error('Operación de transferencia inválida.')
  const current = assertTransfer(
    (await service.get(record.id_transferencia, signal)).data,
    record.id_transferencia,
  )
  onCurrent(current)
  if (signal?.aborted) return
  if (current.estado !== 'BORRADOR') throw new Error(`La transferencia ya está ${current.estado}.`)
  const response = await service[action](current.id_transferencia)
  onCommitted(response)
  return response
}
