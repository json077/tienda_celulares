import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('CoreUI: caja abierta/cerrada, pagos históricos, formularios y carga sin API real', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Prohibido acceder a la API real en pruebas.')
  }
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
  try {
    const load = async (name) => (await server.ssrLoadModule(`/src/views/cash/${name}.jsx`)).default
    const Detail = await load('CashDetail')
    const Operation = await load('CashOperation')
    const Payment = await load('PaymentForm')
    const Table = await load('PaymentsTable')
    const Cash = await load('Cash')
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const session = {
      id_sesion_caja: 7,
      id_sucursal: 2,
      estado: 'ABIERTA',
      caja: 'Principal',
      sucursal: 'Central',
      usuario_apertura: 'cajero',
      fecha_apertura: '2026-10-24T14:30:00.000Z',
      monto_apertura: 50,
    }
    let html = render(Detail, { session })
    for (const text of ['ABIERTA', 'Principal', 'Central', 'cajero', '50.00', '2026'])
      assert.ok(html.includes(text), text)
    assert.ok(!html.includes('2026-10-24T'))
    assert.ok(!html.includes('Monto esperado:'))
    html = render(Detail, {
      session: {
        ...session,
        estado: 'CERRADA',
        monto_cierre_sistema: 150,
        monto_cierre_real: 140,
        diferencia: -10,
      },
    })
    for (const text of ['CERRADA', 'Monto esperado:', '150.00', '140.00', '-10.00'])
      assert.ok(html.includes(text), text)
    const sale = {
      id_venta: 8,
      id_sucursal: 2,
      numero_venta: 'TEST-8',
      cliente: 'Cliente prueba',
      sucursal: 'Central',
      tipo_venta: 'CONTADO',
      estado: 'CONFIRMADA',
      total: 100,
    }
    const payments = [
      {
        id_pago: 19,
        estado: 'APLICADO',
        metodo: 'EFECTIVO',
        monto: 1,
        moneda: 'USD',
        tipo_cambio: 36.5,
        monto_base: 36.5,
        id_sesion_caja: 7,
        usuario: 'cajero',
        fecha: '2026-10-24T14:30:00.000Z',
      },
      { id_pago: 20, estado: 'ANULADO', monto_base: 100 },
    ]
    html = render(Table, { sale, payments })
    for (const text of [
      'USD',
      '36.5',
      '36.50',
      '63.50',
      'APLICADO',
      'ANULADO',
      'cajero',
      'Tipo de cambio histórico',
    ])
      assert.ok(html.includes(text), text)
    assert.ok(!html.includes('2026-10-24T'))
    assert.match(render(Table, { sale, payments: null }), /No se puede determinar el saldo/)
    html = render(Payment, {
      sale,
      payments: [],
      session,
      rate: null,
      busy: false,
      onRate: () => {},
      onSave: () => {},
    })
    for (const text of [
      'TEST-8',
      'Cliente prueba',
      'EFECTIVO',
      'TARJETA',
      'TRANSFERENCIA',
      'ID de moneda',
      'Registrar pago',
      '100.00',
    ])
      assert.ok(html.includes(text), text)
    assert.match(html, /disabled=""/)
    html = render(Payment, {
      sale: { ...sale, tipo_venta: 'CREDITO' },
      payments: [],
      session,
      busy: false,
      onRate: () => {},
      onSave: () => {},
    })
    assert.match(html, /cuotas/)
    assert.match(html, /<fieldset disabled="">/)
    for (const mode of ['open', 'close', 'movement']) {
      html = render(Operation, {
        mode,
        boxes: [{ id_caja: 1, nombre: 'Principal', sucursal: 'Central', activo: 1 }],
        session,
        busy: true,
        onSave: () => {},
      })
      assert.match(html, /<fieldset disabled="">/)
      assert.match(html, /Revisé los datos/)
      assert.match(html, /Procesando/)
    }
    html = renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(Cash)))
    for (const text of [
      'Caja y pagos',
      'Cargando cajas y ventas',
      'Abrir caja',
      'Consultar sesión',
      'Pagos por venta',
    ])
      assert.ok(html.includes(text), text)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
