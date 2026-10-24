import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Carga ESM del frontend sin cambiar package.json ni instalar un runner.
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const model = await import(moduleUrl(await source('src/views/purchases/purchaseModel.js')))
const products = [
  { id_producto: 1, nombre: 'Cable', tipo_control: 'CANTIDAD', activo: 1 },
  { id_producto: 2, nombre: 'Teléfono', tipo_control: 'SERIALIZADO', activo: 1 },
  { id_producto: 3, nombre: 'Inactivo', tipo_control: 'CANTIDAD', activo: 0 },
]
const suppliers = [{ id_proveedor: 5, nombre: 'Proveedor', activo: 1 }]
const draft = () => ({
  id_proveedor: '5',
  id_sucursal: '8',
  numero_documento: ' DOC-1 ',
  observacion: '',
  detalles: [
    { id_producto: '1', cantidad: '2', costo_unitario: '10.125', descuento: '1', impuesto: '2' },
  ],
})
const purchase = () => ({
  id_compra: 9,
  estado: 'BORRADOR',
  detalles: [
    { id_detalle_compra: 10, producto: 'Cable', tipo_control: 'CANTIDAD', cantidad: 3 },
    { id_detalle_compra: 11, producto: 'Teléfono', tipo_control: 'SERIALIZADO', cantidad: 2 },
    { id_detalle_compra: 12, producto: 'Otro teléfono', tipo_control: 'SERIALIZADO', cantidad: 1 },
  ],
})
const units = () => [
  {
    id_detalle_compra: 11,
    imei1: '000000000000001',
    imei2: '000000000000004',
    numero_serie: 'SERIE-A',
  },
  { id_detalle_compra: 11, imei1: '000000000000002', imei2: '', numero_serie: '' },
  { id_detalle_compra: 12, imei1: '000000000000003', imei2: null, numero_serie: null },
]

test('borrador: acepta cantidad y serializados sin IMEI hasta la confirmación', () => {
  const values = draft()
  assert.equal(model.validateDraft(values, products, suppliers), '')
  values.detalles.push({ ...values.detalles[0], id_producto: '2' })
  assert.equal(model.validateDraft(values, products, suppliers), '')
})

test('borrador: exige proveedor activo, sucursal positiva, documento y al menos un producto', () => {
  for (const patch of [
    { id_proveedor: '' },
    { id_proveedor: '999' },
    { id_sucursal: '0' },
    { id_sucursal: '1.2' },
    { numero_documento: ' ' },
    { numero_documento: 'a'.repeat(81) },
    { observacion: 'a'.repeat(501) },
    { detalles: [] },
  ])
    assert.notEqual(model.validateDraft({ ...draft(), ...patch }, products, suppliers), '')
  assert.notEqual(model.validateDraft(draft(), products, [{ ...suppliers[0], activo: 0 }]), '')
})

test('borrador: rechaza producto inactivo, fracciones de cantidad y costos/ajustes inválidos', () => {
  for (const patch of [
    { id_producto: '3' },
    { id_producto: '99' },
    { cantidad: '0' },
    { cantidad: '1.5' },
    { cantidad: '-2' },
    { costo_unitario: '' },
    { costo_unitario: '-0.01' },
    { costo_unitario: 'Infinity' },
    { descuento: '-1' },
    { impuesto: '-1' },
    { descuento: '100' },
  ]) {
    const values = draft()
    values.detalles[0] = { ...values.detalles[0], ...patch }
    assert.notEqual(model.validateDraft(values, products, suppliers), '')
  }
  const values = draft()
  values.detalles[0] = { ...values.detalles[0], costo_unitario: '0', descuento: '', impuesto: '' }
  assert.equal(model.validateDraft(values, products, suppliers), '')
})

test('importes: redondea costo antes de multiplicar, admite descuentos/impuestos por importe', () => {
  assert.deepEqual(model.lineAmounts(draft().detalles[0]), {
    gross: 20.26,
    discount: 1,
    tax: 2,
    total: 21.26,
  })
  assert.deepEqual(model.draftTotals([...draft().detalles, ...draft().detalles]), {
    subtotal: 40.52,
    descuento: 2,
    impuesto: 4,
    total: 42.52,
  })
})

test('serializados: exige exactamente N unidades por ID de detalle y admite opcionales vacíos', () => {
  assert.equal(model.validateUnits(purchase(), units()), '')
  assert.notEqual(model.validateUnits(purchase(), units().slice(1)), '')
  assert.notEqual(model.validateUnits(purchase(), [...units(), units()[0]]), '')
  const wrong = units()
  wrong[2].id_detalle_compra = 11
  assert.notEqual(model.validateUnits(purchase(), wrong), '')
})

test('cantidad: no solicita unidades y rechaza IMEI asociados a detalles por cantidad o ajenos', () => {
  const quantityOnly = { ...purchase(), detalles: [purchase().detalles[0]] }
  assert.equal(model.validateUnits(quantityOnly, []), '')
  for (const id of [10, 999]) {
    assert.notEqual(
      model.validateUnits(purchase(), [...units(), { ...units()[0], id_detalle_compra: id }]),
      '',
    )
  }
})

test('serializados: IMEI1 obligatorio de 15 dígitos, IMEI2 opcional y series de hasta 80', () => {
  for (const patch of [
    { imei1: '' },
    { imei1: '123' },
    { imei1: 'a'.repeat(15) },
    { imei2: '123' },
    { numero_serie: 'a'.repeat(81) },
  ]) {
    const changed = units()
    Object.assign(changed[0], patch)
    assert.notEqual(model.validateUnits(purchase(), changed), '')
    assert.equal(model.unitComplete(changed[0]), false)
  }
  const padded = units()
  padded[0].imei1 = ` ${padded[0].imei1} `
  padded[0].numero_serie = 'a'.repeat(80)
  assert.equal(model.validateUnits(purchase(), padded), '')
})

test('serializados: detecta duplicados cruzados IMEI1/IMEI2, dentro de una unidad y entre líneas', () => {
  for (const [index, field, value] of [
    [0, 'imei2', units()[0].imei1],
    [1, 'imei1', units()[0].imei2],
    [2, 'imei2', units()[0].imei1],
    [2, 'numero_serie', 'SERIE-A'],
  ]) {
    const changed = units()
    changed[index][field] = value
    assert.match(model.validateUnits(purchase(), changed), /repetid/)
  }
})

test('sucursales: deduplica solamente sucursales realmente devueltas, sin inventar un catálogo', () => {
  assert.deepEqual(
    model.knownBranches(
      [{ id_sucursal: 8, codigo_sucursal: 'C', sucursal: 'Central' }],
      [
        { id_sucursal: 8, codigo_sucursal: 'C', sucursal: 'Central' },
        { id_sucursal: 0, sucursal: 'Inválida' },
      ],
    ),
    [{ id: '8', label: 'C · Central' }],
  )
  assert.deepEqual(model.knownBranches([], []), [])
})

test('listado: combina búsqueda insensible a mayúsculas con estado y sucursal', () => {
  const rows = [
    {
      id_compra: 1,
      numero_documento: 'DOC-1',
      proveedor: 'Proveedor',
      sucursal: 'Central',
      id_sucursal: 8,
      estado: 'BORRADOR',
      usuario: 'ana',
    },
    {
      id_compra: 2,
      numero_documento: 'DOC-2',
      proveedor: 'Otro',
      sucursal: 'Sur',
      id_sucursal: 9,
      estado: 'CONFIRMADA',
      usuario: 'luis',
    },
  ]
  assert.deepEqual(model.filterPurchases(rows, ' ANA ', 'BORRADOR', '8'), [rows[0]])
  assert.deepEqual(model.filterPurchases(rows, 'doc', 'CONFIRMADA', ''), [rows[1]])
  assert.deepEqual(model.filterPurchases(rows, '', '', '8'), [rows[0]])
  assert.deepEqual(model.filterPurchases(rows, 'ausente', '', ''), [])
})

test('detalle: rechaza respuesta incompleta, estado desconocido o ID distinto', () => {
  assert.equal(model.assertPurchase(purchase(), 9).id_compra, 9)
  for (const value of [
    null,
    {},
    { ...purchase(), estado: 'PAGADA' },
    { ...purchase(), detalles: [] },
    { ...purchase(), detalles: [{ cantidad: 1 }] },
  ])
    assert.throws(() => model.assertPurchase(value, 9))
  assert.throws(() => model.assertPurchase(purchase(), 99))
})

test('servicio: endpoints reales, token, señales, payload exacto, errores y ninguna escritura auxiliar', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  let status = 200
  let response = { ok: true, data: purchase(), message: 'Correcto' }
  globalThis.localStorage = { getItem: (key) => (key === 'token' ? 'test-token' : null) }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, body: options.body && JSON.parse(options.body) })
    return { ok: status < 400, status, json: async () => response }
  }
  try {
    const apiUrl = moduleUrl(await source('src/services/api.js'))
    const api = await import(apiUrl)
    const serviceSource = (await source('src/services/purchaseService.js')).replace(
      "'./api'",
      JSON.stringify(apiUrl),
    )
    const { purchaseService } = await import(moduleUrl(serviceSource))
    const signal = new AbortController().signal
    await purchaseService.list(signal)
    assert.equal(calls.at(-1).url, 'http://localhost:3000/api/compras')
    assert.equal(calls.at(-1).signal, signal)
    await purchaseService.get(9, signal)
    assert.equal(calls.at(-1).url, 'http://localhost:3000/api/compras/9')
    await purchaseService.create({
      ...draft(),
      estado: 'CONFIRMADA',
      total: 999,
      unidades: units(),
    })
    assert.deepEqual(calls.at(-1).body, {
      id_proveedor: 5,
      id_sucursal: 8,
      numero_documento: 'DOC-1',
      observacion: null,
      detalles: [
        { id_producto: 1, cantidad: 2, costo_unitario: 10.125, descuento: 1, impuesto: 2 },
      ],
    })
    await purchaseService.confirm(9, units())
    assert.equal(calls.at(-1).url, 'http://localhost:3000/api/compras/9/confirmar')
    assert.equal(calls.at(-1).body.unidades[1].imei2, null)
    assert.equal(calls.at(-1).body.unidades[1].numero_serie, null)
    assert.equal(calls.at(-1).body.unidades[0].imei1, '000000000000001')
    await purchaseService.confirm(9, [])
    assert.deepEqual(calls.at(-1).body, { unidades: [] })
    await purchaseService.cancel(9)
    assert.equal(calls.at(-1).url, 'http://localhost:3000/api/compras/9/anular')
    assert.deepEqual(calls.at(-1).body, {})
    assert.deepEqual(
      calls.map((call) => call.method),
      ['GET', 'GET', 'POST', 'POST', 'POST', 'POST'],
    )
    assert.ok(calls.every((call) => call.headers.Authorization === 'Bearer test-token'))
    assert.ok(calls.every((call) => !/inventario|unidades/.test(call.url)))
    for (const code of [400, 401, 403, 404, 409, 500]) {
      status = code
      response = {
        ok: false,
        message: 'Error de prueba',
        errores: [{ msg: 'Detalle de validación' }],
      }
      await assert.rejects(purchaseService.list(), (error) => {
        assert.equal(error.status, code)
        assert.match(api.apiErrorMessage(error), /Detalle de validación/)
        if (code === 401) assert.match(api.apiErrorMessage(error), /sesión/)
        if (code === 403) assert.match(api.apiErrorMessage(error), /permisos/)
        return true
      })
    }
  } finally {
    globalThis.fetch = originalFetch
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  }
})
