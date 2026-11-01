import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('Tema inicial: preferencia CoreUI antes del primer render, URL, automático y almacenamiento bloqueado', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  const initial = ({ stored, url = '', systemDark = false, blocked = false }) => {
    const dataset = {}
    vm.runInNewContext(script, {
      URLSearchParams,
      location: { href: `http://localhost/#/authentication/login${url}` },
      localStorage: {
        getItem(key) {
          assert.equal(key, 'coreui-free-react-admin-template-theme')
          if (blocked) throw new Error('Blocked')
          return stored
        },
      },
      matchMedia: () => ({ matches: systemDark }),
      document: { documentElement: { dataset } },
    })
    return dataset.coreuiTheme
  }
  assert.equal(initial({ stored: 'dark' }), 'dark')
  assert.equal(initial({ stored: 'light', systemDark: true }), 'light')
  assert.equal(initial({ stored: 'auto', systemDark: true }), 'dark')
  assert.equal(initial({ stored: 'auto', systemDark: false }), 'light')
  assert.equal(initial({ stored: 'light', url: '?theme=dark' }), 'dark')
  assert.equal(initial({ stored: 'dark', url: '?theme=light' }), 'light')
  assert.equal(initial({ blocked: true, systemDark: true }), 'dark')
  assert.equal(initial({}), 'light')
})

test('Gráficas: cambiar paleta conserva series, datos, ranking, tooltips y animación reducida', async () => {
  const load = async (file) =>
    import(
      `data:text/javascript;base64,${Buffer.from(await readFile(new URL(file, import.meta.url))).toString('base64')}`
    )
  const { dailySalesChart } = await load('../src/views/dashboard/dailySalesChartConfig.js')
  const { topProductsChart } = await load('../src/views/dashboard/topProductsChartConfig.js')
  const appearance = {
    chartAction: '#3b82f6',
    chartSecondary: '#2dd4bf',
    chartSurface: '#111c2e',
    chartText: '#f1f5f9',
    chartMuted: '#94a3b8',
    chartGrid: '#26364c',
    chartBorder: '#26364c',
  }
  const rows = [{ fecha: '2026-10-02', CONFIRMADA: 200.15, ANULADA: 150.25 }]
  const period = { desde: '2026-10-01', hasta: '2026-10-03' }
  const products = [{ producto: 'Producto completo', sku: 'SKU-REAL', cantidad: '7' }]
  for (const make of [
    (theme) => dailySalesChart(rows, period, false, theme),
    (theme) => topProductsChart(products, false, theme),
  ]) {
    const light = make()
    const dark = make(appearance)
    assert.deepEqual(dark.data.labels, light.data.labels)
    assert.deepEqual(
      dark.data.datasets.map(({ label, data }) => ({ label, data })),
      light.data.datasets.map(({ label, data }) => ({ label, data })),
    )
    assert.equal(dark.options.animation, false)
    assert.equal(dark.options.plugins.tooltip.backgroundColor, appearance.chartSurface)
    assert.equal(dark.options.scales.y.grid.color, appearance.chartGrid)
    assert.equal(dark.options.scales.x.ticks.color, appearance.chartMuted)
    assert.equal(dark.data.datasets[0].backgroundColor, appearance.chartAction)
  }
  const lines = dailySalesChart(rows, period, false, appearance).data.datasets
  assert.deepEqual(lines[1].borderDash, [5, 4])
  assert.notEqual(lines[0].borderColor, lines[1].borderColor)
  const tooltip = topProductsChart(products, false, appearance).options.plugins.tooltip.callbacks
  assert.equal(tooltip.title([{ dataIndex: 0 }]), products[0].producto)
  assert.deepEqual(tooltip.label({ dataIndex: 0, parsed: { y: 7 } }), [
    'SKU: SKU-REAL',
    'Unidades vendidas: 7',
  ])
})
