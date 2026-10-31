import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
test('renderizado Productos y formulario CoreUI: carga, filtros, controles, errores y bloqueo', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  const original = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Prohibida API real')
  }
  try {
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { default: Products } = await server.ssrLoadModule('/src/views/products/Products.jsx')
    const { default: Form } = await server.ssrLoadModule('/src/views/products/ProductForm.jsx')
    let html = renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(Products)),
    )
    for (const text of [
      'Cargando productos',
      'Nuevo producto',
      'product-filter-category',
      'product-filter-brand',
      'product-filter-status',
      'product-filter-control',
    ])
      assert.ok(html.includes(text))
    for (const tipo_control of ['CANTIDAD', 'SERIALIZADO']) {
      html = renderToStaticMarkup(
        React.createElement(Form, {
          product: { tipo_control },
          categories: [],
          brands: [],
          saving: true,
          error: 'Error del servidor',
          onSave() {},
          onCancel() {},
        }),
      )
      assert.match(html, /Error del servidor/)
      assert.match(html, /No hay categorías activas/)
      assert.match(html, /fieldset disabled/)
      assert.match(html, /Guardando/)
      assert.match(html, tipo_control === 'SERIALIZADO' ? /IMEI y unidades/ : /las existencias/)
      assert.doesNotMatch(html, /name="(stock|imei|costo)"/)
    }
  } finally {
    globalThis.fetch = original
    await server.close()
  }
})
