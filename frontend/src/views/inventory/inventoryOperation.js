export const validateInventoryOperation = (kind, row, values) => {
  if (
    ![row.id_sucursal, row.id_producto].every(
      (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0,
    )
  )
    return 'La sucursal o el producto no son válidos. Actualiza el inventario.'
  if (kind === 'minimum') {
    return String(values.stock_minimo ?? '').trim() === '' ||
      !Number.isSafeInteger(Number(values.stock_minimo)) ||
      Number(values.stock_minimo) < 0
      ? 'El stock mínimo debe ser un entero mayor o igual a cero.'
      : ''
  }
  if (kind !== 'adjust') return 'Operación de inventario no válida.'
  if (row.tipo_control !== 'CANTIDAD')
    return 'Los productos serializados se controlan por unidad/IMEI.'
  if (!['ENTRADA', 'SALIDA'].includes(values.tipo)) return 'Selecciona entrada o salida.'
  const amount = Number(values.cantidad)
  if (!Number.isSafeInteger(amount) || amount < 1)
    return 'La cantidad debe ser un entero mayor que cero.'
  if (values.tipo === 'SALIDA') {
    if (
      row.stock_actual == null ||
      !Number.isSafeInteger(Number(row.stock_actual)) ||
      Number(row.stock_actual) < 0
    )
      return 'No hay existencias válidas consultadas. Actualiza el inventario.'
    if (amount > Number(row.stock_actual))
      return 'La salida supera el stock consultado. Actualiza las existencias si el stock cambió.'
  }
  if (!values.observacion?.trim() || values.observacion.trim().length > 500)
    return 'Indica un motivo de entre 1 y 500 caracteres.'
  return ''
}
