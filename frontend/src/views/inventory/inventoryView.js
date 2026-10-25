import { listData } from '../sales/saleModel'
export { dateTime as formatInventoryDate } from '../cash/cashModel'

export const inventoryRows = (response, section) => {
  const rows = listData(response)
  const idFields =
    section === 'stock'
      ? ['id_sucursal', 'id_producto']
      : section === 'units'
        ? ['id_unidad', 'id_producto', 'id_sucursal_actual']
        : ['id_movimiento', 'id_producto', 'id_sucursal']
  if (
    rows.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        idFields.some(
          (field) => !Number.isSafeInteger(Number(row[field])) || Number(row[field]) <= 0,
        ),
    )
  )
    throw new Error('El servidor devolvió registros de inventario inválidos.')
  return rows
}

export const stockLevel = (row) => {
  if (row.stock_bajo === true || row.stock_bajo === 1 || row.stock_bajo === '1') return 'low'
  if (row.stock_bajo === false || row.stock_bajo === 0 || row.stock_bajo === '0') return 'normal'
  return 'unknown'
}

export const unitStateColor = (state) =>
  ({
    DISPONIBLE: 'success',
    VENDIDO: 'primary',
    DEFECTUOSO: 'danger',
    RESERVADO: 'warning',
    DEVUELTO: 'info',
    EN_TRANSFERENCIA: 'warning',
  })[state] || 'secondary'

export const branchId = (section, row) =>
  String(section === 'units' ? row.id_sucursal_actual : row.id_sucursal)

export const filterInventoryRows = (rows, section, filters = {}) => {
  const query = (filters.query || '').trim().toLocaleLowerCase('es')
  return rows.filter((row) => {
    const fields =
      section === 'units'
        ? [row.producto, row.sku, row.imei1, row.imei2, row.numero_serie]
        : section === 'movements'
          ? [row.producto, row.sku, row.tipo_referencia, row.id_referencia, row.observacion]
          : [row.producto, row.sku]
    return (
      (!filters.branch || branchId(section, row) === filters.branch) &&
      (!filters.product || String(row.id_producto) === filters.product) &&
      (!filters.type || row.tipo === filters.type) &&
      (!filters.state || row.estado === filters.state) &&
      (!filters.level || stockLevel(row) === filters.level) &&
      fields.some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('es')
          .includes(query),
      )
    )
  })
}

export const inventoryLabel = (value) =>
  ({
    CANTIDAD: 'Cantidad',
    SERIALIZADO: 'Serializado',
    DISPONIBLE: 'Disponible',
    RESERVADO: 'Reservado',
    VENDIDO: 'Vendido',
    DEFECTUOSO: 'Defectuoso',
    DEVUELTO: 'Devuelto',
    EN_TRANSFERENCIA: 'En transferencia',
    COMPRA: 'Compra',
    VENTA: 'Venta',
    DEVOLUCION: 'Devolución',
    ANULACION: 'Anulación',
    AJUSTE_ENTRADA: 'Ajuste de entrada',
    AJUSTE_SALIDA: 'Ajuste de salida',
    TRANSFERENCIA_ENTRADA: 'Transferencia de entrada',
    TRANSFERENCIA_SALIDA: 'Transferencia de salida',
  })[value] ||
  value ||
  '—'
