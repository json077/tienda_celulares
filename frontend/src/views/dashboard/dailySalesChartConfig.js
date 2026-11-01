const currency = new Intl.NumberFormat('es-NI', {
  style: 'currency',
  currency: 'NIO',
})
export const dailyAmount = (value) => currency.format(value)
export const dailyDate = (value) => value.split('-').reverse().join('/')

export function dailySalesChart(rows, period, animation, appearance = {}) {
  const {
    chartAction = '#2563EB',
    chartSecondary = '#14B8A6',
    chartSurface = '#FFFFFF',
    chartText = '#0F172A',
    chartMuted = '#475569',
    chartGrid = '#E2E8F0',
    chartBorder = '#CBD5E1',
  } = appearance
  const days = []
  const date = new Date(`${period.desde}T00:00:00Z`)
  while (date.toISOString().slice(0, 10) <= period.hasta) {
    days.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  const byDate = new Map(rows.map((row) => [row.fecha, row]))
  return {
    data: {
      labels: days,
      datasets: [
        ['CONFIRMADA', chartAction, []],
        ['ANULADA', chartSecondary, [5, 4]],
      ].map(([state, color, dash]) => ({
        label: state,
        data: days.map((day) => byDate.get(day)?.[state] ?? 0),
        borderColor: color,
        backgroundColor: color,
        borderDash: dash,
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: 3,
        pointHoverRadius: 5,
        pointHitRadius: 10,
        pointBackgroundColor: chartSurface,
        pointBorderWidth: 2,
        tension: 0.15,
        cubicInterpolationMode: 'monotone',
        fill: false,
      })),
    },
    options: {
      maintainAspectRatio: false,
      animation,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: 8 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: chartMuted, usePointStyle: true, padding: 16 },
        },
        tooltip: {
          backgroundColor: chartSurface,
          titleColor: chartText,
          bodyColor: chartMuted,
          borderColor: chartBorder,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => (items.length ? dailyDate(items[0].label) : ''),
            label: (context) => `${context.dataset.label}: ${dailyAmount(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: chartMuted,
            maxRotation: 0,
            maxTicksLimit: 8,
            callback(value) {
              return dailyDate(String(this.getLabelForValue(value))).slice(0, 5)
            },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          title: { display: true, text: 'Importe (C$)', color: chartMuted },
          ticks: { color: chartMuted, callback: dailyAmount },
          grid: { color: chartGrid, drawTicks: false },
        },
      },
    },
  }
}
