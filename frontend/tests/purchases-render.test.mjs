import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('renderizado React/CoreUI: cantidad sin IMEI, serializados paginados, revisión y catálogos vacíos', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Esta prueba no debe acceder a la API real.')
  }
  try {
    const { default: Confirmation } = await server.ssrLoadModule(
      '/src/views/purchases/PurchaseConfirmation.jsx',
    )
    const { default: Summary } = await server.ssrLoadModule(
      '/src/views/purchases/PurchaseSummary.jsx',
    )
    const { default: Form } = await server.ssrLoadModule('/src/views/purchases/PurchaseForm.jsx')
    const { default: Purchases } = await server.ssrLoadModule('/src/views/purchases/Purchases.jsx')
    const base = {
      id_compra: 1,
      id_sucursal: 1,
      estado: 'BORRADOR',
      proveedor: 'Proveedor de prueba',
      sucursal: 'Central',
      numero_documento: 'DOC-TEST',
      subtotal: 10,
      descuento: 0,
      impuesto: 0,
      total: 10,
    }
    const quantity = {
      ...base,
      detalles: [
        {
          id_detalle_compra: 1,
          producto: 'Cable',
          sku: 'CAB',
          tipo_control: 'CANTIDAD',
          cantidad: 2,
          costo_unitario: 5,
          descuento: 0,
          impuesto: 0,
          subtotal: 10,
        },
      ],
    }
    const props = { saving: false, error: '', onConfirm: () => {}, onCancel: () => {} }
    let html = renderToStaticMarkup(
      React.createElement(Confirmation, { ...props, purchase: quantity }),
    )
    assert.match(html, /No se requieren IMEI/)
    assert.doesNotMatch(html, /inputmode="numeric"/i)
    const serialized = {
      ...base,
      detalles: [{ ...quantity.detalles[0], tipo_control: 'SERIALIZADO', cantidad: 12 }],
    }
    html = renderToStaticMarkup(
      React.createElement(Confirmation, { ...props, purchase: serialized }),
    )
    assert.match(html, /Faltan 12 unidades/)
    assert.equal((html.match(/inputmode="numeric"/gi) || []).length, 10)
    assert.match(html, /Unidades 1–5 de 12/)
    assert.match(html, /purchase-confirm-reviewed/)
    assert.match(html, /Una compra confirmada no puede anularse/)
    html = renderToStaticMarkup(React.createElement(Summary, { purchase: quantity }))
    for (const text of [
      'Proveedor de prueba',
      'DOC-TEST',
      'Central',
      'Cable',
      'Costo unitario',
      'Subtotal',
      'Total',
    ])
      assert.ok(html.includes(text))
    html = renderToStaticMarkup(
      React.createElement(Form, {
        products: [],
        suppliers: [],
        branches: [],
        warning: '',
        saving: false,
        error: '',
        onSave: () => {},
        onCancel: () => {},
      }),
    )
    assert.match(html, /Se necesita al menos un proveedor y un producto activos/)
    assert.match(html, /Otra sucursal: indicar ID/)
    assert.match(html, /Revisar compra/)
    html = renderToStaticMarkup(React.createElement(Purchases))
    assert.match(html, /Compras/)
    assert.match(html, /Cargando compras/)
    assert.match(html, /Nueva compra/)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
