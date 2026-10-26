import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const source = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const model = await import(url(await source('src/views/credits/creditModel.js')))
const apiUrl = url(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const { creditService, installmentPayload } = await import(
  url((await source('src/services/creditService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)))
)
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const { validarPagarCuota } = require('./src/validators/creditValidator.js')
const { validationResult } = require('express-validator')

const quota = (patch = {}) => ({
  id_cuota: 9,
  id_credito: 3,
  numero_cuota: 1,
  fecha_vencimiento: '2026-11-25',
  monto_cuota: '110.00',
  monto_pagado: '10.00',
  saldo_cuota: '100.00',
  estado: 'PARCIAL',
  ...patch,
})
const credit = (patch = {}) => ({
  id_credito: 3,
  id_venta: 7,
  cliente: 'Ana López',
  identificacion: '000123',
  numero_venta: 'V-TEST',
  monto_financiado: '200.00',
  tasa_interes: '10.00',
  monto_interes: '20.00',
  monto_total: '220.00',
  saldo_pendiente: '210.00',
  numero_cuotas: 2,
  frecuencia: 'MENSUAL',
  fecha_inicio: '2026-10-25',
  estado: 'ACTIVO',
  estado_venta: 'CONFIRMADA',
  tipo_venta: 'CREDITO',
  total_venta: '200.00',
  cuotas: [quota()],
  ...patch,
})
const values = (patch = {}) => ({
  id_moneda: '1',
  metodo: 'EFECTIVO',
  monto: '10',
  id_sesion_caja: '4',
  referencia: '',
  ...patch,
})
const rate = { id_moneda: 1, moneda: 'NIO', tasa: 1, activo: 1 }
const session = { id_sesion_caja: 4, id_sucursal: 2, estado: 'ABIERTA' }
const sale = { id_venta: 7, id_sucursal: 2 }
const validate = (v = values(), c = credit(), q = quota(), r = rate, s = session, vta = sale) =>
  model.validateInstallment(v, c, q, r, s, vta)

test('créditos: listado/detalle conserva importes y referencias del servidor sin recalcular', () => {
  const raw = credit({ id_credito: '3', id_venta: '7' })
  const row = model.creditDetail({ data: raw }, 3)
  assert.equal(row.id_credito, 3)
  assert.equal(row.id_venta, 7)
  assert.equal(row.saldo_pendiente, '210.00')
  assert.equal(row.identificacion, '000123')
  assert.equal(row.cuotas[0].monto_pagado, '10.00')
  assert.equal(raw.id_credito, '3')
  assert.deepEqual(model.creditList({ data: [] }), [])
  for (const response of [null, {}, { data: {} }, { data: [null] }])
    assert.throws(() => model.creditList(response), /inválido/)
  for (const patch of [
    { monto_total: '' },
    { saldo_pendiente: null },
    { tasa_interes: Infinity },
    { estado: 'FICTICIO' },
    { id_credito: 0 },
  ])
    assert.throws(() => model.normalizeCredit(credit(patch)), /inválido/)
  assert.throws(() => model.creditDetail({ data: credit() }, 99), /inválido/)
  for (const cuotas of [
    null,
    [null],
    [{ ...quota(), id_credito: 4 }],
    [{ ...quota(), saldo_cuota: -1 }],
    [{ ...quota(), estado: 'OTRO' }],
  ])
    assert.throws(() => model.creditDetail({ data: credit({ cuotas }) }, 3), /cuotas inválidas/)
})

test('créditos: búsqueda y estado combinados, estados reales y vacíos', () => {
  const rows = [
    credit(),
    credit({
      id_credito: 4,
      cliente: 'Pedro',
      numero_venta: 'V-2',
      identificacion: null,
      estado: 'PAGADO',
    }),
    credit({ id_credito: 5, cliente: 'Luis', estado: 'ANULADO' }),
  ]
  for (const query of [' ana ', 'LÓPEZ', 'v-test', '000123'])
    assert.ok(model.filterCredits(rows, query).some((c) => c.id_credito === 3))
  assert.equal(model.filterCredits(rows, 'Ana', 'PAGADO').length, 0)
  assert.equal(model.filterCredits(rows, '', 'PAGADO')[0].cliente, 'Pedro')
  assert.equal(model.filterCredits(rows, '', 'ANULADO')[0].cliente, 'Luis')
  assert.deepEqual(model.filterCredits([], 'Ana'), [])
  assert.deepEqual(model.creditStates, ['ACTIVO', 'PAGADO', 'ANULADO'])
})

test('cuotas: permite parcial/vencida/pendiente; impide pagada/anulada, crédito inactivo y venta no confirmada', () => {
  for (const estado of ['PARCIAL', 'VENCIDA', 'PENDIENTE'])
    assert.equal(model.canPay(credit(), quota({ estado })), true)
  for (const estado of ['PAGADA', 'ANULADA'])
    assert.equal(model.canPay(credit(), quota({ estado })), false)
  for (const estado of ['PAGADO', 'ANULADO'])
    assert.notEqual(validate(values(), credit({ estado })), '')
  assert.notEqual(validate(values(), credit({ estado_venta: 'ANULADA' })), '')
  assert.notEqual(validate(values(), credit(), quota({ saldo_cuota: 0 })), '')
  assert.notEqual(validate(values(), credit(), quota({ id_cuota: 99 })), '')
})

test('abonos: valida monto, moneda consultada, referencia y sesión/sucursal sin inventar conversión', () => {
  assert.equal(validate(), '')
  for (const patch of [
    { monto: '' },
    { monto: 0 },
    { monto: -1 },
    { monto: Infinity },
    { monto: 101 },
    { id_moneda: 0 },
    { id_moneda: 2 },
    { metodo: 'OTRO' },
    { referencia: 'a'.repeat(101) },
    { id_sesion_caja: 5 },
  ])
    assert.notEqual(validate(values(patch)), '')
  assert.notEqual(validate(values(), credit(), quota(), { ...rate, activo: 0 }), '')
  assert.notEqual(
    validate(values(), credit(), quota(), rate, { ...session, estado: 'CERRADA' }),
    '',
  )
  assert.notEqual(validate(values(), credit(), quota(), rate, { ...session, id_sucursal: 99 }), '')
  assert.notEqual(validate(values(), credit(), quota(), rate, session, null), '')
  for (const metodo of ['TRANSFERENCIA', 'TARJETA']) {
    assert.notEqual(validate(values({ metodo })), '')
    assert.equal(
      validate(values({ metodo, referencia: 'REF' }), credit(), quota(), rate, null, null),
      '',
    )
  }
  // El servidor valida el monto convertido y la tasa vigente: no se calcula un nuevo saldo aquí.
  assert.equal(
    validate(values({ monto: 200 }), credit(), quota(), { ...rate, moneda: 'USD', tasa: 36 }),
    '',
  )
})

test('abonos: payload exacto para validator real, sin venta/saldo/interés/usuario/tasa aportados por React', async () => {
  const body = installmentPayload({
    ...values(),
    id_venta: 7,
    tasa_interes: 50,
    saldo_pendiente: 1,
    tipo_cambio: 99,
  })
  assert.deepEqual(body, {
    id_moneda: 1,
    metodo: 'EFECTIVO',
    monto: 10,
    id_sesion_caja: 4,
    referencia: null,
  })
  for (const metodo of ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']) {
    const payload = installmentPayload(values({ metodo, referencia: ' REF ' }))
    assert.equal(payload.id_sesion_caja, metodo === 'EFECTIVO' ? 4 : null)
    assert.equal(payload.referencia, 'REF')
    const req = { params: { idCuota: '9' }, body: payload }
    for (const rule of validarPagarCuota) await rule.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
})

test('historial: corresponde a la venta y no se atribuye una cuota inexistente; distingue fallo de vacío', () => {
  const payment = { id_pago: 8, id_venta: 7, monto: 10, monto_base: 10, tipo_cambio: 1 }
  assert.deepEqual(model.creditPaymentHistory({ data: [payment] }, 7), [payment])
  assert.deepEqual(model.creditPaymentHistory({ data: [] }, 7), [])
  for (const response of [
    { data: null },
    { data: [null] },
    { data: [{ ...payment, id_venta: 9 }] },
  ])
    assert.throws(() => model.creditPaymentHistory(response, 7), /historial/)
})

test('doble envío: la exclusión síncrona permite un solo pago y se libera tras éxito/error', async () => {
  const gate = model.createOperationGate()
  let release
  let count = 0
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  const first = gate.run(async () => {
    count += 1
    await waiting
  })
  assert.equal(
    await gate.run(async () => {
      count += 1
    }),
    false,
  )
  assert.equal(count, 1)
  release()
  assert.equal(await first, true)
  await assert.rejects(
    gate.run(async () => {
      throw new Error('Fallo')
    }),
    /Fallo/,
  )
  assert.equal(
    await gate.run(async () => {
      count += 1
    }),
    true,
  )
  assert.equal(count, 2)
})

test('servicio: GET/listado/detalle y POST cuota con JWT y errores reales; ninguna escritura en ventas o caja', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'jwt-prueba' }
  const calls = []
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return { ok: true, json: async () => ({ ok: true, data: credit(), message: 'Registrado' }) }
  }
  try {
    const controller = new AbortController()
    await creditService.list(controller.signal)
    await creditService.get(3, controller.signal)
    await creditService.pay(9, values())
    assert.deepEqual(
      calls.map((c) => c.method),
      ['GET', 'GET', 'POST'],
    )
    assert.deepEqual(
      calls.map((c) => c.path),
      ['/creditos', '/creditos/3', '/creditos/cuotas/9/pagar'].map(
        (p) => 'http://localhost:3000/api' + p,
      ),
    )
    assert.equal(calls[0].signal, controller.signal)
    assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-prueba'))
    assert.deepEqual(JSON.parse(calls[2].body), installmentPayload(values()))
    for (const status of [400, 401, 403, 404, 409, 500]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({
          message: 'Saldo o permiso del servidor',
          errores: [{ msg: 'Detalle de validación' }],
        }),
      })
      await assert.rejects(creditService.pay(9, values()), (e) => {
        assert.match(apiErrorMessage(e), /Saldo o permiso del servidor/)
        assert.match(apiErrorMessage(e), /Detalle de validación/)
        if (status === 401) assert.match(apiErrorMessage(e), /sesión/)
        if (status === 403) assert.match(apiErrorMessage(e), /permisos/)
        return e.status === status
      })
    }
    globalThis.fetch = async () => ({ ok: true, json: async () => null })
    await assert.rejects(creditService.list(), /respuesta inválida/)
    globalThis.fetch = async () => {
      throw new Error('Offline')
    }
    await assert.rejects(creditService.pay(9, values()), /conectar/)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('formato Nicaragua: importes legibles y fechas calendario sin desplazamiento', () => {
  assert.match(model.money('1234.50'), /1,234\.50/)
  assert.doesNotMatch(model.creditDate('2026-10-25'), /2026-10-24|T00/)
  assert.equal(model.creditDate(null), '—')
  assert.equal(model.creditDate('inválido'), 'Fecha no disponible')
  assert.equal(model.money(null), 'No disponible')
})
