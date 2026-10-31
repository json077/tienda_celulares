import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('plan CoreUI: acción nueva, formulario, selección informativa, vacíos, errores y bloqueo', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const original = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Prohibida API real')
  }
  const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
  const render = (Component, props) =>
    renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(Component, props)),
    )
  try {
    const { default: Form, CreditPlanSale } = await server.ssrLoadModule(
      '/src/views/credits/CreditPlanForm.jsx',
    )
    const { default: Credits } = await server.ssrLoadModule('/src/views/credits/Credits.jsx')
    const sale = {
      id_venta: 71,
      id_cliente: 8,
      numero_venta: 'V-PRUEBA-PLAN',
      cliente: 'Cliente ficticio',
      total: 100,
      tipo_venta: 'CREDITO',
      estado: 'CONFIRMADA',
    }
    const props = {
      sales: [sale],
      busy: false,
      error: '',
      onSave() {},
      onRefresh() {},
      onCancel() {},
    }
    assert.match(render(Credits), /Nuevo plan de crédito/)
    let html = render(Form, props)
    for (const text of [
      'V-PRUEBA-PLAN',
      'Cliente ficticio',
      '100.00',
      'CREDITO',
      'CONFIRMADA',
      'Actualizar ventas elegibles',
      'plan-sale-search',
      'plan-confirm',
    ])
      assert.ok(html.includes(text), text)
    for (const field of [
      'id_venta',
      'tasa_interes',
      'numero_cuotas',
      'frecuencia',
      'fecha_inicio',
      'observacion',
    ])
      assert.ok(html.includes(`name="${field}"`), field)
    assert.doesNotMatch(html, /name="monto_financiado"|name="saldo_pendiente"|name="id_cliente"/)
    html = render(CreditPlanSale, { sale })
    for (const text of ['V-PRUEBA-PLAN', 'Cliente ficticio', '100.00', 'CONFIRMADA', 'backend'])
      assert.ok(html.includes(text), text)
    assert.match(render(CreditPlanSale, {}), /Selecciona una venta/)
    html = render(Form, { ...props, sales: [] })
    assert.match(html, /No hay ventas CREDITO CONFIRMADAS sin plan/)
    assert.match(html, /disabled=""/)
    html = render(Form, { ...props, busy: true, error: 'La venta ya tiene un crédito asociado' })
    assert.match(html, /fieldset disabled/)
    assert.match(html, /La venta ya tiene un crédito asociado/)
    assert.match(html, /Procesando/)
  } finally {
    globalThis.fetch = original
    await server.close()
  }
})
