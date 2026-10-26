import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Créditos CoreUI: carga, filtros, listado, detalle, cuotas, historial y confirmación de abono', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Prohibida API real')
  }
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
  try {
    const { default: Credits } = await server.ssrLoadModule('/src/views/credits/Credits.jsx')
    const { default: Detail, CreditTable } = await server.ssrLoadModule(
      '/src/views/credits/CreditDetail.jsx',
    )
    const { default: Form } = await server.ssrLoadModule('/src/views/credits/CreditPaymentForm.jsx')
    const quota = {
      id_cuota: 9,
      id_credito: 3,
      numero_cuota: 1,
      fecha_vencimiento: '2026-11-25',
      monto_cuota: 110,
      monto_pagado: 10,
      saldo_cuota: 100,
      estado: 'PARCIAL',
    }
    const credit = {
      id_credito: 3,
      id_venta: 7,
      cliente: 'Ana López',
      identificacion: '000123',
      numero_venta: 'V-TEST',
      monto_financiado: 200,
      tasa_interes: 10,
      monto_interes: 20,
      monto_total: 220,
      saldo_pendiente: 210,
      numero_cuotas: 2,
      frecuencia: 'MENSUAL',
      fecha_inicio: '2026-10-25',
      estado: 'ACTIVO',
      estado_venta: 'CONFIRMADA',
      tipo_venta: 'CREDITO',
      total_venta: 200,
      cuotas: [quota],
    }
    let html = render(Credits)
    for (const text of [
      'Créditos',
      'Actualizar',
      'Cargando créditos',
      'credit-search',
      'credit-state',
      'ACTIVO',
      'PAGADO',
      'ANULADO',
    ])
      assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, /Eliminar crédito|Perdonar|Cambiar interés/)
    html = render(CreditTable, { rows: [credit], busy: false, onOpen() {} })
    for (const text of [
      'Ana López',
      'V-TEST',
      '200.00',
      '210.00',
      '10%',
      'MENSUAL',
      'Ver detalle',
      'table-responsive',
    ])
      assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, />ID<|>id_credito</)
    assert.match(
      render(CreditTable, { rows: [], busy: false, onOpen() {} }),
      /No hay créditos para mostrar/,
    )
    const props = { credit, payments: [], historyError: '', busy: false, onPay() {} }
    html = render(Detail, props)
    for (const text of [
      'Ana López',
      'V-TEST',
      'Cuotas',
      'PARCIAL',
      'Abonar cuota 1',
      'Pagos de la venta asociada',
      'no identifica',
      'No hay pagos registrados',
    ])
      assert.ok(html.includes(text), text)
    for (const estado of ['PAGADO', 'ANULADO'])
      assert.doesNotMatch(
        render(Detail, { ...props, credit: { ...credit, estado } }),
        /Abonar cuota/,
      )
    for (const estado of ['PAGADA', 'ANULADA'])
      assert.doesNotMatch(
        render(Detail, { ...props, credit: { ...credit, cuotas: [{ ...quota, estado }] } }),
        /Abonar cuota/,
      )
    html = render(Detail, {
      ...props,
      payments: null,
      historyError: 'No tienes permisos para consultar pagos',
    })
    assert.match(html, /No tienes permisos/)
    assert.match(html, /Historial no disponible/)
    assert.match(html, /Abonar cuota 1/)
    html = render(Detail, {
      ...props,
      payments: [
        {
          id_pago: 1,
          fecha: '2026-10-25',
          metodo: 'TARJETA',
          referencia: 'REF-TEST',
          moneda: 'USD',
          monto: 1,
          tipo_cambio: 36,
          monto_base: 36,
          estado: 'APLICADO',
          usuario: 'operador',
        },
      ],
    })
    for (const text of ['REF-TEST', 'USD', '36.00', 'APLICADO', 'operador'])
      assert.ok(html.includes(text), text)
    html = render(Form, {
      credit,
      quota,
      sale: null,
      rate: null,
      session: null,
      busy: true,
      error: 'Error del servidor',
      warning: 'Sesión no disponible',
      onConsult() {},
      onSave() {},
      onCancel() {},
    })
    for (const text of [
      'Abonar cuota 1',
      'Confirmo abonar',
      'credit-payment-confirm',
      'Consultar moneda y tasa',
      'Consultar sesión',
      'Error del servidor',
      'Sesión no disponible',
      'Procesando',
      'fieldset disabled',
    ])
      assert.ok(html.includes(text), text)
    assert.match(html, /maxLength="100"/i)
    assert.doesNotMatch(html, /name="tipo_cambio"|name="saldo_pendiente"|name="tasa_interes"/)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
