import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Transferencias CoreUI: pantalla, carga, filtros, formulario, sucursales y detalle mixto sin API real', async () => {
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
    const { default: Transfers } = await server.ssrLoadModule('/src/views/transfers/Transfers.jsx')
    const { default: Form } = await server.ssrLoadModule('/src/views/transfers/TransferForm.jsx')
    const { default: Detail } = await server.ssrLoadModule(
      '/src/views/transfers/TransferDetail.jsx',
    )
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const html = renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(Transfers)),
    )
    for (const text of [
      'Transferencias entre sucursales',
      'Nueva transferencia',
      'Cargando transferencias',
      'Actualizar',
      'Estado',
      'Origen',
      'Destino',
      'No existe recepción separada',
    ])
      assert.ok(html.includes(text), text)
    assert.ok(!html.includes('Recibir transferencia'))
    const catalog = {
      products: [],
      stock: [],
      units: [],
      branches: [
        { id: '4', label: 'Centro' },
        { id: '5', label: 'Norte' },
      ],
    }
    for (const busy of [true, false]) {
      const form = render(Form, { catalog, busy, onSave() {} })
      for (const text of [
        'Número de transferencia',
        'Sucursal origen',
        'Sucursal destino',
        'Centro',
        'Norte',
        'Producto disponible en origen',
        busy ? 'Procesando…' : 'Revisar transferencia',
        'No hay artículos agregados',
      ])
        assert.ok(form.includes(text), text)
      assert.equal(form.includes('fieldset disabled'), busy)
    }
    for (const estado of ['BORRADOR', 'CONFIRMADA', 'ANULADA']) {
      const detail = render(Detail, {
        record: {
          id_transferencia: 8,
          numero_transferencia: 'TR-TEST',
          estado,
          sucursal_origen: 'Centro',
          sucursal_destino: 'Norte',
          usuario_solicita: 'operador-test',
          fecha_solicitud: '2026-10-28 09:00:00',
          detalles: [
            {
              id_producto: 1,
              producto: 'Cable',
              sku: 'CB',
              tipo_control: 'CANTIDAD',
              cantidad: 2,
              unidades: [],
            },
            {
              id_producto: 2,
              producto: 'Teléfono',
              sku: 'TL',
              tipo_control: 'SERIALIZADO',
              cantidad: 1,
              unidades: [
                {
                  id_unidad: 11,
                  imei1: '001234567890123',
                  imei2: null,
                  numero_serie: 'SERIE-TEST',
                  estado: 'DISPONIBLE',
                  id_sucursal_actual: 4,
                },
              ],
            },
          ],
        },
      })
      for (const text of [
        estado,
        'TR-TEST',
        'Cable',
        'Teléfono',
        '2 productos',
        '3 unidades',
        '001234567890123',
        'SERIE-TEST',
        'Ubicación actual',
        'table-responsive',
      ])
        assert.ok(detail.includes(text), text)
      assert.equal(detail.split('001234567890123').length - 1, 1)
      assert.ok(!detail.includes('2026-10-28T'))
    }
  } finally {
    globalThis.fetch = original
    await server.close()
  }
})
