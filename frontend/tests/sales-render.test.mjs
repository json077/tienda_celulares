import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('renderizado CoreUI: revisión, históricos, IMEI, pagos, confirmación y formulario vacío', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('No se permite acceder a la API real en pruebas.')
  }
  try {
    const load = async (name) =>
      (await server.ssrLoadModule(`/src/views/sales/${name}.jsx`)).default
    const Summary = await load('SaleSummary')
    const Detail = await load('SaleDetail')
    const Form = await load('SaleForm')
    const Confirmation = await load('SaleConfirmation')
    const Sales = await load('Sales')
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const sale = {
      id_venta: 1,
      numero_venta: 'TEST-1',
      cliente: 'Cliente de prueba',
      identificacion_cliente: 'ID-TEST',
      sucursal: 'Central',
      usuario: 'vendedor',
      tipo_venta: 'CONTADO',
      estado: 'BORRADOR',
      subtotal: 100,
      descuento: 0,
      impuesto: 0,
      total: 100,
      detalles: [
        {
          id_detalle_venta: 8,
          id_producto: 3,
          producto: 'Teléfono',
          sku: 'TEL',
          tipo_control: 'SERIALIZADO',
          cantidad: 1,
          precio_unitario: 100,
          costo_unitario: 70,
          dias_garantia: 30,
          subtotal: 100,
          unidades: [{ id_unidad: 4, imei1: '000000000000004' }],
        },
      ],
    }
    let html = renderToStaticMarkup(React.createElement(Summary, { sale }))
    for (const text of [
      'TEST-1',
      'Cliente de prueba',
      'Central',
      'vendedor',
      'ID-TEST',
      '000000000000004',
      '100.00',
      'NIO',
    ])
      assert.ok(html.includes(text), text)
    html = renderToStaticMarkup(
      React.createElement(Detail, {
        sale,
        invoice: null,
        payments: [
          {
            id_pago: 1,
            estado: 'APLICADO',
            monto_base: 50,
            moneda: 'USD',
            tipo_cambio: 36,
            metodo: 'EFECTIVO',
          },
        ],
        warnings: ['Sin permiso de factura'],
      }),
    )
    for (const text of [
      'Costo unitario',
      '70.00',
      '30',
      'USD',
      'EFECTIVO',
      'Sin permiso de factura',
    ])
      assert.ok(html.includes(text), text)
    html = renderToStaticMarkup(
      React.createElement(Confirmation, {
        sale,
        stock: [],
        units: [],
        saving: false,
        onConfirm: () => {},
        onCancel: () => {},
      }),
    )
    assert.match(html, /sale-confirm-reviewed/)
    assert.match(html, /DISPONIBLE/)
    assert.match(html, /Confirmar venta y emitir factura/)
    assert.match(html, /disabled=""/)
    html = renderToStaticMarkup(
      React.createElement(Form, {
        catalog: { products: [], clients: [], stock: [], units: [], unitError: 'Sin permiso IMEI' },
        saving: false,
        onSave: () => {},
        onCancel: () => {},
      }),
    )
    assert.match(html, /Sin permiso IMEI/)
    assert.match(html, /Revisar venta/)
    assert.match(html, /Selecciona sucursal del inventario/)
    html = renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(Sales)))
    assert.match(html, /Cargando ventas/)
    assert.match(html, /Nueva venta/)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
