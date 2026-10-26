export const planFrequencies = ['SEMANAL', 'QUINCENAL', 'MENSUAL']
const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0

export const eligibleCreditSales = (sales, credits) => {
  if (
    !Array.isArray(sales) ||
    !Array.isArray(credits) ||
    credits.some((c) => !positiveId(c?.id_venta)) ||
    sales.some(
      (s) =>
        !positiveId(s?.id_venta) ||
        typeof s?.numero_venta !== 'string' ||
        typeof s?.cliente !== 'string' ||
        typeof s?.estado !== 'string' ||
        typeof s?.tipo_venta !== 'string' ||
        s?.total == null ||
        !Number.isFinite(Number(s.total)),
    )
  )
    throw new Error(
      'No se pudieron verificar las ventas y sus planes. Actualiza las ventas elegibles.',
    )
  const financed = new Set(credits.map((c) => Number(c.id_venta)))
  return sales.filter(
    (s) =>
      s.tipo_venta === 'CREDITO' &&
      s.estado === 'CONFIRMADA' &&
      positiveId(s.id_cliente) &&
      Number(s.total) > 0 &&
      !financed.has(Number(s.id_venta)),
  )
}

export const validateCreditPlan = (values, sales) => {
  if (
    !positiveId(values.id_venta) ||
    !sales.some(
      (s) =>
        Number(s.id_venta) === Number(values.id_venta) &&
        s.tipo_venta === 'CREDITO' &&
        s.estado === 'CONFIRMADA' &&
        positiveId(s.id_cliente) &&
        Number(s.total) > 0,
    )
  )
    return 'Selecciona una venta CREDITO CONFIRMADA sin plan existente.'
  if (
    String(values.tasa_interes ?? '').trim() === '' ||
    !Number.isFinite(Number(values.tasa_interes)) ||
    Number(values.tasa_interes) < 0 ||
    Number(values.tasa_interes) > 100
  )
    return 'La tasa de interés debe estar entre 0 y 100.'
  if (
    !Number.isInteger(Number(values.numero_cuotas)) ||
    Number(values.numero_cuotas) < 1 ||
    Number(values.numero_cuotas) > 120
  )
    return 'El número de cuotas debe ser un entero entre 1 y 120.'
  if (!planFrequencies.includes(values.frecuencia)) return 'Selecciona una periodicidad válida.'
  const date = String(values.fecha_inicio ?? '')
  const parsed = new Date(`${date}T12:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return 'Indica una fecha de inicio válida en formato YYYY-MM-DD.'
  if ((values.observacion ?? '').trim().length > 500)
    return 'La observación admite hasta 500 caracteres.'
  return ''
}

// APIs inyectadas para comprobar el flujo sin acceder a datos reales.
export const loadCreditPlanSales = async (services, signal) => {
  const [sales, credits] = await Promise.all([
    services.sales.list(signal),
    services.credits.list(signal),
  ])
  return eligibleCreditSales(sales.data, credits.data)
}

export const createCreditPlan = async (values, services, signal) => {
  const [sale, credits] = await Promise.all([
    services.sales.get(values.id_venta, signal),
    services.credits.list(signal),
  ])
  if (Number(sale.data?.id_venta) !== Number(values.id_venta))
    throw new Error('La venta consultada no coincide con la seleccionada.')
  const eligible = eligibleCreditSales([sale.data], credits.data)
  if (credits.data.some((c) => Number(c.id_venta) === Number(values.id_venta)))
    throw new Error('La venta ya tiene un crédito asociado. Actualiza las ventas elegibles.')
  const invalid = validateCreditPlan(values, eligible)
  if (invalid) throw new Error(invalid)
  return services.credits.create(values)
}

// Tras confirmar el POST, el fallo de recarga nunca vuelve a abrir ni reenviar el formulario.
export const completeCreditPlanCreation = async (response, onCreated, refresh) => {
  onCreated(response)
  await refresh()
}
