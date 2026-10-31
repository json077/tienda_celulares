import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = (file) => readFile(new URL('../src/' + file, import.meta.url), 'utf8')
const url = (code) => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const availability = await import(url(await source('views/sales/saleAvailability.js')))
const permissions = await import(url(await source('auth/permissions.js')))
const apiUrl = url(await source('services/api.js'))
const { api, bindAuthorization } = await import(apiUrl)
const { inventoryService } = await import(
  url((await source('services/inventoryService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const unit = (changes = {}) => ({
  id_unidad: 8,
  id_producto: 10,
  id_sucursal_actual: 1,
  imei1: '000000000000001',
  imei2: null,
  numero_serie: '0001',
  ...changes,
})

test('IMEI_VER consulta solo disponibilidad parametrizada, sin gestionar ni registrar', async () => {
  const original = { fetch: globalThis.fetch, storage: globalThis.localStorage }
  let actor = { id_usuario: 7, roles: ['VENDEDOR'], permisos: ['IMEI_VER'] }
  const calls = []
  const unbind = bindAuthorization({
    permissionFor: permissions.endpointPermission,
    can: (code) => permissions.canAccess(actor, code),
    onDenied() {},
  })
  globalThis.localStorage = { getItem: () => 'simulado' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path: new URL(path), options })
    return { ok: true, status: 200, json: async () => ({ ok: true, data: [unit()] }) }
  }
  try {
    const controller = new AbortController()
    const rows = await availability.loadSaleUnits(inventoryService, 1, [10, 10], controller.signal)
    assert.equal(rows[0].estado, 'DISPONIBLE')
    assert.equal(rows[0].imei1, '000000000000001')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].path.pathname, '/api/unidades/disponibles')
    assert.equal(calls[0].path.searchParams.get('id_producto'), '10')
    assert.equal(calls[0].path.searchParams.get('id_sucursal'), '1')
    assert.equal(calls[0].options.method, 'GET')
    assert.equal(calls[0].options.signal, controller.signal)
    await assert.rejects(inventoryService.units(), (e) => e.status === 403)
    await assert.rejects(api.post('/unidades', {}, { token: 'simulado' }), (e) => e.status === 403)
    await assert.rejects(
      api.post('/inventario/ajustes', {}, { token: 'simulado' }),
      (e) => e.status === 403,
    )
    actor = { ...actor, permisos: ['IMEI_GESTIONAR'] }
    await assert.rejects(inventoryService.availableUnits(10, 1), (e) => e.permission === 'IMEI_VER')
    actor = { ...actor, permisos: [] }
    await assert.rejects(inventoryService.availableUnits(10, 1), (e) => e.status === 403)
    assert.equal(calls.length, 1)
  } finally {
    unbind()
    globalThis.fetch = original.fetch
    globalThis.localStorage = original.storage
  }
})

test('normaliza respuesta limitada y rechaza otro producto/sucursal, duplicados y respuestas invalidas', async () => {
  const rows = availability.normalizeSaleUnits(
    { data: [unit({ costo: 'SECRET', id_detalle_compra: 99 })] },
    10,
    1,
  )
  assert.equal(JSON.stringify(rows).includes('SECRET'), false)
  assert.equal(rows[0].numero_serie, '0001')
  for (const response of [
    {},
    { data: null },
    { data: [unit({ id_producto: 99 })] },
    { data: [unit({ id_sucursal_actual: 2 })] },
    { data: [unit(), unit()] },
    { data: [unit({ imei1: 123 })] },
  ]) {
    assert.throws(() => availability.normalizeSaleUnits(response, 10, 1))
  }
  let calls = 0
  const service = {
    availableUnits: async () => {
      calls++
      return { data: [] }
    },
  }
  await assert.rejects(availability.loadSaleUnits(service, 0, [10]))
  await assert.rejects(availability.loadSaleUnits(service, 1, ['1.5']))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(availability.loadSaleUnits(service, 1, [10], controller.signal), {
    name: 'AbortError',
  })
  assert.equal(calls, 0)
})

test('cambiar filtros descarta selecciones y respuestas tardias; cancelar no restaura unidades', async () => {
  const previous = [{ id_producto: 10, cantidad: 1, selected: ['8'] }]
  assert.deepEqual(availability.clearSaleSelections(previous), [{ ...previous[0], selected: [] }])
  assert.deepEqual(previous[0].selected, ['8'])
  const query = availability.createAvailabilityQuery()
  let firstResolve, secondResolve, firstSignal
  const shown = []
  const first = query.run(
    (signal) => {
      firstSignal = signal
      return new Promise((resolve) => {
        firstResolve = resolve
      })
    },
    (rows) => shown.push(rows),
    assert.fail,
  )
  const second = query.run(
    () =>
      new Promise((resolve) => {
        secondResolve = resolve
      }),
    (rows) => shown.push(rows),
    assert.fail,
  )
  assert.equal(firstSignal.aborted, true)
  secondResolve(['nuevo'])
  await second
  firstResolve(['anterior'])
  await first
  assert.deepEqual(shown, [['nuevo']])
  const last = query.run(
    () =>
      new Promise((resolve) => {
        firstResolve = resolve
      }),
    (rows) => shown.push(rows),
    assert.fail,
  )
  query.cancel()
  firstResolve(['cancelado'])
  await last
  assert.deepEqual(shown, [['nuevo']])
  const errors = []
  await query.run(
    async () => {
      throw Object.assign(new Error('Permiso revocado'), { status: 403 })
    },
    assert.fail,
    (error) => errors.push(error.status),
  )
  assert.deepEqual(errors, [403])
})

test('hook oculta datos anteriores antes del efecto y no consulta sin permiso/filtros', async () => {
  const hooks = [],
    pendingEffects = []
  let index = 0,
    cleanup,
    calls = []
  const react = {
    useState(initial) {
      const slot = index++
      if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial
      return [
        hooks[slot],
        (next) => {
          hooks[slot] = next
        },
      ]
    },
    useEffect(effect) {
      pendingEffects.push(effect)
    },
  }
  const module = { exports: {} }
  const executable =
    (await source('views/sales/useSaleUnits.js'))
      .replace(/import {([^}]+)} from '([^']+)'/g, "const {$1} = require('$2')")
      .replaceAll('export const ', 'const ') + '\nmodule.exports = { useSaleUnits }'
  vm.runInNewContext(executable, {
    module,
    queueMicrotask,
    require(name) {
      if (name === 'react') return react
      if (name === './saleAvailability') return availability
      if (name === '../../services/api') return { apiErrorMessage: (error) => error.message }
      assert.fail(name)
    },
  })
  const load = async (branch, products) => {
    calls.push([branch, Array.from(products)])
    return [unit()]
  }
  const render = (branch, products, allowed) => {
    index = 0
    return module.exports.useSaleUnits(JSON.stringify([branch, '', products]), allowed, load)
  }
  const flush = async () => {
    cleanup?.()
    cleanup = pendingEffects.pop()()
    pendingEffects.length = 0
    await new Promise(setImmediate)
    await new Promise(setImmediate)
  }
  try {
    render('1', ['10'], true)
    await flush()
    assert.equal(render('1', ['10'], true).rows.length, 1)
    const next = render('2', ['10'], true)
    assert.equal(next.rows.length, 0, 'No muestra filas de la sucursal anterior')
    assert.equal(next.loading, true)
    await flush()
    assert.deepEqual(calls, [
      ['1', ['10']],
      ['2', ['10']],
    ])
    render('2', ['10'], false)
    await flush()
    assert.equal(render('2', ['10'], false).rows.length, 0)
    render('', [], true)
    await flush()
    assert.equal(calls.length, 2)
  } finally {
    cleanup?.()
  }
})

test('formulario real: cambiar producto/sucursal elimina selecciones y no muestra IMEI anteriores', async () => {
  const harness = {
    index: 0,
    values: new Map(),
    fields: [],
    state(initial, realUseState) {
      const index = this.index++
      const [value] = realUseState(this.values.has(index) ? this.values.get(index) : initial)
      this.values.set(index, value)
      return [
        value,
        (next) =>
          this.values.set(index, typeof next === 'function' ? next(this.values.get(index)) : next),
      ]
    },
  }
  globalThis.__availabilityForm = harness
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    plugins: [
      {
        name: 'availability-form-state',
        enforce: 'pre',
        transform(code, id) {
          if (!/\/(SaleForm\.jsx|useSaleUnits\.js)$/.test(id.replaceAll('\\', '/'))) return
          code = code.replace(/\buseState\b/, 'useState as realUseState')
          code +=
            '\nconst useState = (initial) => globalThis.__availabilityForm.state(initial, realUseState)\n'
          if (id.endsWith('SaleForm.jsx')) {
            code = code.replace(/\bCFormSelect,/, 'CFormSelect as CoreSelect,')
            code +=
              'const CFormSelect = (props) => { globalThis.__availabilityForm.fields.push(props); return React.createElement(CoreSelect, props) }\n'
          }
          return code
        },
      },
    ],
  })
  try {
    const { default: Form } = await server.ssrLoadModule('/src/views/sales/SaleForm.jsx')
    const values = {
      numero_venta: '',
      id_cliente: '',
      id_sucursal: '1',
      tipo_venta: 'CONTADO',
      observacion: '',
      detalles: [
        {
          id_producto: 10,
          tipo_control: 'SERIALIZADO',
          producto: 'Telefono',
          sku: 'T',
          cantidad: 1,
          precio_unitario: 10,
          selected: ['8'],
        },
      ],
    }
    const scope = JSON.stringify(['1', '', ['10']])
    harness.values.set(0, values)
    harness.values.set(5, {
      scope: JSON.stringify([scope, true]),
      rows: [unit({ estado: 'DISPONIBLE' })],
      loading: false,
      error: '',
    })
    const catalog = {
      products: [
        { id_producto: 10, activo: 1, tipo_control: 'SERIALIZADO', nombre: 'Telefono' },
        { id_producto: 20, activo: 1, tipo_control: 'SERIALIZADO', nombre: 'Otro' },
      ],
      clients: [],
      stock: [{ id_sucursal: 1, id_producto: 10, stock_actual: 2 }],
    }
    const render = (allowed = true) => {
      harness.index = 0
      harness.fields = []
      return renderToStaticMarkup(
        React.createElement(Form, {
          catalog,
          saving: false,
          canReadUnits: allowed,
          onSave() {},
          onCancel() {},
        }),
      )
    }
    assert.match(render(), /000000000000001/)
    assert.equal(harness.fields.find((field) => field.id === 'sale-units-0').value[0], '8')
    assert.doesNotMatch(
      render(false),
      /000000000000001/,
      'Revocar lectura oculta el resultado anterior inmediatamente',
    )
    render()
    harness.fields
      .find((field) => field.id === 'sale-product')
      .onChange({ target: { value: '20' } })
    assert.deepEqual(harness.values.get(0).detalles[0].selected, [])
    assert.doesNotMatch(render(), /000000000000001/)
    assert.equal(!!harness.fields.find((field) => field.id === 'sale-units-0').disabled, true)
    harness.fields.find((field) => field.id === 'sale-branch').onChange({ target: { value: '2' } })
    assert.deepEqual(harness.values.get(0).detalles, [])
    assert.equal(harness.values.get(1), '')
    assert.doesNotMatch(render(), /sale-units-0|000000000000001/)
  } finally {
    delete globalThis.__availabilityForm
    await server.close()
  }
})
