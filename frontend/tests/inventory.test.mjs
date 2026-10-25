import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const url = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const saleUrl = url(await source('src/views/sales/saleModel.js'))
const cashUrl = url(
  (await source('src/views/cash/cashModel.js')).replace(
    "'../sales/saleModel'",
    JSON.stringify(saleUrl),
  ),
)
const view = await import(
  url(
    (await source('src/views/inventory/inventoryView.js'))
      .replace("'../sales/saleModel'", JSON.stringify(saleUrl))
      .replace("'../cash/cashModel'", JSON.stringify(cashUrl)),
  )
)
const operation = await import(url(await source('src/views/inventory/inventoryOperation.js')))
const apiUrl = url(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const service = await import(
  url((await source('src/services/inventoryService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const { validarAjuste, validarStockMinimo } = require('./src/validators/inventoryValidator.js')
const { validationResult } = require('express-validator')
const stock = [
  {
    id_sucursal: 1,
    sucursal: 'Central',
    id_producto: 2,
    producto: 'Cable USB',
    sku: 'CAB-USB',
    tipo_control: 'CANTIDAD',
    stock_actual: '3',
    stock_minimo: '3',
    stock_bajo: 1,
  },
  {
    id_sucursal: 2,
    sucursal: 'Norte',
    id_producto: 2,
    producto: 'Cable USB',
    sku: 'CAB-USB',
    tipo_control: 'CANTIDAD',
    stock_actual: 10,
    stock_minimo: 3,
    stock_bajo: 0,
  },
  {
    id_sucursal: 1,
    sucursal: 'Central',
    id_producto: 4,
    producto: 'Teléfono',
    sku: 'TEL-1',
    tipo_control: 'SERIALIZADO',
    stock_actual: 0,
    stock_minimo: 1,
    stock_bajo: true,
  },
]
const units = [
  {
    id_unidad: 9,
    id_producto: 4,
    producto: 'Teléfono',
    sku: 'TEL-1',
    id_sucursal_actual: 1,
    sucursal: 'Central',
    imei1: '000000000000009',
    imei2: '000000000000019',
    numero_serie: 'SER-9',
    estado: 'DISPONIBLE',
  },
  {
    id_unidad: 10,
    id_producto: 4,
    producto: 'Teléfono',
    sku: 'TEL-1',
    id_sucursal_actual: 2,
    sucursal: 'Norte',
    imei1: '000000000000010',
    imei2: null,
    numero_serie: null,
    estado: 'VENDIDO',
  },
]
const movements = [
  {
    id_movimiento: 11,
    id_sucursal: 1,
    id_producto: 2,
    producto: 'Cable USB',
    sku: 'CAB-USB',
    tipo: 'COMPRA',
    cantidad: 3,
    tipo_referencia: 'COMPRA',
    id_referencia: 101,
    observacion: 'Ingreso documentado',
  },
  {
    id_movimiento: 12,
    id_sucursal: 2,
    id_producto: 4,
    producto: 'Teléfono',
    sku: 'TEL-1',
    tipo: 'VENTA',
    cantidad: -1,
    tipo_referencia: 'VENTA',
    id_referencia: 202,
  },
]

test('respuestas: preserva cantidades, IMEI con ceros, IDs y opcionales; rechaza listados inválidos', () => {
  for (const [section, rows] of [
    ['stock', stock],
    ['units', units],
    ['movements', movements],
  ]) {
    assert.deepEqual(view.inventoryRows({ ok: true, data: rows }, section), rows)
    assert.deepEqual(view.inventoryRows({ data: [] }, section), [])
    for (const data of [null, {}, [null], [{}]])
      assert.throws(() => view.inventoryRows({ data }, section), /inválid/)
  }
  assert.equal(view.inventoryRows({ data: units }, 'units')[0].imei1, '000000000000009')
  assert.equal(view.inventoryRows({ data: stock }, 'stock')[0].stock_actual, '3')
})

test('existencias: combina búsqueda, SKU, producto, sucursal y nivel sin alterar los datos', () => {
  assert.equal(view.filterInventoryRows(stock, 'stock', { query: '  cable USB  ' }).length, 2)
  assert.deepEqual(
    view.filterInventoryRows(stock, 'stock', {
      query: 'cab-usb',
      branch: '2',
      product: '2',
      level: 'normal',
    }),
    [stock[1]],
  )
  assert.equal(view.filterInventoryRows(stock, 'stock', { level: 'low' }).length, 2)
  assert.deepEqual(view.filterInventoryRows(stock, 'stock', { branch: '99' }), [])
  assert.deepEqual(view.filterInventoryRows(stock, 'stock', {}), stock)
  assert.equal(stock[0].stock_actual, '3')
})

test('stock bajo: utiliza el indicador definitivo del servidor y no inventa mínimos faltantes', () => {
  for (const flag of [1, '1', true]) assert.equal(view.stockLevel({ stock_bajo: flag }), 'low')
  for (const flag of [0, '0', false]) assert.equal(view.stockLevel({ stock_bajo: flag }), 'normal')
  for (const flag of [null, undefined, '', 'desconocido'])
    assert.equal(view.stockLevel({ stock_bajo: flag }), 'unknown')
  assert.equal(view.stockLevel({ stock_actual: 0, stock_minimo: null }), 'unknown')
})

test('serializados: busca IMEI1/IMEI2/serie y filtra sucursal actual, producto y estado', () => {
  for (const query of ['000000000000009', '000000000000019', 'ser-9'])
    assert.deepEqual(view.filterInventoryRows(units, 'units', { query }), [units[0]])
  assert.deepEqual(
    view.filterInventoryRows(units, 'units', {
      query: 'tel',
      product: '4',
      branch: '2',
      state: 'VENDIDO',
    }),
    [units[1]],
  )
  assert.deepEqual(
    view.filterInventoryRows(units, 'units', { branch: '2', state: 'DISPONIBLE' }),
    [],
  )
  assert.equal(view.branchId('units', { id_sucursal_actual: 2, id_sucursal: 99 }), '2')
  for (const state of [
    'DISPONIBLE',
    'VENDIDO',
    'DEFECTUOSO',
    'RESERVADO',
    'DEVUELTO',
    'EN_TRANSFERENCIA',
  ]) {
    assert.notEqual(view.unitStateColor(state), 'secondary')
    assert.ok(view.inventoryLabel(state))
    const row = { ...units[0], estado: state }
    assert.deepEqual(view.filterInventoryRows([row], 'units', { state }), [row])
  }
  assert.equal(view.unitStateColor('ESTADO_NUEVO'), 'secondary')
  assert.equal(view.inventoryLabel('ESTADO_NUEVO'), 'ESTADO_NUEVO')
})

test('movimientos: filtros por origen, ID de referencia, observación, tipo y sucursal', () => {
  assert.deepEqual(
    view.filterInventoryRows(movements, 'movements', {
      query: '101',
      type: 'COMPRA',
      branch: '1',
      product: '2',
    }),
    [movements[0]],
  )
  assert.deepEqual(
    view.filterInventoryRows(movements, 'movements', { query: 'ingreso documentado' }),
    [movements[0]],
  )
  assert.deepEqual(
    view.filterInventoryRows(movements, 'movements', { query: 'venta', type: 'VENTA' }),
    [movements[1]],
  )
  assert.deepEqual(
    view.filterInventoryRows(movements, 'movements', { product: '4', type: 'COMPRA' }),
    [],
  )
  assert.equal(movements[1].cantidad, -1)
})

test('validación de ajustes y mínimos: enteros, IDs, motivo, serializados y stock consultado', () => {
  const validate = operation.validateInventoryOperation
  const values = { tipo: 'SALIDA', cantidad: '3', observacion: ' Corrección ' }
  assert.equal(validate('adjust', stock[0], values), '')
  assert.equal(validate('minimum', stock[2], { stock_minimo: '0' }), '')
  for (const cantidad of ['', ' ', 0, -1, 1.5, 'NaN', Infinity, 4])
    assert.ok(validate('adjust', stock[0], { ...values, cantidad }))
  for (const observacion of ['', ' ', 'x'.repeat(501)])
    assert.ok(validate('adjust', stock[0], { ...values, observacion }))
  assert.ok(validate('adjust', stock[2], values))
  assert.ok(validate('adjust', { ...stock[0], stock_actual: null }, values))
  assert.ok(validate('adjust', stock[0], { ...values, tipo: 'VENTA' }))
  assert.ok(validate('otra', stock[0], values))
  assert.ok(validate('minimum', { ...stock[0], id_sucursal: 0 }, { stock_minimo: 1 }))
  for (const stock_minimo of ['', ' ', null, -1, 1.5, Infinity])
    assert.ok(validate('minimum', stock[0], { stock_minimo }))
})

test('payloads de ajuste y mínimo pasan los validators reales sin tocar la base de datos', async () => {
  const payload = service.adjustmentPayload(stock[0], {
    tipo: 'ENTRADA',
    cantidad: '2',
    observacion: ' Motivo ',
    stock_nuevo: 999,
    id_usuario: 999,
  })
  assert.deepEqual(payload, {
    id_sucursal: 1,
    id_producto: 2,
    tipo: 'ENTRADA',
    cantidad: 2,
    observacion: 'Motivo',
  })
  assert.deepEqual(service.minimumPayload('0'), { stock_minimo: 0 })
  for (const [validators, req] of [
    [validarAjuste, { body: payload }],
    [
      validarStockMinimo,
      { params: { idSucursal: '1', idProducto: '2' }, body: service.minimumPayload('3') },
    ],
  ]) {
    for (const validator of validators) await validator.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
})

test('servicio: rutas reales, JWT, señales y respuestas actualizadas; errores HTTP y red', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  const snapshots = { stock, units, movements }
  globalThis.localStorage = { getItem: () => 'INVENTORY_TEST_TOKEN' }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    const path = url.replace('http://localhost:3000/api', '')
    const data =
      path === '/inventario'
        ? snapshots.stock
        : path === '/unidades'
          ? snapshots.units
          : path === '/inventario/movimientos'
            ? snapshots.movements
            : { stock_nuevo: 5 }
    return { ok: true, json: async () => ({ ok: true, data }) }
  }
  try {
    const signal = new AbortController().signal
    assert.deepEqual((await service.inventoryService.stock(signal)).data, stock)
    assert.deepEqual((await service.inventoryService.units(signal)).data, units)
    assert.deepEqual((await service.inventoryService.movements(signal)).data, movements)
    assert.ok(calls.every((c) => c.options.method === 'GET' && c.options.signal === signal))
    await service.inventoryService.adjust(stock[0], {
      tipo: 'ENTRADA',
      cantidad: '2',
      observacion: ' Motivo ',
    })
    await service.inventoryService.setMinimum(stock[0], '3')
    assert.deepEqual(
      calls.map((c) => c.url.replace('http://localhost:3000/api', '')),
      [
        '/inventario',
        '/unidades',
        '/inventario/movimientos',
        '/inventario/ajustes',
        '/inventario/1/2/stock-minimo',
      ],
    )
    assert.equal(calls[3].options.method, 'POST')
    assert.equal(calls[4].options.method, 'PUT')
    assert.deepEqual(JSON.parse(calls[3].options.body), {
      id_sucursal: 1,
      id_producto: 2,
      tipo: 'ENTRADA',
      cantidad: 2,
      observacion: 'Motivo',
    })
    assert.deepEqual(JSON.parse(calls[4].options.body), { stock_minimo: 3 })
    assert.ok(calls.every((c) => c.options.headers.Authorization === 'Bearer INVENTORY_TEST_TOKEN'))
    // A subsequent GET must reflect the server snapshot, without client-side stock arithmetic.
    snapshots.stock = [{ ...stock[0], stock_actual: 5 }]
    snapshots.units = [{ ...units[0], estado: 'DEFECTUOSO' }]
    assert.equal((await service.inventoryService.stock()).data[0].stock_actual, 5)
    assert.equal((await service.inventoryService.units()).data[0].estado, 'DEFECTUOSO')
    for (const status of [400, 401, 403, 404, 409, 500]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: `Error real ${status}`,
          errores: [{ msg: 'Detalle del servidor' }],
        }),
      })
      for (const action of [
        () => service.inventoryService.stock(),
        () => service.inventoryService.units(),
        () => service.inventoryService.movements(),
        () =>
          service.inventoryService.adjust(stock[0], {
            tipo: 'SALIDA',
            cantidad: 1,
            observacion: 'Motivo',
          }),
        () => service.inventoryService.setMinimum(stock[0], 0),
      ]) {
        await assert.rejects(
          action(),
          (e) =>
            e.status === status &&
            apiErrorMessage(e).includes(`Error real ${status}`) &&
            apiErrorMessage(e).includes('Detalle del servidor') &&
            (status !== 401 || apiErrorMessage(e).includes('expiró')) &&
            (status !== 403 || apiErrorMessage(e).includes('permisos')),
        )
      }
    }
    globalThis.fetch = async () => {
      throw new TypeError('Network failed')
    }
    await assert.rejects(service.inventoryService.stock(), /conectar/)
    const aborted = new Error('Cancelado')
    aborted.name = 'AbortError'
    globalThis.fetch = async () => {
      throw aborted
    }
    await assert.rejects(service.inventoryService.units(), (e) => e === aborted)
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => {
        throw new Error('JSON inválido')
      },
    })
    await assert.rejects(service.inventoryService.movements(), /respuesta inválida/)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('fechas de Nicaragua: reutiliza formato legible y no expone ISO ni fechas inválidas', () => {
  assert.equal(view.formatInventoryDate(null), '—')
  assert.equal(view.formatInventoryDate('inválida'), 'Fecha no disponible')
  const formatted = view.formatInventoryDate('2026-10-24T14:30:00.000Z')
  assert.ok(formatted.includes('2026'))
  assert.ok(!formatted.includes('T14:30'))
  assert.equal(view.formatInventoryDate('2026-10-24 08:30:00'), formatted)
})
