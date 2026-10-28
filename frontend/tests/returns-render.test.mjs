import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Devoluciones CoreUI: carga, filtros, artículos vendidos, formulario y detalle APTO/DEFECTUOSO sin API real', async () => {
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
  const render = (C, props) => renderToStaticMarkup(React.createElement(C, props))
  try {
    const { default: Returns } = await server.ssrLoadModule('/src/views/returns/Returns.jsx')
    const { default: Form } = await server.ssrLoadModule('/src/views/returns/ReturnForm.jsx')
    const { default: Detail } = await server.ssrLoadModule('/src/views/returns/ReturnDetail.jsx')
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const html = renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(Returns)),
    )
    for (const text of [
      'Devoluciones',
      'Nueva devolución',
      'Cargando devoluciones',
      'Actualizar',
      'Estado',
      'no reembolsa dinero',
      'cuotas',
    ])
      assert.ok(html.includes(text), text)
    assert.ok(!html.includes('Reembolsar pago'))
    const context = {
      sale: {
        id_venta: 4,
        numero_venta: 'V-TEST',
        cliente: 'Cliente prueba',
        sucursal: 'Centro',
        tipo_venta: 'CREDITO',
      },
      lines: [
        {
          id_detalle_venta: 10,
          producto: 'Cable',
          tipo_control: 'CANTIDAD',
          cantidad: 3,
          returned: 1,
          remaining: 2,
          units: [],
        },
        {
          id_detalle_venta: 20,
          producto: 'Teléfono',
          tipo_control: 'SERIALIZADO',
          cantidad: 1,
          returned: 0,
          remaining: 1,
          units: [],
        },
      ],
      serialError: 'Sin acceso FACTURA_IMPRIMIR',
    }
    for (const busy of [true, false]) {
      const form = render(Form, { context, busy, onSave() {} })
      for (const text of [
        'V-TEST',
        'Cliente prueba',
        'Número de devolución',
        'Motivo de la devolución',
        'Cable',
        'Teléfono',
        'Vendidos: 3',
        'Devueltos confirmados: 1',
        'Pendientes: 2',
        'Sin IMEI verificables pendientes',
        'FACTURA_IMPRIMIR',
        busy ? 'Procesando…' : 'Revisar devolución',
      ])
        assert.ok(form.includes(text), text)
      assert.equal(form.includes('fieldset disabled'), busy)
    }
    for (const estado of ['BORRADOR', 'CONFIRMADA', 'ANULADA']) {
      const detail = render(Detail, {
        record: {
          id_devolucion: 8,
          numero_devolucion: 'DEV-TEST',
          id_venta: 4,
          id_sucursal: 2,
          fecha: '2026-10-28 09:00:00',
          motivo: 'Falla técnica',
          total_devuelto: 100,
          estado,
          detalles: [
            {
              id_detalle_venta: 20,
              producto: 'Teléfono',
              tipo_control: 'SERIALIZADO',
              cantidad: 1,
              id_unidad: 11,
              imei1: '001234567890123',
              condicion: 'DEFECTUOSO',
              reintegra_inventario: 0,
              precio_unitario: 100,
              subtotal: 100,
            },
            {
              id_detalle_venta: 10,
              producto: 'Cable',
              tipo_control: 'CANTIDAD',
              cantidad: 1,
              id_unidad: null,
              condicion: 'APTO',
              reintegra_inventario: 1,
              precio_unitario: 20,
              subtotal: 20,
            },
          ],
        },
        header: { numero_venta: 'V-TEST', sucursal: 'Centro', usuario: 'operador-test' },
      })
      for (const text of [
        estado,
        'DEV-TEST',
        'V-TEST',
        'Falla técnica',
        'DEFECTUOSO',
        'APTO',
        'operador-test',
        '100.00',
        'table-responsive',
        'no reembolsa dinero',
      ])
        assert.ok(detail.includes(text), text)
      assert.equal(detail.split('001234567890123').length - 1, 1)
    }
  } finally {
    globalThis.fetch = original
    await server.close()
  }
})
