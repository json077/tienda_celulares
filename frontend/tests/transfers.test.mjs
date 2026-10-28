import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const source = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const model = await import(url(await source('src/views/transfers/transferModel.js')))
const apiUrl = url(await source('src/services/api.js'))
const { apiErrorMessage } = await import(apiUrl)
const { transferService: service, transferPayload } = await import(
  url((await source('src/services/transferService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const catalog = {
  products: [
    { id_producto: 1, nombre: 'Cable', sku: 'CB', tipo_control: 'CANTIDAD', activo: 1 },
    { id_producto: 2, nombre: 'Teléfono', sku: 'TL', tipo_control: 'SERIALIZADO', activo: 1 },
    { id_producto: 3, nombre: 'Inactivo', tipo_control: 'CANTIDAD', activo: 0 },
  ],
  stock: [
    { id_sucursal: 4, sucursal: 'Centro', id_producto: 1, stock_actual: '5' },
    { id_sucursal: 4, sucursal: 'Centro', id_producto: 2, stock_actual: '2' },
  ],
  units: [
    {
      id_unidad: 11,
      id_producto: 2,
      id_sucursal_actual: 4,
      estado: 'DISPONIBLE',
      imei1: '001234567890123',
      imei2: '001234567890124',
    },
    {
      id_unidad: 12,
      id_producto: 2,
      id_sucursal_actual: 4,
      estado: 'VENDIDO',
      imei1: '001234567890125',
    },
    {
      id_unidad: 13,
      id_producto: 2,
      id_sucursal_actual: 5,
      estado: 'DISPONIBLE',
      imei1: '001234567890126',
    },
    {
      id_unidad: 14,
      id_producto: 2,
      id_sucursal_actual: 4,
      estado: 'DEFECTUOSO',
      imei1: '001234567890127',
    },
  ],
}
const draft = (patch = {}) => ({
  numero_transferencia: ' TR-TEST ',
  id_sucursal_origen: '4',
  id_sucursal_destino: '5',
  observacion: '',
  detalles: [{ id_producto: 1, cantidad: 2 }],
  ...patch,
})
const record = (patch = {}) => ({
  id_transferencia: 8,
  numero_transferencia: 'TR-TEST',
  estado: 'BORRADOR',
  id_sucursal_origen: 4,
  id_sucursal_destino: 5,
  sucursal_origen: 'Centro',
  sucursal_destino: 'Norte',
  usuario_solicita: 'operador',
  fecha_solicitud: '2026-10-28 09:00:00',
  detalles: [
    {
      id_detalle_transferencia: 9,
      id_producto: 1,
      producto: 'Cable',
      tipo_control: 'CANTIDAD',
      cantidad: 2,
      unidades: [],
    },
  ],
  ...patch,
})
const ok = (data, status = 200) => ({ ok: true, status, json: async () => ({ ok: true, data }) })
const withFetch = async (handler, run) => {
  const original = { fetch: globalThis.fetch, storage: globalThis.localStorage }
  const calls = []
  globalThis.localStorage = { getItem: () => 'jwt-test' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    return handler(path, options)
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = original.fetch
    globalThis.localStorage = original.storage
  }
}

test('transferencias: catálogo de origen filtra productos activos, stock y unidades DISPONIBLE', () => {
  assert.deepEqual(
    model.availableProducts(catalog, 4).map((p) => p.id_producto),
    [1, 2],
  )
  assert.deepEqual(model.availableProducts(catalog, 5), [])
  assert.deepEqual(
    model.availableProducts({ ...catalog, units: null }, 4).map((p) => p.id_producto),
    [1],
  )
  assert.deepEqual(
    model.availableUnits(catalog.units, 4, 2).map((u) => u.id_unidad),
    [11],
  )
  const branches = model.transferBranches(catalog.stock, [record()])
  assert.deepEqual(
    branches.map((b) => b.id),
    ['4', '5'],
  )
})

test('transferencias: sucursales, número, observación, cantidades enteras y stock insuficiente', () => {
  assert.doesNotThrow(() => model.validateTransfer(draft(), catalog))
  for (const patch of [
    { id_sucursal_destino: 4 },
    { id_sucursal_origen: 0 },
    { id_sucursal_destino: '' },
    { numero_transferencia: ' ' },
    { numero_transferencia: 'a'.repeat(51) },
    { observacion: 'a'.repeat(501) },
    { detalles: [] },
    ...[0, -1, 1.5, '', Infinity, 6].map((cantidad) => ({
      detalles: [{ id_producto: 1, cantidad }],
    })),
    { detalles: [{ id_producto: 3, cantidad: 1 }] },
    {
      detalles: [
        { id_producto: 1, cantidad: 1 },
        { id_producto: '1', cantidad: 1 },
      ],
    },
  ])
    assert.throws(() => model.validateTransfer(draft(patch), catalog))
  assert.throws(
    () => model.validateTransfer(draft({ detalles: [{ id_producto: 1, cantidad: 6 }] }), catalog),
    /insuficiente/,
  )
})

test('transferencias: IMEI específico, duplicados, otra sucursal, vendido/defectuoso y permiso ausente', () => {
  const values = draft({ detalles: [{ id_producto: 2, unidades: [11] }] })
  assert.doesNotThrow(() => model.validateTransfer(values, catalog))
  for (const unidades of [[], [11, 11], [12], [13], [14], [0], [999]])
    assert.throws(() =>
      model.validateTransfer(draft({ detalles: [{ id_producto: 2, unidades }] }), catalog),
    )
  assert.throws(() => model.validateTransfer(values, { ...catalog, units: null }), /Consulta/)
  assert.throws(
    () =>
      model.validateTransfer(
        draft({ detalles: [{ id_producto: 1, cantidad: 1, unidades: [11] }] }),
        catalog,
      ),
    /no admite/,
  )
  const duplicate = {
    ...catalog,
    units: [...catalog.units, { ...catalog.units[0], id_unidad: 15 }],
  }
  assert.throws(
    () =>
      model.validateTransfer(
        draft({ detalles: [{ id_producto: 2, unidades: [11, 15] }] }),
        duplicate,
      ),
    /IMEI duplicado/,
  )
})

test('transferencias: payload mixto y validators reales, sin usuario ni IMEI literal ni estado enviados', async () => {
  const values = draft({
    detalles: [
      { id_producto: 1, cantidad: '2' },
      { id_producto: 2, unidades: ['11'] },
    ],
  })
  model.validateTransfer(values, catalog)
  const body = transferPayload(values)
  assert.deepEqual(body, {
    numero_transferencia: 'TR-TEST',
    id_sucursal_origen: 4,
    id_sucursal_destino: 5,
    observacion: null,
    detalles: [
      { id_producto: 1, cantidad: 2 },
      { id_producto: 2, unidades: [11] },
    ],
  })
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const { validarCrearTransferencia } = require('./src/validators/transferValidator.js')
  const { validationResult } = require('express-validator')
  const req = { body }
  for (const rule of validarCrearTransferencia) await rule.run(req)
  assert.deepEqual(validationResult(req).array(), [])
})

test('transferencias: listado, filtros combinados, detalle válido y respuestas inválidas', () => {
  const rows = [
    record(),
    record({ id_transferencia: 10, estado: 'CONFIRMADA', usuario_solicita: 'otro' }),
  ]
  assert.equal(model.transferList({ data: rows }), rows)
  assert.equal(model.assertTransfer(rows[0], '8'), rows[0])
  assert.equal(model.filterTransfers(rows, ' OPERADOR ', 'BORRADOR', '4', '5').length, 1)
  assert.equal(model.filterTransfers(rows, '', '', '5').length, 0)
  for (const data of [null, {}, [{ id_transferencia: 0 }], [{ ...record(), estado: 'RECIBIDA' }]])
    assert.throws(() => model.transferList({ data }))
  for (const row of [null, record({ detalles: [] }), record({ estado: 'EN_TRANSITO' })])
    assert.throws(() => model.assertTransfer(row))
  assert.throws(() => model.assertTransfer(record(), 9))
})

test('transferencias: HTTP listado → creación → detalle → confirmar y anular, JWT y rutas reales', async () => {
  await withFetch(
    (path, options) => {
      if (path.endsWith('/confirmar')) return ok(record({ estado: 'CONFIRMADA' }))
      if (path.endsWith('/anular')) return ok(record({ estado: 'ANULADA' }))
      if (options.method === 'GET' && path.endsWith('/transferencias')) return ok([record()])
      return ok(record(), options.method === 'POST' ? 201 : 200)
    },
    async (calls) => {
      const signal = new AbortController().signal
      assert.equal(model.transferList(await service.list(signal)).length, 1)
      assert.equal(model.assertTransfer((await service.create(draft())).data).estado, 'BORRADOR')
      assert.equal(model.assertTransfer((await service.get(8, signal)).data, 8).id_transferencia, 8)
      let shown
      await model.processTransfer({
        action: 'confirm',
        record: record(),
        service,
        signal,
        onCurrent() {},
        onCommitted: (r) => {
          shown = model.assertTransfer(r.data)
        },
      })
      assert.equal(shown.estado, 'CONFIRMADA')
      await model.processTransfer({
        action: 'cancel',
        record: record(),
        service,
        signal,
        onCurrent() {},
        onCommitted: (r) => {
          shown = model.assertTransfer(r.data)
        },
      })
      assert.equal(shown.estado, 'ANULADA')
      assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-test'))
      assert.equal(calls[0].signal, signal)
      assert.deepEqual(
        calls.filter((c) => c.method === 'POST').map((c) => c.path.split('/api')[1]),
        ['/transferencias', '/transferencias/8/confirmar', '/transferencias/8/anular'],
      )
    },
  )
})

test('transferencias: transición concurrente o GET fallido impide POST; aborto impide escritura', async () => {
  for (const state of ['CONFIRMADA', 'ANULADA']) {
    let writes = 0
    let shown
    await assert.rejects(
      model.processTransfer({
        action: 'confirm',
        record: record(),
        service: {
          get: async () => okData(record({ estado: state })),
          confirm: async () => {
            writes += 1
          },
        },
        onCurrent: (r) => {
          shown = r
        },
        onCommitted() {},
      }),
      /ya está/,
    )
    assert.equal(writes, 0)
    assert.equal(shown.estado, state)
  }
  const controller = new AbortController()
  controller.abort()
  await model.processTransfer({
    action: 'cancel',
    record: record(),
    signal: controller.signal,
    service: { get: async () => okData(record()), cancel: () => assert.fail('No escribir') },
    onCurrent() {},
    onCommitted() {},
  })
  await assert.rejects(
    model.processTransfer({
      action: 'confirm',
      record: record(),
      service: {
        get: async () => {
          throw new Error('Offline')
        },
        confirm: () => assert.fail('No escribir'),
      },
      onCurrent() {},
      onCommitted() {},
    }),
    /Offline/,
  )
})
const okData = (data) => ({ ok: true, data })

test('transferencias: bloqueo síncrono impide doble envío antes del render y se libera al terminar', async () => {
  const pending = { current: false }
  let release
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  let writes = 0
  const send = async () => {
    if (!model.acquireTransferOperation(pending)) return false
    try {
      writes += 1
      await waiting
      return true
    } finally {
      pending.current = false
    }
  }
  const first = send()
  assert.equal(await send(), false)
  release()
  assert.equal(await first, true)
  assert.equal(writes, 1)
  assert.equal(pending.current, false)
})

test('transferencias: errores JSON 400/401/403/404/409 conservan contexto y mensajes del validator', async () => {
  for (const status of [400, 401, 403, 404, 409])
    await withFetch(
      () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: 'Stock insuficiente',
          errors: [{ type: 'field', path: 'detalles', msg: 'Seleccione unidades disponibles' }],
        }),
      }),
      async () => {
        await assert.rejects(service.create(draft()), (e) => {
          const message = apiErrorMessage(e)
          assert.equal(e.status, status)
          assert.match(message, /Stock insuficiente/)
          assert.match(message, /Seleccione unidades/)
          if (status === 401) assert.match(message, /expiró/)
          if (status === 403) assert.match(message, /permisos/)
          return true
        })
      },
    )
})

test('transferencias: HTML/500 no expone stack ni SQL; red, JSON inválido y aborto', async () => {
  for (const status of [400, 404, 409, 500])
    await withFetch(
      () => ({
        ok: false,
        status,
        json: async () => {
          throw new SyntaxError('SQL secreto')
        },
      }),
      async () => {
        await assert.rejects(
          service.confirm(8),
          (e) => e.status === status && !/SQL|stack|secreto/.test(e.message),
        )
      },
    )
  await withFetch(
    () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'SQL secreto', errors: [{ msg: 'stack' }] }),
    }),
    async () => {
      await assert.rejects(service.get(8), (e) => !/SQL|stack|secreto/.test(apiErrorMessage(e)))
    },
  )
  await withFetch(
    () => {
      throw new Error('Offline')
    },
    async () => {
      await assert.rejects(service.list(), /conectar/)
    },
  )
  await withFetch(
    () => ({ ok: true, json: async () => null }),
    async () => {
      await assert.rejects(service.create(draft()), /inválida/)
    },
  )
  await withFetch(
    () => {
      const e = new Error('Cancelada')
      e.name = 'AbortError'
      throw e
    },
    async () => {
      await assert.rejects(service.get(8), { name: 'AbortError' })
    },
  )
})

test('transferencias: POST confirmado no se repite si la actualización posterior falla', async () => {
  await withFetch(
    (path) => {
      if (path.endsWith('/transferencias'))
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'Fallo interno' }),
        }
      if (path.endsWith('/confirmar')) return ok(record({ estado: 'CONFIRMADA' }))
      return ok(record())
    },
    async (calls) => {
      let shown
      await model.processTransfer({
        action: 'confirm',
        record: record(),
        service,
        onCurrent() {},
        onCommitted: (response) => {
          shown = model.assertTransfer(response.data)
        },
      })
      await assert.rejects(service.list(), (e) => e.status === 500)
      assert.equal(shown.estado, 'CONFIRMADA')
      assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
      assert.equal(calls.length, 3)
    },
  )
})

test('backend real con repositorio simulado: crear no mueve stock, confirmar mueve cantidad e IMEI y anular solo borrador', async () => {
  const backendSource = await readFile(
    new URL('../../backend/src/services/transferService.js', import.meta.url),
    'utf8',
  )
  let state = 'BORRADOR'
  const changes = []
  const moves = []
  const locations = []
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  }
  const details = [
    {
      id_detalle_transferencia: 9,
      id_producto: 1,
      producto: 'Cable',
      tipo_control: 'CANTIDAD',
      cantidad: 2,
      activo: 1,
    },
    {
      id_detalle_transferencia: 10,
      id_producto: 2,
      producto: 'Teléfono',
      tipo_control: 'SERIALIZADO',
      cantidad: 1,
      activo: 1,
    },
  ]
  const repo = {
    pool: { getConnection: async () => connection },
    obtenerSucursal: async () => ({ activo: 1 }),
    obtenerProducto: async (_, value) => catalog.products.find((p) => p.id_producto === value),
    obtenerStock: async (_, branch) => ({ stock_actual: branch === 4 ? 5 : 0 }),
    obtenerUnidad: async () => catalog.units[0],
    crearTransferencia: async () => 8,
    crearDetalle: async () => 9,
    crearTransferenciaUnidad: async () => {},
    obtenerPorId: async () => record({ estado: state }),
    obtenerDetalles: async () => details.map((d) => ({ ...d })),
    obtenerUnidadesDetalle: async () => [catalog.units[0]],
    obtenerParaActualizar: async () => record({ estado: state }),
    obtenerDetallesParaActualizar: async () => details,
    obtenerUnidadesDetalleParaActualizar: async () => [catalog.units[0]],
    actualizarStock: async (_, branch, product, value) => changes.push({ branch, product, value }),
    moverUnidad: async (_, unit, branch) => locations.push({ unit, branch }),
    registrarMovimiento: async (_, movement) => moves.push(movement),
    confirmarTransferencia: async () => {
      state = 'CONFIRMADA'
      return 1
    },
    anularTransferencia: async () => {
      state = 'ANULADA'
      return 1
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(backendSource, {
    module,
    require: (path) => {
      assert.equal(path, '../repositories/transferRepository')
      return repo
    },
  })
  const real = module.exports
  await real.crearTransferencia(
    transferPayload(
      draft({
        detalles: [
          { id_producto: 1, cantidad: 2 },
          { id_producto: 2, unidades: [11] },
        ],
      }),
    ),
    7,
  )
  assert.equal(changes.length, 0)
  assert.equal(locations.length, 0)
  assert.equal(moves.length, 0)
  const confirmed = await real.confirmarTransferencia(8, 7)
  assert.equal(confirmed.estado, 'CONFIRMADA')
  assert.deepEqual(changes, [
    { branch: 4, product: 1, value: 3 },
    { branch: 5, product: 1, value: 2 },
    { branch: 4, product: 2, value: 4 },
    { branch: 5, product: 2, value: 1 },
  ])
  assert.deepEqual(locations, [{ unit: 11, branch: 5 }])
  assert.deepEqual(
    moves.map((m) => [m.tipo, m.cantidad]),
    [
      ['TRANSFERENCIA_SALIDA', -2],
      ['TRANSFERENCIA_ENTRADA', 2],
      ['TRANSFERENCIA_SALIDA', -1],
      ['TRANSFERENCIA_ENTRADA', 1],
    ],
  )
  await assert.rejects(real.confirmarTransferencia(8, 7), (e) => e.status === 409)
  await assert.rejects(real.anularTransferencia(8), (e) => e.status === 409)
  state = 'BORRADOR'
  assert.equal((await real.anularTransferencia(8)).estado, 'ANULADA')
  assert.equal(moves.length, 4)
})
