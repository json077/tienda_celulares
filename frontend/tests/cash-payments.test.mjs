import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const apiUrl = moduleUrl(await source('src/services/api.js'))
const saleUrl = moduleUrl(
  (await source('src/services/saleService.js')).replace("'./api'", JSON.stringify(apiUrl)),
)
const loadService = async (name) =>
  import(
    moduleUrl(
      (await source(`src/services/${name}.js`))
        .replace("'./api'", JSON.stringify(apiUrl))
        .replace("'./saleService'", JSON.stringify(saleUrl)),
    )
  )
const cash = await loadService('cashService')
const payment = await loadService('paymentService')
const api = await import(apiUrl)
const model = await import(
  moduleUrl(
    (await source('src/views/cash/cashModel.js')).replace(
      "'../sales/saleModel'",
      JSON.stringify(moduleUrl(await source('src/views/sales/saleModel.js'))),
    ),
  )
)
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const cashValidators = require('./src/validators/cashValidator.js')
const paymentValidators = require('./src/validators/paymentValidator.js')
const { validationResult } = require('express-validator')
const boxes = [{ id_caja: 3, activo: 1 }]
const session = { id_sesion_caja: 7, id_caja: 3, id_sucursal: 2, estado: 'ABIERTA' }
const sale = {
  id_venta: 8,
  id_sucursal: 2,
  tipo_venta: 'CONTADO',
  estado: 'CONFIRMADA',
  total: '100.00',
}
const rate = { id_moneda: 14, moneda: 'NIO', tasa: 1, activo: 1 }
const values = {
  id_venta: '8',
  id_moneda: '14',
  id_sesion_caja: '7',
  metodo: 'EFECTIVO',
  monto: '40',
  referencia: '',
}

test('payloads: solo campos reales; usuario y tipo de cambio corresponden al servidor', () => {
  assert.deepEqual(
    cash.openingPayload({
      id_caja: '3',
      monto_apertura: '0',
      observacion: ' apertura ',
      id_usuario: 9,
    }),
    { id_caja: 3, monto_apertura: 0, observacion: 'apertura' },
  )
  assert.deepEqual(cash.closingPayload({ monto_cierre_real: '40.50', observacion: ' ' }), {
    monto_cierre_real: 40.5,
    observacion: null,
  })
  assert.deepEqual(cash.movementPayload({ tipo: 'EGRESO', monto: '2', concepto: ' gastos ' }), {
    tipo: 'EGRESO',
    monto: 2,
    concepto: 'gastos',
  })
  assert.deepEqual(payment.paymentPayload({ ...values, tipo_cambio: 999, id_usuario: 999 }), {
    id_venta: 8,
    id_moneda: 14,
    id_sesion_caja: 7,
    metodo: 'EFECTIVO',
    monto: 40,
    referencia: null,
  })
  assert.deepEqual(payment.paymentPayload({ ...values, metodo: 'TARJETA', referencia: ' REF ' }), {
    id_venta: 8,
    id_moneda: 14,
    id_sesion_caja: null,
    metodo: 'TARJETA',
    monto: 40,
    referencia: 'REF',
  })
})

test('saldos informativos: solo APLICADO, no inferir cobro por CONFIRMADA', () => {
  assert.deepEqual(model.paymentBalance(sale, []), { paid: 0, pending: 100 })
  assert.deepEqual(
    model.paymentBalance(sale, [
      { estado: 'APLICADO', monto_base: '40' },
      { estado: 'ANULADO', monto_base: 60 },
    ]),
    { paid: 40, pending: 60 },
  )
  assert.equal(model.paymentBalance(sale, null), null)
  assert.equal(model.paymentBalance(sale, [{ estado: 'APLICADO' }]), null)
  assert.equal(model.paymentBalance({ total: null }, []), null)
})

test('apertura, cierre y movimientos: límites y estados incompatibles', () => {
  const opening = { id_caja: 3, monto_apertura: '0' }
  model.validateCash('open', opening, null, boxes)
  for (const bad of ['', '-1', 'NaN', 'Infinity'])
    assert.throws(() =>
      model.validateCash('open', { ...opening, monto_apertura: bad }, null, boxes),
    )
  assert.throws(() => model.validateCash('open', opening, session, boxes), /abierta/)
  assert.throws(() => model.validateCash('open', opening, null, [{ id_caja: 3, activo: 0 }]))
  model.validateCash('close', { monto_cierre_real: '0' }, session, boxes)
  assert.throws(() => model.validateCash('close', { monto_cierre_real: '' }, session, boxes))
  assert.throws(() =>
    model.validateCash(
      'close',
      { monto_cierre_real: 10 },
      { ...session, estado: 'CERRADA' },
      boxes,
    ),
  )
  model.validateCash('movement', { tipo: 'INGRESO', monto: 10, concepto: 'Aporte' }, session, boxes)
  for (const bad of [
    { tipo: 'VENTA', monto: 10, concepto: 'A' },
    { tipo: 'EGRESO', monto: 0, concepto: 'A' },
    { tipo: 'INGRESO', monto: 10, concepto: ' ' },
  ])
    assert.throws(() => model.validateCash('movement', bad, session, boxes))
  assert.throws(() =>
    model.validateCash('open', { ...opening, observacion: 'x'.repeat(501) }, null, boxes),
  )
})

test('pagos: sobrepago, crédito, sucursal, sesión cerrada, referencia y tasa', () => {
  model.validatePayment(values, sale, [], session, rate)
  model.validatePayment(
    { ...values, metodo: 'TRANSFERENCIA', referencia: 'REF' },
    sale,
    [],
    null,
    rate,
  )
  const invalid = [
    [{ ...values, monto: '' }, sale, [], session, rate],
    [{ ...values, monto: -1 }, sale, [], session, rate],
    [{ ...values, monto: 101 }, sale, [], session, rate],
    [values, { ...sale, tipo_venta: 'CREDITO' }, [], session, rate],
    [values, { ...sale, estado: 'BORRADOR' }, [], session, rate],
    [values, sale, null, session, rate],
    [values, sale, [{ estado: 'APLICADO', monto_base: 100 }], session, rate],
    [values, sale, [], { ...session, estado: 'CERRADA' }, rate],
    [values, sale, [], { ...session, id_sucursal: 99 }, rate],
    [values, sale, [], null, rate],
    [{ ...values, metodo: 'TARJETA' }, sale, [], null, rate],
    [{ ...values, referencia: 'x'.repeat(151) }, sale, [], session, rate],
    [values, sale, [], session, { ...rate, activo: 0 }],
    [values, sale, [], session, { ...rate, id_moneda: 999 }],
    [values, sale, [], session, { ...rate, moneda: 'EUR' }],
    [values, sale, [], session, { ...rate, tasa: 0 }],
  ]
  for (const args of invalid) assert.throws(() => model.validatePayment(...args))
  const usd = { id_moneda: 25, moneda: 'USD', tasa: '36.5', activo: 1 }
  model.validatePayment({ ...values, id_moneda: 25, monto: 2 }, sale, [], session, usd)
  assert.throws(
    () => model.validatePayment({ ...values, id_moneda: 25, monto: 3 }, sale, [], session, usd),
    /supera/,
  )
})

test('payloads aceptados por los validators reales sin acceder a base de datos', async () => {
  for (const [validators, body] of [
    [cashValidators.validarAbrirCaja, cash.openingPayload({ id_caja: 3, monto_apertura: 0 })],
    [cashValidators.validarCerrarCaja, cash.closingPayload({ monto_cierre_real: 40 })],
    [
      cashValidators.validarMovimientoManual,
      cash.movementPayload({ tipo: 'INGRESO', monto: 10, concepto: 'Aporte' }),
    ],
    [paymentValidators.validarRegistrarPago, payment.paymentPayload(values)],
    [
      paymentValidators.validarRegistrarPago,
      payment.paymentPayload({ ...values, metodo: 'TRANSFERENCIA', referencia: 'REF' }),
    ],
  ]) {
    const req = { body }
    for (const validator of validators) await validator.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
  for (const [validators, body] of [
    [cashValidators.validarAbrirCaja, { id_caja: 0, monto_apertura: -1 }],
    [cashValidators.validarCerrarCaja, { monto_cierre_real: -1 }],
    [paymentValidators.validarRegistrarPago, { ...values, metodo: 'CHEQUE', monto: 0 }],
  ]) {
    const req = { body }
    for (const validator of validators) await validator.run(req)
    assert.ok(validationResult(req).array().length > 0)
  }
})

test('servicios con fetch simulado: abrir → pagar → consultar pago → cerrar; rutas y JWT', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  let savedPayment = null
  let currentSession = null
  globalThis.localStorage = { getItem: () => 'TEST_TOKEN' }
  globalThis.fetch = async (url, options) => {
    const path = url.replace('http://localhost:3000/api', '')
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ path, options, body })
    let data
    if (path === '/cajas' && options.method === 'GET') data = boxes
    else if (path === '/cajas/abrir') {
      assert.deepEqual(body, { id_caja: 3, monto_apertura: 0, observacion: null })
      currentSession = { ...session, monto_apertura: 0 }
      data = currentSession
    } else if (path === '/cajas/sesiones/7') data = currentSession
    else if (path === '/tipos-cambio/moneda/14') data = rate
    else if (path === '/pagos' && options.method === 'POST') {
      assert.equal(currentSession.estado, 'ABIERTA')
      assert.deepEqual(body, payment.paymentPayload(values))
      savedPayment = {
        ...body,
        id_pago: 19,
        moneda: 'NIO',
        estado: 'APLICADO',
        tipo_cambio: 1,
        monto_base: 40,
      }
      data = { pago: savedPayment, total_venta: 100, total_pagado: 40, saldo_pendiente: 60 }
    } else if (path === '/pagos/venta/8') data = savedPayment ? [savedPayment] : []
    else if (path === '/cajas/sesiones/7/movimientos')
      data = {
        movimiento: { id_movimiento_caja: 20, ...body },
        saldo_anterior: 40,
        saldo_actual: 45,
      }
    else if (path === '/cajas/sesiones/7/cerrar') {
      assert.deepEqual(body, { monto_cierre_real: 45, observacion: null })
      currentSession = {
        ...currentSession,
        estado: 'CERRADA',
        monto_cierre_sistema: 45,
        monto_cierre_real: 45,
        diferencia: 0,
      }
      data = {
        sesion: currentSession,
        resumen: { monto_sistema: 45, monto_real: 45, diferencia: 0, resultado: 'CUADRADA' },
      }
    } else throw new Error(`Ruta inesperada ${path}`)
    return { ok: true, json: async () => ({ ok: true, data }) }
  }
  try {
    assert.deepEqual((await cash.cashService.list()).data, boxes)
    assert.equal(
      (await cash.cashService.open({ id_caja: 3, monto_apertura: 0 })).data.estado,
      'ABIERTA',
    )
    assert.equal((await cash.cashService.session(7)).data.id_sesion_caja, 7)
    assert.equal((await payment.paymentService.rate(14)).data.tasa, 1)
    assert.deepEqual((await payment.paymentService.listForSale(8)).data, [])
    assert.equal((await payment.paymentService.register(values)).data.saldo_pendiente, 60)
    assert.equal((await payment.paymentService.listForSale(8)).data[0].id_sesion_caja, 7)
    assert.equal(
      (await cash.cashService.movement(7, { tipo: 'INGRESO', monto: 5, concepto: 'Aporte' })).data
        .saldo_actual,
      45,
    )
    const closing = await cash.cashService.close(7, { monto_cierre_real: 45 })
    assert.equal(closing.data.sesion.estado, 'CERRADA')
    assert.equal(closing.data.resumen.diferencia, 0)
    assert.ok(calls.every((c) => c.options.headers.Authorization === 'Bearer TEST_TOKEN'))
    assert.equal(calls.filter((c) => c.path === '/pagos' && c.options.method === 'POST').length, 1)
    const signal = new AbortController().signal
    await cash.cashService.list(signal)
    assert.equal(calls.at(-1).options.signal, signal)
    for (const status of [400, 401, 403, 404, 409, 500]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: `Error ${status}`,
          errors: [{ campo: 'monto', mensaje: 'Monto inválido' }],
        }),
      })
      for (const call of [
        () => cash.cashService.open({ id_caja: 3, monto_apertura: 0 }),
        () => payment.paymentService.register(values),
        () => cash.cashService.close(7, { monto_cierre_real: 0 }),
      ]) {
        await assert.rejects(
          call(),
          (e) =>
            e.status === status &&
            api.apiErrorMessage(e).includes('Monto inválido') &&
            (status !== 401 || api.apiErrorMessage(e).includes('expiró')) &&
            (status !== 403 || api.apiErrorMessage(e).includes('permisos')),
        )
      }
    }
    globalThis.fetch = async () => {
      throw new TypeError('Network failed')
    }
    await assert.rejects(payment.paymentService.register(values), /conectar/)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('fechas legibles de Nicaragua sin ISO crudo', () => {
  assert.equal(model.dateTime(null), '—')
  assert.equal(model.dateTime('invalida'), 'Fecha no disponible')
  const formatted = model.dateTime('2026-10-24T14:30:00.000Z')
  assert.ok(formatted.includes('2026'))
  assert.ok(!formatted.includes('T14:30'))
  assert.equal(model.dateTime('2026-10-24 08:30:00'), formatted)
})
