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

test('Productos: conserva ranking API, una serie real, enteros, etiquetas y tooltip completo', async () => {
  const { buildDashboard } = await load('../src/views/dashboard/dashboardModel.js')
  const { topProductsChart } = await load('../src/views/dashboard/topProductsChartConfig.js')
  const ranking = Array.from({ length: 12 }, (_, index) => ({
    producto: 'Producto con nombre completo muy largo y repetido',
    sku: `SKU-${12 - index}`,
    cantidad: index < 2 ? '15' : '1',
  }))
  const original = structuredClone(ranking)
  const products = buildDashboard([], ranking, []).products
  assert.deepEqual(products, ranking.slice(0, 10))
  assert.deepEqual(ranking, original)
  const { data, options } = topProductsChart(products, false)
  assert.equal(data.datasets.length, 1)
  assert.deepEqual(
    data.datasets[0].data,
    products.map((row) => Number(row.cantidad)),
  )
  assert.equal(data.datasets[0].borderColor, '#2563EB')
  assert.equal(data.datasets[0].maxBarThickness, 36)
  assert.equal(options.indexAxis, 'x')
  assert.equal(options.animation, false)
  assert.equal(options.scales.y.beginAtZero, true)
  assert.equal(options.scales.y.ticks.precision, 0)
  for (const width of [320, 900]) {
    const label = options.scales.x.ticks.callback.call(
      { chart: { width }, getLabelForValue: () => products[0].producto },
      0,
    )
    assert.ok(label.endsWith('…'))
    assert.ok(label.length <= (width < 480 ? 12 : 22))
  }
  const tooltip = options.plugins.tooltip.callbacks
  assert.equal(tooltip.title([{ dataIndex: 1 }]), products[1].producto)
  assert.deepEqual(tooltip.label({ dataIndex: 1, parsed: { y: 15 } }), [
    'SKU: SKU-11',
    'Unidades vendidas: 15',
  ])
  assert.deepEqual(topProductsChart([], false).data.datasets[0].data, [])
  assert.deepEqual(topProductsChart([products[0]], false).data.datasets[0].data, [15])
})

test('Productos: canvas accesible, tabla completa y estado vacío', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  try {
    const { default: Chart } = await server.ssrLoadModule(
      '/src/views/dashboard/TopProductsChart.jsx',
    )
    const html = renderToStaticMarkup(
      React.createElement(Chart, {
        products: [{ producto: 'Nombre completo del producto', sku: 'SKU-REAL', cantidad: '7' }],
      }),
    )
    assert.match(html, /role="img"/)
    assert.match(html, /aria-label="Productos más vendidos/)
    assert.match(html, /height:300px/)
    assert.match(html, /Nombre completo del producto/)
    assert.match(html, /SKU-REAL/)
    assert.match(html, /<td>7<\/td>/)
    const empty = renderToStaticMarkup(React.createElement(Chart, { products: [] }))
    assert.match(empty, /No hay resultados/)
    assert.doesNotMatch(empty, /<canvas/)
  } finally {
    await server.close()
  }
})
