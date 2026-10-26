import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const source = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const model = await import(url(await source('src/views/credits/creditPlanModel.js')))
const { createOperationGate } = await import(url(await source('src/views/credits/creditModel.js')))
const apiUrl = url(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const credit = await import(
  url((await source('src/services/creditService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)))
)
const { saleService } = await import(
  url((await source('src/services/saleService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)))
)
const services = { credits: credit.creditService, sales: saleService }
const sale = (patch = {}) => ({
  id_venta: 71,
  id_cliente: 8,
  numero_venta: 'V-PRUEBA-PLAN',
  cliente: 'Cliente ficticio',
  total: '100.00',
  tipo_venta: 'CREDITO',
  estado: 'CONFIRMADA',
  ...patch,
})
const values = (patch = {}) => ({
  id_venta: '71',
  tasa_interes: '0',
  numero_cuotas: '2',
  frecuencia: 'MENSUAL',
  fecha_inicio: '2026-11-01',
  observacion: '',
  ...patch,
})

test('plan: selecciona ventas elegibles con APIs reales de ventas y créditos; excluye cualquier plan existente', () => {
  const sales = [
    sale(),
    sale({ id_venta: 72, tipo_venta: 'CONTADO' }),
    sale({ id_venta: 73, estado: 'BORRADOR' }),
    sale({ id_venta: 74, estado: 'ANULADA' }),
    sale({ id_venta: 75 }),
    sale({ id_venta: 76 }),
    sale({ id_venta: 77, id_cliente: null }),
    sale({ id_venta: 78, total: 0 }),
  ]
  const credits = [
    { id_venta: '75', estado: 'ANULADO' },
    { id_venta: 76, estado: 'PAGADO' },
  ]
  assert.deepEqual(
    model.eligibleCreditSales(sales, credits).map((s) => s.id_venta),
    [71],
  )
  assert.equal(sales.length, 8)
  assert.deepEqual(model.eligibleCreditSales([], []), [])
  for (const [s, c] of [
    [null, []],
    [[], null],
    [[null], []],
    [[sale()], [{}]],
    [[sale({ total: null })], []],
  ])
    assert.throws(() => model.eligibleCreditSales(s, c), /verificar/)
})

test('plan: selección y validaciones compatibles con backend, sin mínimos de fecha/interés inventados', () => {
  assert.equal(model.validateCreditPlan(values(), [sale()]), '')
  for (const patch of [
    { id_venta: '' },
    { id_venta: '999' },
    { tasa_interes: '' },
    { tasa_interes: -1 },
    { tasa_interes: 101 },
    { tasa_interes: Infinity },
    { numero_cuotas: 0 },
    { numero_cuotas: 121 },
    { numero_cuotas: 1.5 },
    { frecuencia: 'DIARIA' },
    { fecha_inicio: '' },
    { fecha_inicio: '2026-02-30' },
    { fecha_inicio: '2026-11-01T12:00:00Z' },
    { observacion: 'a'.repeat(501) },
  ])
    assert.notEqual(model.validateCreditPlan(values(patch), [sale()]), '')
  for (const frecuencia of model.planFrequencies)
    assert.equal(
      model.validateCreditPlan(
        values({
          tasa_interes: 100,
          numero_cuotas: 120,
          frecuencia,
          fecha_inicio: '2024-02-29',
          observacion: 'a'.repeat(500),
        }),
        [sale()],
      ),
      '',
    )
  for (const patch of [{ tipo_venta: 'CONTADO' }, { estado: 'BORRADOR' }, { id_cliente: null }])
    assert.notEqual(model.validateCreditPlan(values(), [sale(patch)]), '')
})

test('plan: POST solo envía campos aceptados y pasa el validator real sin BD', async () => {
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const { validarCrearCredito } = require('./src/validators/creditValidator.js')
  const { validationResult } = require('express-validator')
  const payload = credit.creditPlanPayload({
    ...values(),
    monto_financiado: 1,
    saldo_pendiente: 1,
    cuotas: [],
    id_cliente: 99,
  })
  assert.deepEqual(payload, {
    id_venta: 71,
    tasa_interes: 0,
    numero_cuotas: 2,
    frecuencia: 'MENSUAL',
    fecha_inicio: '2026-11-01',
    observacion: null,
  })
  for (const frecuencia of model.planFrequencies) {
    const req = { body: { ...payload, frecuencia } }
    for (const validator of validarCrearCredito) await validator.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
})

const withMock = async (handler, run) => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = { getItem: () => 'jwt-mock' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return handler(path.replace('http://localhost:3000/api', ''), options)
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
}
const ok = (data, message) => ({
  ok: true,
  json: async () => ({ ok: true, data, ...(message && { message }) }),
})

test('plan: carga catálogo, crea, cierra formulario y vuelve a consultar créditos sin recargar navegador', async () => {
  let created = false
  const returned = {
    id_credito: 31,
    id_venta: 71,
    cuotas: [{ numero_cuota: 1 }, { numero_cuota: 2 }],
  }
  await withMock(
    (path, options) => {
      if (path === '/ventas') return ok([sale(), sale({ id_venta: 72, tipo_venta: 'CONTADO' })])
      if (path === '/ventas/71') return ok(sale())
      if (path === '/creditos' && options.method === 'GET') return ok(created ? [returned] : [])
      if (path === '/creditos' && options.method === 'POST') {
        created = true
        return ok(returned, 'Crédito creado correctamente')
      }
      throw new Error('Ruta inesperada: ' + path)
    },
    async (calls) => {
      const controller = new AbortController()
      assert.equal((await model.loadCreditPlanSales(services, controller.signal)).length, 1)
      const response = await model.createCreditPlan(values(), services, controller.signal)
      let formOpen = true
      let rows = []
      const order = []
      await model.completeCreditPlanCreation(
        response,
        (result) => {
          formOpen = false
          order.push('cerrado')
          assert.equal(result.data.cuotas.length, 2)
        },
        async () => {
          order.push('recarga')
          rows = (await services.credits.list(controller.signal)).data
        },
      )
      assert.equal(formOpen, false)
      assert.equal(rows[0].id_venta, 71)
      assert.deepEqual(order, ['cerrado', 'recarga'])
      assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
      assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-mock'))
      assert.equal(calls[0].signal, controller.signal)
      assert.deepEqual(
        JSON.parse(calls.find((c) => c.method === 'POST').body),
        credit.creditPlanPayload(values()),
      )
    },
  )
})

test('plan: revalida antes de escribir y no envía POST ante duplicado o venta ya no elegible', async () => {
  for (const scenario of ['duplicate', 'cash', 'draft', 'wrong-id']) {
    await withMock(
      (path) =>
        path === '/creditos'
          ? ok(scenario === 'duplicate' ? [{ id_venta: 71, estado: 'ANULADO' }] : [])
          : ok(
              sale(
                scenario === 'cash'
                  ? { tipo_venta: 'CONTADO' }
                  : scenario === 'draft'
                    ? { estado: 'BORRADOR' }
                    : scenario === 'wrong-id'
                      ? { id_venta: 72 }
                      : {},
              ),
            ),
      async (calls) => {
        await assert.rejects(
          model.createCreditPlan(values(), services),
          scenario === 'duplicate' ? /ya tiene un crédito/ : /seleccionada|CONFIRMADA/,
        )
        assert.equal(
          calls.some((c) => c.method === 'POST'),
          false,
        )
      },
    )
  }
})

test('plan: errores 400/401/403/409 y red conservan mensajes; falla de catálogo impide crear', async () => {
  for (const status of [400, 401, 403, 409])
    await withMock(
      (path, options) => {
        if (options.method !== 'POST') return ok(path === '/creditos' ? [] : sale())
        return {
          ok: false,
          status,
          json: async () => ({
            message:
              status === 409 ? 'La venta ya tiene un crédito asociado' : 'Error del servidor',
            errores: [{ msg: 'Detalle de validación' }],
          }),
        }
      },
      async () => {
        await assert.rejects(model.createCreditPlan(values(), services), (e) => {
          const message = apiErrorMessage(e)
          assert.match(message, /Detalle de validación/)
          if (status === 401) assert.match(message, /sesión/)
          if (status === 403) assert.match(message, /permisos/)
          if (status === 409) assert.match(message, /ya tiene un crédito/)
          return e.status === status
        })
      },
    )
  await withMock(
    () => {
      throw new Error('Offline')
    },
    async (calls) => {
      await assert.rejects(model.loadCreditPlanSales(services), /conectar/)
      await assert.rejects(model.createCreditPlan(values(), services), /conectar/)
      assert.equal(
        calls.some((c) => c.method === 'POST'),
        false,
      )
    },
  )
  await withMock(
    (path, options) => {
      if (options.method === 'POST') throw new Error('Offline')
      return ok(path === '/creditos' ? [] : sale())
    },
    async () => {
      await assert.rejects(model.createCreditPlan(values(), services), /conectar/)
    },
  )
})

test('plan: exclusión síncrona bloquea dos creaciones simultáneas incluso antes del render', async () => {
  let release
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  const gate = createOperationGate()
  await withMock(
    async (path, options) => {
      if (options.method === 'POST') await waiting
      return ok(path === '/creditos' && options.method === 'GET' ? [] : sale())
    },
    async (calls) => {
      const first = gate.run(() => model.createCreditPlan(values(), services))
      assert.equal(await gate.run(() => model.createCreditPlan(values(), services)), false)
      release()
      await first
      assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
    },
  )
})

test('plan: después del POST confirmado, fallo de recarga mantiene formulario cerrado y no repite creación', async () => {
  let closed = false
  await assert.rejects(
    model.completeCreditPlanCreation(
      { ok: true },
      () => {
        closed = true
      },
      async () => {
        throw new Error('Fallo de lectura')
      },
    ),
    /lectura/,
  )
  assert.equal(closed, true)
})
