const positiveId = (value) =>
  /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))

// The narrow endpoint guarantees availability. Add state locally for the existing sale validators.
export const normalizeSaleUnits = (response, product, branch) => {
  if (!Array.isArray(response?.data)) throw new Error('Respuesta de unidades inválida.')
  const seen = new Set()
  return response.data.map((unit) => {
    if (
      !unit ||
      !positiveId(unit.id_unidad) ||
      String(unit.id_producto) !== String(product) ||
      String(unit.id_sucursal_actual) !== String(branch) ||
      typeof unit.imei1 !== 'string' ||
      !unit.imei1 ||
      seen.has(String(unit.id_unidad))
    ) {
      throw new Error('Las unidades no corresponden al producto y sucursal consultados.')
    }
    seen.add(String(unit.id_unidad))
    return {
      id_unidad: unit.id_unidad,
      id_producto: unit.id_producto,
      id_sucursal_actual: unit.id_sucursal_actual,
      imei1: unit.imei1,
      imei2: unit.imei2,
      numero_serie: unit.numero_serie,
      estado: 'DISPONIBLE',
    }
  })
}

export const loadSaleUnits = async (service, branch, products, signal) => {
  if (!positiveId(branch)) throw new Error('Selecciona una sucursal válida.')
  const ids = [...new Set(products.map(String))]
  if (!ids.every(positiveId)) throw new Error('Selecciona un producto válido.')
  const results = await Promise.all(
    ids.map(async (product) => {
      if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
      return normalizeSaleUnits(
        await service.availableUnits(product, branch, signal),
        product,
        branch,
      )
    }),
  )
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
  return results.flat()
}

export const clearSaleSelections = (lines) => lines.map((line) => ({ ...line, selected: [] }))

// Aborts superseded queries and prevents late responses from restoring a previous filter.
export const createAvailabilityQuery = () => {
  let active = null
  return {
    async run(load, onResult, onError) {
      active?.abort()
      const controller = new AbortController()
      active = controller
      try {
        const rows = await load(controller.signal)
        if (active === controller && !controller.signal.aborted) onResult(rows)
      } catch (error) {
        if (active === controller && !controller.signal.aborted) onError(error)
      }
    },
    cancel() {
      active?.abort()
      active = null
    },
  }
}
