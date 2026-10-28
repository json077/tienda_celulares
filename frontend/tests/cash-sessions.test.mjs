import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const source = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const saleUrl = url(await source('src/views/sales/saleModel.js'))
const cashUrl = url(
  (await source('src/views/cash/cashModel.js')).replace(
    "'../sales/saleModel'",
    JSON.stringify(saleUrl),
  ),
)
const cash = await import(cashUrl)
const model = await import(
  url(
    (await source('src/views/cash/cashSessionModel.js')).replace(
      "'./cashModel'",
      JSON.stringify(cashUrl),
    ),
  )
)
const apiUrl = url(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const service = await import(
  url((await source('src/services/cashService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const boxes = [{ id_caja: 3, id_sucursal: 2, nombre: 'Caja de prueba', activo: 1 }]
const session = (patch = {}) => ({
  id_sesion_caja: 8,
  id_caja: 3,
  id_sucursal: 2,
  caja: 'Caja de prueba',
  codigo_caja: 'C-TEST',
  sucursal: 'Sucursal ficticia',
  usuario_apertura: 'operador-test',
  estado: 'ABIERTA',
  monto_apertura: '100.00',
  fecha_apertura: '2026-10-25 08:00:00',
  monto_cierre_sistema: null,
  monto_cierre_real: null,
  diferencia: null,
  ...patch,
})
const result = {
  movimiento: {
    id_movimiento_caja: 4,
    id_sesion_caja: 8,
    tipo: 'INGRESO',
    monto: 10,
    usuario: 'operador-test',
    concepto: 'Entrada de prueba',
    tipo_referencia: 'MOVIMIENTO_MANUAL',
    id_referencia: null,
    fecha: '2026-10-25 09:00:00',
  },
  saldo_anterior: 100,
  saldo_actual: 110,
}

test('caja: mapeo de catálogo/sesión y montos firmados de cierre, nulos y respuestas inválidas', () => {
  assert.deepEqual(model.cashBoxList({ data: [] }), [])
  assert.deepEqual(model.cashBoxList({ data: boxes }), boxes)
  for (const data of [null, {}, [null], [{ ...boxes[0], activo: 3 }]])
    assert.throws(() => model.cashBoxList({ data }), /inválido/)
  const raw = session({
    id_sesion_caja: '8',
    diferencia: '-2.50',
    estado: 'CERRADA',
    monto_cierre_sistema: '100.00',
    monto_cierre_real: '97.50',
  })
  const normalized = model.normalizeCashSession(raw, 8)
  assert.equal(normalized.id_sesion_caja, 8)
  assert.equal(normalized.diferencia, '-2.50')
  assert.equal(raw.id_sesion_caja, '8')
  assert.equal(model.normalizeCashSession(session()).monto_cierre_sistema, null)
  for (const patch of [
    { id_sesion_caja: 0 },
    { id_caja: 0 },
    { estado: 'FICTICIO' },
    { monto_apertura: -1 },
    { monto_cierre_real: -1 },
  ])
    assert.throws(() => model.normalizeCashSession(session(patch)), /inválida/)
  assert.throws(() => model.normalizeCashSession(session(), 9), /inválida/)
  assert.equal(model.normalizeCashMovement(result, 8), result)
  assert.throws(() => model.normalizeCashMovement(result, 9), /registrado/)
})

test('caja: sesiones consultadas no se duplican; filtra sucursal, cajero, caja y estado sin inferir sesiones', () => {
  let rows = model.rememberCashSession([], session())
  rows = model.rememberCashSession(rows, session({ estado: 'CERRADA' }))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].estado, 'CERRADA')
  rows = model.rememberCashSession(rows, session({ id_sesion_caja: 9, caja: 'Otra caja' }))
  for (const query of ['ficticia', 'OPERADOR-TEST', 'c-test', '8'])
    assert.ok(model.filterCashSessions(rows, query, 'CERRADA').some((s) => s.id_sesion_caja === 8))
  assert.equal(model.filterCashSessions(rows, 'Otra', 'ABIERTA').length, 1)
  assert.deepEqual(model.filterCashSessions([], '', 'ABIERTA'), [])
})

test('caja: apertura, movimientos y cierre validan límites y payloads contra validator real sin BD', async () => {
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const validators = require('./src/validators/cashValidator.js')
  const { validationResult } = require('express-validator')
  assert.equal(service.openingPayload({ id_caja: 3 }).monto_apertura, 0)
  const cases = [
    [
      'open',
      { id_caja: 3, monto_apertura: 0, observacion: 'Apertura' },
      validators.validarAbrirCaja,
      service.openingPayload,
    ],
    [
      'movement',
      { tipo: 'EGRESO', monto: 5, concepto: 'Salida' },
      validators.validarMovimientoManual,
      service.movementPayload,
    ],
    [
      'close',
      { monto_cierre_real: 0, observacion: 'Cierre' },
      validators.validarCerrarCaja,
      service.closingPayload,
    ],
  ]
  for (const [mode, values, rules, payload] of cases) {
    assert.doesNotThrow(() =>
      cash.validateCash(mode, values, mode === 'open' ? null : session(), boxes),
    )
    const req = { body: payload(values), params: { idSesionCaja: '8' } }
    for (const rule of [...validators.validarIdSesionCaja, ...rules]) await rule.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
  for (const monto_apertura of ['', -1, Infinity])
    assert.throws(() => cash.validateCash('open', { id_caja: 3, monto_apertura }, null, boxes))
  for (const monto_cierre_real of ['', -1, Infinity])
    assert.throws(() => cash.validateCash('close', { monto_cierre_real }, session(), boxes))
  assert.throws(
    () =>
      cash.validateCash('close', { monto_cierre_real: 10 }, session({ estado: 'CERRADA' }), boxes),
    /ABIERTA/,
  )
  assert.throws(() =>
    cash.validateCash(
      'movement',
      { tipo: 'EGRESO', monto: 0, concepto: 'Salida' },
      session(),
      boxes,
    ),
  )
  assert.throws(() =>
    cash.validateCash('movement', { tipo: 'INGRESO', monto: 5, concepto: ' ' }, session(), boxes),
  )
  assert.throws(() =>
    cash.validateCash(
      'close',
      { monto_cierre_real: 10, observacion: 'a'.repeat(501) },
      session(),
      boxes,
    ),
  )
})

const withMock = async (handler, run) => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = { getItem: () => 'jwt-test' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return handler(path, options)
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
}
const ok = (data) => ({
  ok: true,
  json: async () => ({ ok: true, data, message: 'Confirmado por servidor' }),
})

test('caja: apertura → consulta → ingreso → cierre actualiza estado solo con respuestas servidor', async () => {
  await withMock(
    (path, options) => {
      if (path.endsWith('/cajas') && options.method === 'GET') return ok(boxes)
      if (path.endsWith('/movimientos')) return ok(result)
      if (path.endsWith('/cerrar'))
        return ok({
          sesion: session({
            estado: 'CERRADA',
            monto_cierre_sistema: 110,
            monto_cierre_real: 108,
            diferencia: -2,
          }),
          resumen: { monto_sistema: 110, monto_real: 108, diferencia: -2, resultado: 'FALTANTE' },
        })
      return ok(session())
    },
    async (calls) => {
      const signal = new AbortController().signal
      await service.cashService.list(signal)
      let shown = null
      let movement = null
      const getSession = async (id) =>
        model.normalizeCashSession((await service.cashService.session(id, signal)).data, id)
      const base = {
        boxes,
        service: service.cashService,
        getSession,
        onRefreshError: () => assert.fail('No debe fallar lectura'),
      }
      await model.commitCashOperation({
        ...base,
        mode: 'open',
        values: { id_caja: 3, monto_apertura: 100 },
        session: null,
        onCommitted: (response) => {
          shown = response.data
        },
      })
      assert.equal(shown.estado, 'ABIERTA')
      const refreshed = await model.commitCashOperation({
        ...base,
        mode: 'movement',
        values: { tipo: 'INGRESO', monto: 10, concepto: 'Entrada' },
        session: shown,
        onCommitted: (response) => {
          movement = response.data
        },
      })
      assert.equal(movement.saldo_actual, 110)
      assert.equal(refreshed.id_sesion_caja, 8)
      await model.commitCashOperation({
        ...base,
        mode: 'close',
        values: { monto_cierre_real: 108 },
        session: shown,
        onCommitted: (response) => {
          shown = response.data.sesion
          assert.equal(response.data.resumen.resultado, 'FALTANTE')
        },
      })
      assert.equal(shown.estado, 'CERRADA')
      assert.equal(shown.diferencia, -2)
      assert.equal(calls.filter((c) => c.method === 'POST').length, 3)
      assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-test'))
      assert.equal(calls[0].signal, signal)
    },
  )
})

test('caja: protege doble envío con la misma referencia síncrona utilizada por la UI', async () => {
  const pending = { current: false }
  let release
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  await withMock(
    async () => {
      await waiting
      return ok(session())
    },
    async (calls) => {
      const send = async () => {
        if (!model.acquireCashOperation(pending)) return false
        try {
          await service.cashService.open({ id_caja: 3, monto_apertura: 100 })
          return true
        } finally {
          pending.current = false
        }
      }
      const first = send()
      assert.equal(await send(), false)
      release()
      assert.equal(await first, true)
      assert.equal(calls.length, 1)
      assert.equal(pending.current, false)
    },
  )
})

test('caja: preconsulta cerrada o petición abortada impiden POST; fallo posterior de GET conserva éxito', async () => {
  let writes = 0
  let committed = false
  let refreshError = ''
  const base = {
    boxes,
    mode: 'movement',
    values: { tipo: 'INGRESO', monto: 10, concepto: 'Entrada' },
    session: session(),
    service: {
      movement: async () => {
        writes += 1
        return { data: result }
      },
    },
    onCommitted: () => {
      committed = true
    },
    onRefreshError: (e) => {
      refreshError = e.message
    },
  }
  await assert.rejects(
    model.commitCashOperation({ ...base, getSession: async () => session({ estado: 'CERRADA' }) }),
    /ABIERTA/,
  )
  assert.equal(writes, 0)
  const controller = new AbortController()
  controller.abort()
  await model.commitCashOperation({
    ...base,
    signal: controller.signal,
    getSession: async () => session(),
  })
  assert.equal(writes, 0)
  let reads = 0
  await model.commitCashOperation({
    ...base,
    getSession: async () => {
      reads += 1
      if (reads > 1) throw new Error('Fallo de recarga')
      return session()
    },
  })
  assert.equal(writes, 1)
  assert.equal(committed, true)
  assert.equal(refreshError, 'Fallo de recarga')
})

test('caja: respuesta ilegible tras POST confirmado invalida la sesión sin repetir escritura', async () => {
  for (const mode of ['open', 'movement', 'close']) {
    let writes = 0
    let selected = session({ estado: mode === 'open' ? 'CERRADA' : 'ABIERTA' })
    let failure
    const write = async () => {
      writes += 1
      return { data: null }
    }
    const updated = await model.commitCashOperation({
      mode,
      values: {
        id_caja: 3,
        monto_apertura: 100,
        monto_cierre_real: 100,
        tipo: 'INGRESO',
        monto: 10,
        concepto: 'Prueba',
      },
      session: selected,
      boxes,
      service: { open: write, close: write, movement: write },
      getSession: async () => session(),
      onCommitted: (response) => {
        if (mode === 'movement') model.normalizeCashMovement(response.data, 8)
        else model.normalizeCashSession(response.data)
      },
      onRefreshError: (error) => {
        selected = null
        failure = error
      },
    })
    assert.equal(writes, 1)
    assert.equal(selected, null)
    assert.equal(updated, null)
    assert.ok(failure instanceof Error)
  }
})

test('caja: errores 400/401/403/404/409, errors del validator, sesión duplicada y red', async () => {
  for (const status of [400, 401, 403, 404, 409])
    await withMock(
      () => ({
        ok: false,
        status,
        json: async () => ({
          message:
            status === 409 ? 'La caja ya tiene una sesión abierta' : 'Mensaje seguro del servidor',
          errors: [{ campo: 'monto', mensaje: 'Monto inválido' }],
        }),
      }),
      async () => {
        await assert.rejects(service.cashService.open({ id_caja: 3, monto_apertura: 100 }), (e) => {
          const message = apiErrorMessage(e)
          assert.match(message, /Monto inválido/)
          if (status === 401) assert.match(message, /sesión/)
          if (status === 403) assert.match(message, /permisos/)
          if (status === 409) assert.match(message, /ya tiene una sesión/)
          return e.status === status
        })
      },
    )
  await withMock(
    () => {
      throw new Error('Offline')
    },
    async () => {
      await assert.rejects(service.cashService.session(8), /conectar/)
    },
  )
})
