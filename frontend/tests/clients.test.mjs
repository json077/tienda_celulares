import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const model = await import(moduleUrl(await source('src/views/customers/clientModel.js')))
const apiUrl = moduleUrl(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const { customerService, customerPayload } = await import(
  moduleUrl(
    (await source('src/services/customerService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)),
  )
)
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const validators = require('./src/validators/clientValidator.js')
const { validationResult } = require('express-validator')

const draft = () => ({
  tipo_identificacion: ' Cédula ',
  identificacion: ' 001-TEST ',
  nombres: ' Ana María ',
  apellidos: ' López ',
  telefono: ' +505 8888-0000 ',
  email: ' ana@example.com ',
  direccion: ' Managua ',
  activo: true,
})
const client = (patch = {}) => ({
  ...customerPayload(draft(), true),
  id_cliente: 7,
  created_at: '2026-10-25T12:00:00.000Z',
  updated_at: null,
  ...patch,
})

test('normaliza IDs/estado sin perder identificación, teléfono, nulos o fechas; no muta datos', () => {
  const input = client({
    id_cliente: '7',
    activo: '0',
    identificacion: '0000123',
    telefono: null,
    apellidos: null,
  })
  const row = model.normalizeClient(input, 7)
  assert.equal(row.id_cliente, 7)
  assert.equal(row.activo, 0)
  assert.equal(row.identificacion, '0000123')
  assert.equal(row.telefono, null)
  assert.equal(row.created_at, input.created_at)
  assert.equal(model.clientName(row), 'Ana María')
  assert.equal(input.id_cliente, '7')
  assert.deepEqual(model.clientList({ data: [] }), [])
  assert.equal(model.clientList({ data: [input] })[0].id_cliente, 7)
  for (const response of [null, {}, { data: null }, { data: {} }, { data: [null] }])
    assert.throws(() => model.clientList(response), /inválido/)
  for (const patch of [
    { id_cliente: 0 },
    { id_cliente: 1.5 },
    { activo: 2 },
    { activo: null },
    { activo: '' },
    { nombres: '' },
    { email: 123 },
  ])
    assert.throws(() => model.normalizeClient(client(patch)), /inválido/)
  assert.throws(() => model.normalizeClient(client(), 8), /inválido/)
})

test('búsqueda por nombre completo, identificación, teléfono, email, dirección y filtro de estado', () => {
  const rows = [
    client(),
    client({
      id_cliente: 8,
      nombres: 'Pedro',
      apellidos: null,
      identificacion: 'OTRO',
      telefono: null,
      email: null,
      direccion: null,
      activo: 0,
    }),
  ]
  for (const query of [' ana maría lópez ', '001-test', '8888', 'ANA@EXAMPLE.COM', 'managua'])
    assert.deepEqual(
      model.filterClients(rows, query).map((c) => c.id_cliente),
      [7],
    )
  assert.equal(model.filterClients(rows).length, 2)
  assert.deepEqual(
    model.filterClients(rows, '', '0').map((c) => c.id_cliente),
    [8],
  )
  assert.equal(model.filterClients(rows, 'Ana', '0').length, 0)
  assert.equal(model.filterClients(rows, '', '1').length, 1)
  assert.deepEqual(model.filterClients([], 'ana', '1'), [])
})

test('valida campos reales y límites; no inventa formatos de cédula/teléfono/tipo', () => {
  assert.equal(model.validateClient(draft()), '')
  assert.equal(
    model.validateClient({
      ...draft(),
      tipo_identificacion: 'Pasaporte',
      identificacion: 'ABC 123',
      telefono: 'extensión 20',
      apellidos: null,
      email: '',
      direccion: '',
    }),
    '',
  )
  for (const key of ['tipo_identificacion', 'identificacion', 'nombres'])
    assert.notEqual(model.validateClient({ ...draft(), [key]: '  ' }), '')
  for (const [key, max] of [
    ['tipo_identificacion', 30],
    ['identificacion', 50],
    ['nombres', 100],
    ['apellidos', 100],
    ['telefono', 30],
    ['direccion', 255],
  ]) {
    assert.equal(model.validateClient({ ...draft(), [key]: 'x'.repeat(max) }), '')
    assert.notEqual(model.validateClient({ ...draft(), [key]: 'x'.repeat(max + 1) }), '')
  }
  for (const email of [
    'sin-arroba',
    'a@',
    'a@dominio',
    'a b@example.com',
    'a@b@c.com',
    'x'.repeat(151),
  ])
    assert.notEqual(model.validateClient({ ...draft(), email }), '')
})

test('payloads: creación activa por defecto, edición completa con estado y opcionales null', async () => {
  const created = customerPayload({ ...draft(), id_cliente: 99, saldo: 999, created_at: 'IGNORAR' })
  assert.deepEqual(created, {
    tipo_identificacion: 'Cédula',
    identificacion: '001-TEST',
    nombres: 'Ana María',
    apellidos: 'López',
    telefono: '+505 8888-0000',
    email: 'ana@example.com',
    direccion: 'Managua',
  })
  const edited = customerPayload(
    { ...draft(), activo: '0', apellidos: '', telefono: null, email: ' ', direccion: undefined },
    true,
  )
  assert.equal(edited.activo, false)
  for (const key of ['apellidos', 'telefono', 'email', 'direccion']) assert.equal(edited[key], null)
  assert.equal(customerPayload({ ...draft(), activo: 1 }, true).activo, true)
  for (const [rules, body] of [
    [validators.validarCrearCliente, created],
    [validators.validarActualizarCliente, edited],
  ]) {
    const req = { body, params: { idCliente: '7' } }
    for (const rule of [...validators.validarIdCliente, ...rules]) await rule.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
})

test('contrato HTTP: listado/detalle/crear/editar/desactivar/reactivar con JWT y sin cambiar respuesta de Ventas', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'jwt-prueba' }
  const calls = []
  let response = { ok: true, data: [client()] }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return { ok: true, json: async () => response }
  }
  try {
    const controller = new AbortController()
    assert.deepEqual(await customerService.list(controller.signal), response)
    assert.equal(calls[0].signal, controller.signal)
    response = { ok: true, data: client() }
    assert.deepEqual(await customerService.get(7), response)
    await customerService.create(draft())
    await customerService.update(7, { ...draft(), activo: false })
    await customerService.deactivate(7)
    await customerService.update(7, { ...response.data, activo: true })
    assert.deepEqual(
      calls.map((c) => c.method),
      ['GET', 'GET', 'POST', 'PUT', 'DELETE', 'PUT'],
    )
    assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-prueba'))
    assert.ok(calls.every((c) => c.path.startsWith('http://localhost:3000/api/clientes')))
    assert.equal(calls[4].path, 'http://localhost:3000/api/clientes/7')
    assert.equal(calls[4].body, undefined)
    assert.deepEqual(JSON.parse(calls[2].body), customerPayload(draft()))
    assert.equal(JSON.parse(calls[3].body).activo, false)
    assert.equal(JSON.parse(calls[5].body).activo, true)
    response = { ok: true, data: [] }
    assert.deepEqual(model.clientList(await customerService.list()), [])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('errores 400/401/403/404/409/500, validación, respuesta vacía, red y cancelación', async () => {
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
      await assert.rejects(customerService.create(draft()), (error) => {
        const message = apiErrorMessage(error)
        assert.match(message, /Mensaje del servidor/)
        assert.match(message, /Detalle inválido/)
        if (status === 401) assert.match(message, /sesión/)
        if (status === 403) assert.match(message, /permisos/)
        return error.status === status
      })
    }
    globalThis.fetch = async () => ({ ok: true, json: async () => null })
    await assert.rejects(customerService.list(), /respuesta inválida/)
    globalThis.fetch = async () => {
      throw new Error('Offline')
    }
    await assert.rejects(customerService.list(), /conectar/)
    globalThis.fetch = async () => {
      const error = new Error('Cancelado')
      error.name = 'AbortError'
      throw error
    }
    await assert.rejects(customerService.list(), { name: 'AbortError' })
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
