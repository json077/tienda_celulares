// Snapshot the current calendar month in Nicaragua when the Dashboard is opened.
export function currentDashboardPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year').value
  const month = parts.find((p) => p.type === 'month').value
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  return { desde: `${year}-${month}-01`, hasta: `${year}-${month}-${lastDay}`, id_sucursal: '' }
}

export function dashboardPeriodLabel(period) {
  const month = new Intl.DateTimeFormat('es-NI', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period.desde}T00:00:00Z`))
  return `${month} · ${period.desde} al ${period.hasta} · Todas las sucursales autorizadas`
}
export const saleStates = ['CONFIRMADA', 'BORRADOR', 'ANULADA']

export function validateDashboardFilters(filters) {
  for (const key of ['desde', 'hasta']) {
    const value = filters[key]
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value || '') ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value ||
      value < '1000-01-01'
    )
      throw new Error('Selecciona fechas válidas para el período.')
  }
  if (filters.desde > filters.hasta) throw new Error('Desde debe ser anterior o igual a Hasta.')
  if (filters.id_sucursal && !/^[1-9]\d*$/.test(String(filters.id_sucursal)))
    throw new Error('Selecciona una sucursal válida.')
  return { ...filters }
}

// MySQL calendar strings are grouped without timezone conversion.
export function buildDashboard(ventas, ranking, existencias) {
  const confirmed = ventas.filter((r) => r.estado === 'CONFIRMADA')
  const daily = new Map()
  const monetaryDaily = new Map()
  for (const row of ventas) {
    if (!['CONFIRMADA', 'ANULADA'].includes(row.estado)) continue
    const fecha = row.fecha.slice(0, 10)
    const amounts = monetaryDaily.get(fecha) || { CONFIRMADA: 0, ANULADA: 0 }
    amounts[row.estado] += Math.round(Number(row.total) * 100)
    monetaryDaily.set(fecha, amounts)
  }
  for (const row of confirmed) {
    const day = row.fecha.slice(0, 10)
    daily.set(day, (daily.get(day) || 0) + Math.round(Number(row.total) * 100))
  }
  return {
    total: confirmed.reduce((n, r) => n + Math.round(Number(r.total) * 100), 0) / 100,
    count: confirmed.length,
    units: ranking.reduce((n, r) => n + Number(r.cantidad), 0),
    stock: existencias.reduce((n, r) => n + Number(r.stock_actual), 0),
    daily: [...daily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, cents]) => ({ fecha, total: cents / 100 })),
    products: ranking.slice(0, 10),
    monetaryDaily: [...monetaryDaily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, amounts]) => ({
        fecha,
        CONFIRMADA: amounts.CONFIRMADA / 100,
        ANULADA: amounts.ANULADA / 100,
      })),
    states: saleStates.map((estado) => ({
      estado,
      cantidad: ventas.filter((r) => r.estado === estado).length,
    })),
  }
}

export async function loadDashboard(service, filters, signal) {
  const period = validateDashboardFilters(filters)
  const branch = period.id_sucursal ? { id_sucursal: period.id_sucursal } : {}
  const responses = await Promise.all([
    service.read('ventas', period, signal),
    service.read('ranking', period, signal),
    service.read('existencias', branch, signal),
  ])
  return buildDashboard(...responses.map((r) => r.data.rows))
}
