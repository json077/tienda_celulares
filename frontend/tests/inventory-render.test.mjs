import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('CoreUI: existencias, IMEI, estados, referencias, vacíos y pantalla de carga', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Esta prueba no puede usar la API real.')
  }
  const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
  try {
    const load = async (file) => server.ssrLoadModule(`/src/views/inventory/${file}`)
    const { default: Inventory } = await load('Inventory.jsx')
    const { default: Table } = await load('InventoryTable.jsx')
    const { default: Detail } = await load('InventoryMovementDetail.jsx')
    const { StockLevelBadge, UnitStateBadge } = await load('InventoryStatus.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    let html = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: { can: () => true } },
        React.createElement(Inventory),
      ),
    )
    for (const label of [
      'Inventario',
      'Existencias',
      'Dispositivos / IMEI',
      'Movimientos',
      'Actualizar',
      'Cargando',
      'Nivel de stock',
      'Producto',
      'Limpiar filtros',
    ])
      assert.ok(html.includes(label), label)
    assert.ok(!html.includes('Editar IMEI'))
    assert.match(render(StockLevelBadge, { row: { stock_bajo: 1 } }), /bg-warning/)
    assert.match(render(StockLevelBadge, { row: { stock_bajo: 0 } }), /Sobre el mínimo/)
    assert.match(render(StockLevelBadge, { row: {} }), /No disponible/)
    const states = {
      DISPONIBLE: ['Disponible', 'success'],
      VENDIDO: ['Vendido', 'primary'],
      DEFECTUOSO: ['Defectuoso', 'danger'],
      RESERVADO: ['Reservado', 'warning'],
      DEVUELTO: ['Devuelto', 'info'],
      EN_TRANSFERENCIA: ['En transferencia', 'warning'],
    }
    for (const [state, [label, color]] of Object.entries(states)) {
      html = render(UnitStateBadge, { state })
      assert.ok(html.includes(label))
      assert.ok(html.includes(`bg-${color}`))
    }
    const row = {
      id_unidad: 1,
      producto: 'Teléfono',
      sku: 'TEL-1',
      imei1: '000000000000001',
      imei2: null,
      numero_serie: 'SER-1',
      sucursal: 'Central',
    }
    const columns = ['producto', 'sku', 'imei1', 'imei2', 'numero_serie', 'sucursal'].map(
      (key) => ({ key, label: key }),
    )
    html = render(Table, {
      columns,
      rows: [row],
      rowKey: (r) => String(r.id_unidad),
      emptyMessage: 'Sin registros',
    })
    for (const label of [
      'table-responsive',
      'Teléfono',
      'TEL-1',
      '000000000000001',
      'SER-1',
      'Central',
      '—',
    ])
      assert.ok(html.includes(label), label)
    assert.ok(!html.includes('<input'))
    assert.match(
      render(Table, {
        columns,
        rows: [],
        rowKey: () => '',
        emptyMessage: 'Sin resultados para los filtros',
      }),
      /Sin resultados para los filtros/,
    )
    html = render(Detail, {
      movement: {
        id_movimiento: 4,
        fecha: '2026-10-24T14:30:00.000Z',
        producto: 'Cable',
        sku: 'CAB',
        sucursal: 'Central',
        tipo: 'VENTA',
        cantidad: -2,
        stock_anterior: 5,
        stock_nuevo: 3,
        tipo_referencia: 'VENTA',
        id_referencia: 25,
        usuario: 'vendedor',
        id_usuario: 7,
        observacion: 'Salida por venta',
      },
    })
    for (const label of [
      '2026',
      'Cable',
      'CAB',
      'Central',
      'Venta',
      '-2',
      '5',
      '3',
      'VENTA #25',
      'vendedor',
      'Salida por venta',
    ])
      assert.ok(html.includes(label), label)
    assert.ok(!html.includes('2026-10-24T'))
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
