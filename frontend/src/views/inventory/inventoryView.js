export const branchId = (section, row) =>
  String(section === 'units' ? row.id_sucursal_actual : row.id_sucursal)

export const filterInventoryRows = (rows, section, filters) => {
  const query = filters.query.trim().toLocaleLowerCase('es')
  return rows.filter((row) => {
    const fields =
      section === 'units'
        ? [row.producto, row.sku, row.imei1, row.imei2, row.numero_serie]
        : [row.producto, row.sku]
    return (
      (!filters.branch || branchId(section, row) === filters.branch) &&
      (!filters.product || String(row.id_producto) === filters.product) &&
      (!filters.type || row.tipo === filters.type) &&
      (!filters.state || row.estado === filters.state) &&
      fields.some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('es')
          .includes(query),
      )
    )
  })
}

export const formatInventoryDate = (value) => {
  if (!value) return '—'
  const date = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-NI')
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
