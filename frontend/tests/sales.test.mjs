import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const model = await import(moduleUrl(await source('src/views/sales/saleModel.js')))
const apiUrl = moduleUrl(await source('src/services/api.js'))
const service = await import(
  moduleUrl(
    (await source('src/services/saleService.js')).replace("'./api'", JSON.stringify(apiUrl)),
  )
)
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const { validarCrearVenta } = require('./src/validators/saleValidator.js')
const { validationResult } = require('express-validator')
const line = {
  id_producto: 1,
  producto: 'Cable',
  tipo_control: 'CANTIDAD',
  precio_unitario: 100,
  cantidad: 2,
  descuento: 10,
  impuesto: 0,
  permite_descuento: 1,
  porcentaje_descuento_maximo: 10,
}
const sale = {
  numero_venta: ' TEST-1 ',
  id_cliente: '2',
  id_sucursal: '3',
  tipo_venta: 'CONTADO',
  observacion: '',
  detalles: [line],
}
const stock = [{ id_sucursal: 3, id_producto: 1, stock_actual: 3 }]
const units = [
  {
    id_unidad: 4,
    id_producto: 1,
    id_sucursal_actual: 3,
    estado: 'DISPONIBLE',
    imei1: '000000000000004',
  },
]

test('stock real: rechaza cantidades inválidas, ausencia de inventario y suma de líneas repetidas', () => {
  model.validateLines(sale, stock, [])
  for (const quantity of [0, -1, 1.5, 4, 'NaN'])
    assert.throws(() =>
      model.validateLines({ ...sale, detalles: [{ ...line, cantidad: quantity }] }, stock, []),
    )
  assert.throws(() => model.validateLines(sale, [], []))
  assert.throws(() => model.validateLines({ ...sale, detalles: [line, line] }, stock, []))
})
test('descuentos: respeta permiso por producto, porcentaje máximo, bruto e impuesto', () => {
  for (const patch of [
    { descuento: 21 },
    { descuento: -1 },
    { permite_descuento: 0 },
    { impuesto: -1 },
    { impuesto: Infinity },
    { descuento: Infinity },
  ])
    assert.throws(() =>
      model.validateLines({ ...sale, detalles: [{ ...line, ...patch }] }, stock, []),
    )
  assert.deepEqual(model.totals([line]), { subtotal: 200, descuento: 10, impuesto: 0, total: 190 })
})
test('serializados: exige unidad disponible del producto/sucursal, cantidad exacta y no duplicados', () => {
  const serialized = { ...line, cantidad: 1, tipo_control: 'SERIALIZADO', selected: ['4'] }
  model.validateLines({ ...sale, detalles: [serialized] }, stock, units)
  for (const patch of [
    { selected: [] },
    { selected: ['99'] },
    { cantidad: 2, selected: ['4', '4'] },
  ])
    assert.throws(() =>
      model.validateLines({ ...sale, detalles: [{ ...serialized, ...patch }] }, stock, units),
    )
  for (const patch of [{ estado: 'VENDIDO' }, { id_producto: 2 }, { id_sucursal_actual: 2 }])
    assert.throws(() =>
      model.validateLines({ ...sale, detalles: [serialized] }, stock, [{ ...units[0], ...patch }]),
    )
})
test('payload de creación pasa los validadores reales, sin precio, costo o IMEI enviados', async () => {
  const payload = service.salePayload(sale)
  assert.deepEqual(payload, {
    id_cliente: 2,
    id_sucursal: 3,
    numero_venta: 'TEST-1',
    tipo_venta: 'CONTADO',
    observacion: null,
    detalles: [{ id_producto: 1, cantidad: 2, descuento: 10, impuesto: 0 }],
  })
  for (const tipo_venta of ['CONTADO', 'CREDITO']) {
    const req = { body: { ...payload, tipo_venta } }
    for (const validator of validarCrearVenta) await validator.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
  const req = {
    body: { ...payload, numero_venta: '', detalles: [{ id_producto: 1, cantidad: 0 }] },
  }
  for (const validator of validarCrearVenta) await validator.run(req)
  assert.ok(validationResult(req).array().length >= 2)
})
test('servicios: rutas reales, JWT, confirmar con IDs de detalle y errores HTTP', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = { getItem: () => 'TEST_TOKEN' }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => ({ ok: true, data: [] }) }
  }
  try {
    await service.saleService.list()
    await service.saleService.get(5)
    await service.saleService.create(sale)
    await service.saleService.confirm(5, [
      { id_detalle_venta: '9', id_unidad: '4', imei1: 'omitido' },
    ])
    await service.saleService.cancel(5)
    await service.saleService.invoice(5)
    await service.saleService.payments(5)
    assert.deepEqual(
      calls.map((c) => c.url.replace('http://localhost:3000/api', '')),
      [
        '/ventas',
        '/ventas/5',
        '/ventas',
        '/ventas/5/confirmar',
        '/ventas/5/anular',
        '/ventas/5/factura',
        '/pagos/venta/5',
      ],
    )
    assert.ok(calls.every((c) => c.options.headers.Authorization === 'Bearer TEST_TOKEN'))
    assert.deepEqual(JSON.parse(calls[3].options.body), {
      unidades: [{ id_detalle_venta: 9, id_unidad: 4 }],
    })
    for (const status of [400, 401, 403, 404, 409, 500]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: `Error ${status}`,
          errores: [{ msg: 'Detalle de validación' }],
        }),
      })
      await assert.rejects(
        service.saleService.list(),
        (e) => e.status === status && e.message === `Error ${status}` && e.errores.length === 1,
      )
    }
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
