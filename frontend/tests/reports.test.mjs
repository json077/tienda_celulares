import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Reportes CoreUI: acceso, ocho contratos, tablas, resúmenes, advertencias y vacíos', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Reports } = await server.ssrLoadModule('/src/views/reports/Reports.jsx')
    const { default: Result } = await server.ssrLoadModule('/src/views/reports/ReportResult.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const definitions = require('../../backend/src/services/reportDefinitions.js')
    const render = (can) =>
      renderToStaticMarkup(
        React.createElement(AuthContext.Provider, { value: { can } }, React.createElement(Reports)),
      )
    assert.match(
      render(() => false),
      /No tienes permiso para consultar reportes/,
    )
    assert.match(
      render(() => true),
      /Cargando reporte/,
    )
    for (const [id, d] of Object.entries(definitions)) {
      const row = Object.fromEntries(
        d.columns.map((c) => [
          c.key,
          ['number', 'money'].includes(c.type) ? 100 : 'Dato de prueba',
        ]),
      )
      const data = {
        id,
        ...d,
        note: d.note || 'Totales por estado',
        generatedAt: '2026-10-31T12:00:00Z',
        filters: { desde: '2026-10-01' },
        rows: [row],
        totals: [{ label: 'Registros', value: 1, type: 'number' }],
      }
      const html = renderToStaticMarkup(React.createElement(Result, { data }))
      assert.ok(html.includes(d.title))
      assert.ok(html.includes('Registros'))
      assert.ok(html.includes('2026-10-01'))
      for (const c of d.columns) assert.ok(html.includes(c.label))
      const empty = renderToStaticMarkup(
        React.createElement(Result, { data: { ...data, rows: [] } }),
      )
      assert.match(empty, /No hay resultados/)
    }
  } finally {
    await server.close()
  }
})

test('Reportes HTTP frontend: filtros, JWT, XLSX binario y bloqueo local de exportación', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const { readFile } = await import('node:fs/promises')
  const moduleUrl = (source) =>
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  const apiUrl = moduleUrl(
    await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'),
  )
  const source = await readFile(
    new URL('../src/services/reportService.js', import.meta.url),
    'utf8',
  )
  const { reportService, reportQuery } = await import(
    moduleUrl(source.replace("'./api'", JSON.stringify(apiUrl)))
  )
  const { bindAuthorization } = await import(apiUrl)
  const { endpointPermission } = await import(
    moduleUrl(await readFile(new URL('../src/auth/permissions.js', import.meta.url), 'utf8'))
  )
  globalThis.localStorage = { getItem: () => 'token-simulado' }
  let permissions = ['REPORTE_VER']
  let calls = 0
  let denied = 0
  const unbind = bindAuthorization({
    permissionFor: endpointPermission,
    can: (code) => permissions.includes(code),
    onDenied: () => denied++,
  })
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(options.headers.Authorization, 'Bearer token-simulado')
    assert.ok(url.includes('/api/reportes'))
    if (url.includes('/excel'))
      return new Response(new Uint8Array([80, 75, 3, 4]), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    return new Response(JSON.stringify({ ok: true, data: { rows: [] } }))
  }
  try {
    assert.equal(reportQuery({ desde: '2026-10-01', estado: '' }), '?desde=2026-10-01')
    await reportService.catalog()
    await reportService.read('ventas', { estado: 'CONFIRMADA' })
    assert.equal(calls, 2)
    await assert.rejects(reportService.export('ventas', {}), (e) => e.status === 403)
    assert.equal(calls, 2)
    permissions.push('REPORTE_EXPORTAR')
    const blob = await reportService.export('ventas', { id_sucursal: 1 })
    assert.equal(blob.size, 4)
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'Acceso revocado' }), { status: 403 })
    await assert.rejects(reportService.export('ventas', {}), (e) => e.status === 403)
    assert.equal(denied, 1)
    globalThis.fetch = async () => new Response('<html>Error</html>')
    await assert.rejects(reportService.export('ventas', {}), /Excel válido/)
    permissions = []
    await assert.rejects(reportService.read('ventas', {}), (e) => e.status === 403)
  } finally {
    unbind()
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('Reportes interfaz: selector completo, filtros aplicados y handler de exportación protegido', async () => {
  const harness = { index: 0, values: new Map(), buttons: [], forms: [], selects: [] }
  globalThis.__reportsHarness = harness
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    plugins: [
      {
        name: 'reports-interaction-test',
        enforce: 'pre',
        transform(code, id) {
          if (!id.replaceAll('\\', '/').endsWith('/reports/Reports.jsx')) return
          code = code.replace(/\buseState\b/, 'useState as realUseState')
          for (const name of ['CButton', 'CForm', 'CFormSelect']) {
            code = code.replace(new RegExp(`\\b${name},`), `${name} as Core${name},`)
            const bucket = { CButton: 'buttons', CForm: 'forms', CFormSelect: 'selects' }[name]
            code += `\nconst ${name} = (props) => { globalThis.__reportsHarness.${bucket}.push(props); return React.createElement(Core${name}, props) }\n`
          }
          code +=
            '\nconst useState = initial => { const h = globalThis.__reportsHarness; const i = h.index++; const [v] = realUseState(h.values.has(i) ? h.values.get(i) : initial); h.values.set(i,v); return [v, n => h.values.set(i, typeof n === "function" ? n(h.values.get(i)) : n)] }\n'
          return code
        },
      },
    ],
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Sin API real')
  }
  try {
    const { default: Reports } = await server.ssrLoadModule('/src/views/reports/Reports.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { createRequire } = await import('node:module')
    const definitions = createRequire(import.meta.url)(
      '../../backend/src/services/reportDefinitions.js',
    )
    const catalog = {
      reports: Object.entries(definitions).map(([id, d]) => ({ id, ...d })),
      branches: [{ id_sucursal: 1, nombre: 'Central' }],
      products: [],
    }
    const data = {
      ...definitions.ventas,
      id: 'ventas',
      generatedAt: new Date().toISOString(),
      filters: {},
      rows: [],
      totals: [],
    }
    harness.values = new Map([
      [0, catalog],
      [4, data],
      [6, false],
    ])
    let permissions = ['REPORTE_VER']
    const render = () => {
      harness.index = 0
      harness.buttons = []
      harness.forms = []
      harness.selects = []
      return renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          { value: { can: (code) => permissions.includes(code) } },
          React.createElement(Reports),
        ),
      )
    }
    const html = render()
    for (const d of Object.values(definitions)) assert.ok(html.includes(d.title))
    const exportButton = harness.buttons.find((b) => String(b.children).includes('Exportar'))
    assert.equal(exportButton.disabled, true)
    await exportButton.onClick()
    harness.selects
      .find((s) => s.id === 'report-state')
      .onChange({ target: { value: 'CONFIRMADA' } })
    render()
    harness.forms[0].onSubmit({ preventDefault() {} })
    assert.deepEqual(harness.values.get(3), { estado: 'CONFIRMADA' })
    harness.values.set(4, data)
    harness.values.set(6, false)
    permissions.push('REPORTE_EXPORTAR')
    render()
    assert.equal(
      harness.buttons.find((b) => String(b.children).includes('Exportar')).disabled,
      false,
    )
    harness.selects
      .find((s) => s.id === 'report-type')
      .onChange({ target: { value: 'existencias' } })
    const stocks = render()
    assert.ok(!stocks.includes('report-desde'))
    assert.ok(stocks.includes('report-product'))
    assert.equal(harness.values.get(4), null)
    harness.selects.find((s) => s.id === 'report-type').onChange({ target: { value: 'creditos' } })
    const credits = render()
    assert.match(credits, /fecha de inicio del crédito, no la fecha de la venta/)
    assert.match(credits, /Deja ambas fechas vacías/)
    assert.deepEqual(harness.values.get(2), {})
    assert.deepEqual(harness.values.get(3), {})
    permissions = []
    assert.match(render(), /No tienes permiso para consultar reportes/)
  } finally {
    await server.close()
    globalThis.fetch = originalFetch
    delete globalThis.__reportsHarness
  }
})
