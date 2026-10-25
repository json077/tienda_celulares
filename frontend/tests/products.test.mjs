import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
const source = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8')
const url = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const model = await import(url(await source('src/views/products/productModel.js')))
const apiUrl = url(await source('src/services/api.js'))
const service = await import(
  url(
    (await source('src/services/productService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)),
  )
)
const categories = [{ id_categoria: 1, activo: 1 }]
const brands = [{ id_marca: 2, activo: 1 }]
const draft = () => ({
  id_categoria: '1',
  id_marca: '',
  nombre: 'Cable USB',
  sku: ' cab ',
  descripcion: '',
  tipo_control: 'CANTIDAD',
  precio_venta: '20',
  permite_descuento: false,
  dias_garantia: 0,
  porcentaje_descuento_maximo: 0,
  activo: true,
})
const products = [
  { ...draft(), id_producto: 1, categoria: 'Accesorios', activo: 1, id_marca: null },
  {
    ...draft(),
    id_producto: 2,
    nombre: 'Samsung A55',
    sku: 'A55',
    id_categoria: 3,
    id_marca: 2,
    tipo_control: 'SERIALIZADO',
    activo: 0,
  },
]
test('listado y filtros combinados por nombre, SKU, categoría, marca, estado y control', () => {
  assert.equal(model.filterProducts(products).length, 2)
  for (const filters of [
    { search: ' samsung ' },
    { search: 'a55' },
    { category: '3' },
    { brand: '2' },
    { status: '0' },
    { control: 'SERIALIZADO' },
  ])
    assert.equal(model.filterProducts(products, filters)[0].id_producto, 2)
  assert.equal(
    model.filterProducts(products, { brand: 'none', status: '1', control: 'CANTIDAD' }).length,
    1,
  )
  assert.equal(model.filterProducts(products, { search: 'Samsung', status: '1' }).length, 0)
})
test('validación compatible con API, relaciones activas y ambos controles', () => {
  for (const tipo_control of ['CANTIDAD', 'SERIALIZADO'])
    assert.equal(model.validateProduct({ ...draft(), tipo_control }, categories, brands), '')
  for (const patch of [
    { sku: ' ' },
    { sku: 'x'.repeat(51) },
    { nombre: 'x' },
    { nombre: 'x'.repeat(161) },
    { id_categoria: 99 },
    { id_marca: 99 },
    { precio_venta: '' },
    { precio_venta: -1 },
    { precio_venta: Infinity },
    { tipo_control: 'IMEI' },
    { dias_garantia: 1.5 },
    { dias_garantia: 65536 },
    { permite_descuento: true, porcentaje_descuento_maximo: 101 },
  ])
    assert.notEqual(model.validateProduct({ ...draft(), ...patch }, categories, brands), '')
  assert.notEqual(model.validateProduct(draft(), [{ id_categoria: 1, activo: 0 }], brands), '')
})
test('contrato HTTP con mocks: listar, detalle, crear, editar, desactivar y reactivar sin stock/IMEI', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = { getItem: () => 'test-token' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return { ok: true, json: async () => ({ ok: true, data: products, message: 'Correcto' }) }
  }
  try {
    await service.productService.list()
    await service.productService.get(2)
    await service.productService.categories()
    await service.productService.brands()
    await service.productService.create({ ...draft(), stock: 999, imei: '123' })
    await service.productService.update(2, {
      ...draft(),
      tipo_control: 'SERIALIZADO',
      activo: false,
    })
    await service.productService.deactivate(2)
    await service.productService.update(2, { ...draft(), activo: true })
    assert.deepEqual(
      calls.map((c) => c.method),
      ['GET', 'GET', 'GET', 'GET', 'POST', 'PUT', 'DELETE', 'PUT'],
    )
    assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer test-token'))
    assert.equal(calls[6].path, 'http://localhost:3000/api/productos/2')
    const created = JSON.parse(calls[4].body)
    assert.equal(created.sku, 'CAB')
    assert.equal(created.id_marca, null)
    for (const field of ['activo', 'stock', 'imei', 'costo']) assert.equal(field in created, false)
    assert.equal(JSON.parse(calls[5].body).activo, false)
    assert.equal(JSON.parse(calls[7].body).activo, true)
    for (const status of [400, 401, 403, 409, 500]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({ message: 'Error de prueba', errores: [{ msg: 'Detalle' }] }),
      })
      await assert.rejects(
        service.productService.create(draft()),
        (error) =>
          service.productErrorMessage(error).includes('Detalle') && error.status === status,
      )
    }
    globalThis.fetch = async () => {
      throw new Error('Offline')
    }
    await assert.rejects(service.productService.list(), /conectar/)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('payloads de ambos controles pasan los validators reales sin base de datos', async () => {
  const { createRequire } = await import('node:module')
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const validators = require('./src/validators/productValidator.js')
  const { validationResult } = require('express-validator')
  for (const tipo_control of ['CANTIDAD', 'SERIALIZADO']) {
    for (const edit of [false, true]) {
      const req = {
        body: service.productPayload({ ...draft(), tipo_control }, edit),
        params: { id: '2' },
      }
      for (const validator of edit
        ? validators.validarActualizarProducto
        : validators.validarCrearProducto)
        await validator.run(req)
      assert.deepEqual(validationResult(req).array(), [])
    }
  }
})
