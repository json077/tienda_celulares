import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const load = async (file) =>
  import(
    `data:text/javascript;base64,${Buffer.from(await readFile(new URL(file, import.meta.url))).toString('base64')}`
  )

test('Ventas diarias: dos importes reales por fecha de venta, centavos, días sin ventas y sin borradores', async () => {
  const { buildDashboard } = await load('../src/views/dashboard/dashboardModel.js')
  const { dailySalesChart } = await load('../src/views/dashboard/dailySalesChartConfig.js')
  const ventas = [
    { fecha: '2026-10-02 01:00:00', estado: 'CONFIRMADA', total: '0.10' },
    { fecha: '2026-10-02 23:00:00', estado: 'CONFIRMADA', total: '0.20' },
    { fecha: '2026-10-02 12:00:00', estado: 'ANULADA', total: '200.45' },
    { fecha: '2026-10-03 12:00:00', estado: 'BORRADOR', total: '9999' },
  ]
  const result = buildDashboard(ventas, [], [])
  assert.equal(result.total, 0.3)
  assert.equal(result.count, 2)
  assert.deepEqual(result.daily, [{ fecha: '2026-10-02', total: 0.3 }])
  assert.deepEqual(result.monetaryDaily, [
    { fecha: '2026-10-02', CONFIRMADA: 0.3, ANULADA: 200.45 },
  ])
  const period = { desde: '2026-10-01', hasta: '2026-10-03' }
  const chart = dailySalesChart(result.monetaryDaily, period, false)
  assert.deepEqual(chart.data.labels, ['2026-10-01', '2026-10-02', '2026-10-03'])
  assert.deepEqual(
    chart.data.datasets.map((s) => s.label),
    ['CONFIRMADA', 'ANULADA'],
  )
  assert.deepEqual(
    chart.data.datasets.map((s) => s.data),
    [
      [0, 0.3, 0],
      [0, 200.45, 0],
    ],
  )
  assert.equal(chart.options.animation, false)
  assert.equal(chart.options.scales.y.beginAtZero, true)
  assert.notEqual(chart.data.datasets[0].borderColor, chart.data.datasets[1].borderColor)
  assert.ok(chart.data.datasets.every((s) => s.pointRadius > 0))
  const tooltip = chart.options.plugins.tooltip.callbacks
  assert.equal(tooltip.title([{ label: '2026-10-02' }]), '02/10/2026')
  assert.match(
    tooltip.label({ dataset: { label: 'ANULADA' }, parsed: { y: 200.45 } }),
    /ANULADA:.*200\.45/,
  )
  assert.deepEqual(buildDashboard([], [], []).monetaryDaily, [])
  assert.equal(buildDashboard([ventas[2]], [], []).monetaryDaily[0].ANULADA, 200.45)
})

test('Ventas diarias: tabla accesible y vacío sin gráficas ficticias', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  try {
    const { default: Chart } = await server.ssrLoadModule(
      '/src/views/dashboard/DailySalesChart.jsx',
    )
    const period = { desde: '2026-10-01', hasta: '2026-10-03' }
    const render = (rows) => renderToStaticMarkup(React.createElement(Chart, { rows, period }))
    const html = render([{ fecha: '2026-10-02', CONFIRMADA: 100, ANULADA: 50 }])
    assert.match(html, /role="img"/)
    assert.match(html, /aria-label="Ventas por día/)
    assert.match(html, /height:300px/)
    assert.match(html, /02\/10\/2026/)
    assert.match(html, /CONFIRMADA \(C\$\)/)
    assert.match(html, /ANULADA \(C\$\)/)
    assert.match(render([]), /No hay resultados/)
    assert.doesNotMatch(render([]), /<canvas/)
  } finally {
    await server.close()
  }
})
