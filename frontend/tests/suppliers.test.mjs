import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const model = await import(moduleUrl(await source('src/views/suppliers/supplierModel.js')))
const apiUrl = moduleUrl(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const { supplierService, supplierPayload } = await import(
  moduleUrl(
    (await source('src/services/supplierService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)),
  )
)
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const validators = require('./src/validators/supplierValidator.js')
const { validationResult } = require('express-validator')
const draft = () => ({
  nombre: ' Distribuidora Prueba ',
  tipo_identificacion: ' RUC ',
  identificacion: ' 000TEST ',
  telefono: ' +505 8888-0000 ',
  email: ' prueba@example.com ',
  direccion: ' Managua ',
  activo: true,
})
const supplier = (patch = {}) => ({
  ...supplierPayload(draft(), true),
  id_proveedor: 5,
  created_at: '2026-10-25T12:00:00Z',
  updated_at: null,
  ...patch,
})

test('proveedores: normalización no muta datos y preserva ceros, opcionales y fechas; rechaza respuestas inválidas', () => {
  const raw = supplier({ id_proveedor: '5', activo: '0', telefono: null, identificacion: '000001' })
  const normalized = model.normalizeSupplier(raw, 5)
  assert.equal(normalized.id_proveedor, 5)
  assert.equal(normalized.activo, 0)
  assert.equal(normalized.identificacion, '000001')
  assert.equal(normalized.telefono, null)
  assert.equal(normalized.created_at, raw.created_at)
  assert.equal(raw.id_proveedor, '5')
  assert.deepEqual(model.supplierList({ data: [] }), [])
  assert.equal(model.supplierList({ data: [raw] })[0].id_proveedor, 5)
  for (const response of [null, {}, { data: null }, { data: {} }, { data: [null] }])
    assert.throws(() => model.supplierList(response), /inválido/)
  for (const patch of [
    { id_proveedor: 0 },
    { id_proveedor: 1.5 },
    { activo: 2 },
    { activo: null },
    { activo: '' },
    { nombre: '' },
    { telefono: 123 },
  ])
    assert.throws(() => model.normalizeSupplier(supplier(patch)), /inválido/)
  assert.throws(() => model.normalizeSupplier(raw, 6), /inválido/)
})

test('proveedores: búsqueda por campos reales y estado combinados, vacíos y sin coincidencias', () => {
  const rows = [
    supplier(),
    supplier({
      id_proveedor: 6,
      nombre: 'Otro proveedor',
      identificacion: null,
      tipo_identificacion: null,
      telefono: null,
      email: null,
      direccion: null,
      activo: 0,
    }),
  ]
  for (const query of [
    ' DISTRIBUIDORA ',
    'ruc',
    '000test',
    '8888',
    'PRUEBA@EXAMPLE.COM',
    'managua',
  ])
    assert.deepEqual(
      model.filterSuppliers(rows, query).map((s) => s.id_proveedor),
      [5],
    )
  assert.equal(model.filterSuppliers(rows).length, 2)
  assert.deepEqual(
    model.filterSuppliers(rows, '', '0').map((s) => s.id_proveedor),
    [6],
  )
  assert.equal(model.filterSuppliers(rows, 'Distribuidora', '0').length, 0)
  assert.equal(model.filterSuppliers(rows, '', '1').length, 1)
  assert.deepEqual(model.filterSuppliers([], 'nombre', '0'), [])
})

test('proveedores: solo nombre obligatorio; límites reales, email y ausencia de patrones inventados', () => {
  assert.equal(model.validateSupplier({ nombre: 'A' }), '')
  assert.equal(
    model.validateSupplier({
      ...draft(),
      tipo_identificacion: '',
      identificacion: null,
      telefono: 'extensión 20',
    }),
    '',
  )
  assert.notEqual(model.validateSupplier({ nombre: '  ' }), '')
  for (const [key, max] of [
    ['nombre', 160],
    ['tipo_identificacion', 30],
    ['identificacion', 50],
    ['telefono', 30],
    ['direccion', 255],
  ]) {
    assert.equal(model.validateSupplier({ nombre: 'A', [key]: 'x'.repeat(max) }), '')
    assert.notEqual(model.validateSupplier({ nombre: 'A', [key]: 'x'.repeat(max + 1) }), '')
  }
  for (const email of [
    'sin-arroba',
    'a@',
    'a@dominio',
    'a b@example.com',
    'a@b@c.com',
    'x'.repeat(151),
  ])
    assert.notEqual(model.validateSupplier({ nombre: 'A', email }), '')
  assert.equal(model.validateSupplier(draft()), '')
})

test('proveedores: payload exacto y validators reales para creación mínima y edición con estado conservado', async () => {
  const created = supplierPayload({ ...draft(), id_proveedor: 99, saldo: 999 })
  assert.deepEqual(created, {
    nombre: 'Distribuidora Prueba',
    tipo_identificacion: 'RUC',
    identificacion: '000TEST',
    telefono: '+505 8888-0000',
    email: 'prueba@example.com',
    direccion: 'Managua',
  })
  const minimum = supplierPayload({ nombre: ' A ' })
  assert.equal(minimum.nombre, 'A')
  for (const key of ['tipo_identificacion', 'identificacion', 'telefono', 'email', 'direccion'])
    assert.equal(minimum[key], null)
  const inactive = supplierPayload({ ...draft(), activo: '0' }, true)
  assert.equal(inactive.activo, false)
  assert.equal(supplierPayload({ ...draft(), activo: true }, true).activo, true)
  for (const [rules, body] of [
    [validators.validarCrearProveedor, created],
    [validators.validarCrearProveedor, minimum],
    [validators.validarActualizarProveedor, inactive],
  ]) {
    const req = { body, params: { idProveedor: '5' } }
    for (const rule of [...validators.validarIdProveedor, ...rules]) await rule.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
})

test('proveedores: rutas reales/JWT/señales y respuesta intacta para Compras; DELETE devuelve solo ID', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'jwt-prueba' }
  const calls = []
  let response = { ok: true, data: [supplier()] }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return { ok: true, json: async () => response }
  }
  try {
    const controller = new AbortController()
    assert.deepEqual(await supplierService.list(controller.signal), response)
    assert.equal(calls[0].signal, controller.signal)
    response = { ok: true, data: supplier() }
    assert.deepEqual(await supplierService.get(5), response)
    await supplierService.create(draft())
    await supplierService.update(5, { ...draft(), activo: false })
    response = {
      ok: true,
      message: 'Proveedor desactivado correctamente',
      data: { id_proveedor: 5 },
    }
    assert.deepEqual(await supplierService.deactivate(5), response)
    await supplierService.update(5, { ...supplier(), activo: true })
    assert.deepEqual(
      calls.map((c) => c.method),
      ['GET', 'GET', 'POST', 'PUT', 'DELETE', 'PUT'],
    )
    assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-prueba'))
    assert.deepEqual(
      calls.map((c) => c.path),
      [
        '/proveedores',
        '/proveedores/5',
        '/proveedores',
        '/proveedores/5',
        '/proveedores/5',
        '/proveedores/5',
      ].map((p) => 'http://localhost:3000/api' + p),
    )
    assert.deepEqual(JSON.parse(calls[2].body), supplierPayload(draft()))
    assert.equal(JSON.parse(calls[3].body).activo, false)
    assert.equal(calls[4].body, undefined)
    assert.equal(JSON.parse(calls[5].body).activo, true)
    response = { ok: true, data: [] }
    assert.deepEqual(model.supplierList(await supplierService.list()), [])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('proveedores: errores HTTP, validación del servidor, red, respuesta vacía y cancelación', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'jwt-prueba' }
  try {
    for (const status of [400, 401, 403, 404, 409, 500]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: 'Mensaje del servidor',
          errores: [{ msg: 'Detalle inválido' }],
        }),
      })
      await assert.rejects(supplierService.create(draft()), (error) => {
        const message = apiErrorMessage(error)
        assert.match(message, /Mensaje del servidor/)
        assert.match(message, /Detalle inválido/)
        if (status === 401) assert.match(message, /sesión/)
        if (status === 403) assert.match(message, /permisos/)
        return error.status === status
      })
    }
    globalThis.fetch = async () => ({ ok: true, json: async () => null })
    await assert.rejects(supplierService.list(), /respuesta inválida/)
    globalThis.fetch = async () => {
      throw new Error('Offline')
    }
    await assert.rejects(supplierService.list(), /conectar/)
    globalThis.fetch = async () => {
      const error = new Error('Cancelado')
      error.name = 'AbortError'
      throw error
    }
    await assert.rejects(supplierService.list(), { name: 'AbortError' })
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
