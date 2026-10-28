import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const apiUrl = url(await source('src/services/api.js'))
const saleUrl = url(await source('src/views/sales/saleModel.js'))
const model = await import(
  url(
    (await source('src/views/returns/returnModel.js'))
      .replace("'../sales/saleModel'", JSON.stringify(saleUrl))
      .replace("'../../services/api'", JSON.stringify(apiUrl)),
  )
)
const { returnService: service, returnPayload } = await import(
  url((await source('src/services/returnService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const { saleService } = await import(
  url((await source('src/services/saleService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const { apiErrorMessage } = await import(apiUrl)
const accessory = {
  id_detalle_venta: 10,
  id_producto: 1,
  producto: 'Cable',
  sku: 'CB',
  tipo_control: 'CANTIDAD',
  cantidad: 3,
  precio_unitario: '20.00',
}
const phone = {
  id_detalle_venta: 20,
  id_producto: 2,
  producto: 'Teléfono',
  sku: 'TL',
  tipo_control: 'SERIALIZADO',
  cantidad: 1,
  precio_unitario: '100.00',
}
const unit = { id_unidad: 11, imei1: '001234567890123', imei2: null, numero_serie: 'SERIE-TEST' }
const sale = (patch = {}) => ({
  id_venta: 4,
  numero_venta: 'V-TEST',
  id_sucursal: 2,
  sucursal: 'Centro',
  cliente: 'Cliente prueba',
  estado: 'CONFIRMADA',
  tipo_venta: 'CONTADO',
  detalles: [accessory, phone],
  ...patch,
})
const line = (patch = {}) => ({
  id_detalle_venta: 10,
  cantidad: 1,
  id_unidad: null,
  condicion: 'APTO',
  reintegra_inventario: true,
  motivo: '',
  ...patch,
})
const values = (patch = {}) => ({
  id_venta: 4,
  numero_devolucion: ' DEV-TEST ',
  motivo: ' Producto en buen estado ',
  observacion: '',
  detalles: [line()],
  ...patch,
})
const record = (patch = {}) => ({
  id_devolucion: 8,
  numero_devolucion: 'DEV-TEST',
  id_venta: 4,
  id_sucursal: 2,
  fecha: '2026-10-28 09:00:00',
  motivo: 'Producto en buen estado',
  estado: 'BORRADOR',
  total_devuelto: '20.00',
  detalles: [{ ...accessory, ...line(), reintegra_inventario: 1, subtotal: '20.00', cantidad: 1 }],
  ...patch,
})
const data = (value) => ({ ok: true, data: value })
const services = (history = []) => ({
  sales: {
    get: async () => data(sale()),
    invoice: async () => data({ id_venta: 4, detalles: [{ ...phone, unidades: [unit] }] }),
  },
  returns: {
    list: async () => data(history),
    get: async (id) => data(history.find((r) => r.id_devolucion === Number(id))),
  },
})
const context = async (history = []) => model.loadReturnContext({ id: 4, ...services(history) })
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
const ok = (value) => ({ ok: true, status: 200, json: async () => data(value) })

test('devoluciones: selección de ventas CONFIRMADA contado/crédito, listado, detalle y filtros reales', () => {
  assert.equal(
    model.eligibleSales([
      sale(),
      sale({ tipo_venta: 'CREDITO' }),
      sale({ estado: 'ANULADA' }),
      sale({ estado: 'BORRADOR' }),
    ]).length,
    2,
  )
  const rows = [record({ numero_venta: 'V-TEST', sucursal: 'Centro' })]
  assert.equal(model.returnRows(data(rows)), rows)
  assert.equal(model.assertReturn(rows[0], 8), rows[0])
  assert.equal(model.filterReturns(rows, ' centro ', 'BORRADOR').length, 1)
  assert.equal(model.filterReturns(rows, 'V-TEST', 'ANULADA').length, 0)
  for (const value of [null, {}, [null], [record({ estado: 'PROCESADA' })]])
    assert.throws(() => model.returnRows(data(value)))
  for (const value of [null, record({ detalles: [] }), record({ total_devuelto: -1 })])
    assert.throws(() => model.assertReturn(value))
  assert.throws(() => model.assertReturn(record(), 9))
})

test('devoluciones: pendientes descuentan solo CONFIRMADA y permiten devoluciones parciales', async () => {
  const ctx = await context([
    record({ estado: 'CONFIRMADA' }),
    record({ id_devolucion: 9 }),
    record({ id_devolucion: 10, estado: 'ANULADA' }),
  ])
  assert.equal(ctx.lines[0].returned, 1)
  assert.equal(ctx.lines[0].remaining, 2)
  assert.doesNotThrow(() =>
    model.validateReturn(values({ detalles: [line({ cantidad: 2 })] }), ctx),
  )
  assert.throws(
    () => model.validateReturn(values({ detalles: [line({ cantidad: 3 })] }), ctx),
    /pendiente/,
  )
  assert.throws(
    () =>
      model.validateReturn(
        values({
          detalles: [
            line({ cantidad: 2 }),
            line({ cantidad: 1, condicion: 'DEFECTUOSO', reintegra_inventario: false }),
          ],
        }),
        ctx,
      ),
    /pendiente/,
  )
})

test('devoluciones: no asumir cero devuelto ante error del historial o venta no elegible', async () => {
  const base = services([record({ estado: 'CONFIRMADA' })])
  await assert.rejects(
    model.loadReturnContext({
      id: 4,
      ...base,
      returns: {
        ...base.returns,
        get: async () => {
          throw new Error('Historial incompleto')
        },
      },
    }),
    /incompleto/,
  )
  await assert.rejects(
    model.loadReturnContext({
      id: 4,
      ...base,
      sales: { ...base.sales, get: async () => data(sale({ estado: 'ANULADA' })) },
    }),
    /CONFIRMADA/,
  )
  await assert.rejects(
    context([
      record({ estado: 'CONFIRMADA', detalles: [{ ...record().detalles[0], cantidad: 4 }] }),
    ]),
    /supera/,
  )
  const ctx = await context([record({ estado: 'CONFIRMADA', id_venta: 99 })])
  assert.equal(ctx.lines[0].remaining, 3)
})

test('devoluciones: validación de cantidad, motivo, número, condición y vínculo con venta', async () => {
  const ctx = await context()
  for (const patch of [
    { id_venta: 99 },
    { numero_devolucion: ' ' },
    { numero_devolucion: 'a'.repeat(51) },
    { motivo: '' },
    { motivo: 'a'.repeat(501) },
    { observacion: 'a'.repeat(501) },
    { detalles: [] },
    ...[0, -1, '', 1.5, Infinity, 4294967296].map((cantidad) => ({
      detalles: [line({ cantidad })],
    })),
    { detalles: [line({ id_detalle_venta: 999 })] },
    { detalles: [line({ condicion: 'DAÑADO' })] },
    { detalles: [line({ id_unidad: 11 })] },
    { detalles: [line({ motivo: 'a'.repeat(501) })] },
  ])
    assert.throws(() => model.validateReturn(values(patch), ctx))
})

test('devoluciones: IMEI exacto de factura, ya devuelto, distinto, duplicado y falta de FACTURA_IMPRIMIR', async () => {
  const ctx = await context()
  const serial = line({ id_detalle_venta: 20, id_unidad: 11 })
  assert.doesNotThrow(() => model.validateReturn(values({ detalles: [serial] }), ctx))
  for (const patch of [{ id_unidad: null }, { id_unidad: 12 }, { cantidad: 2 }])
    assert.throws(() => model.validateReturn(values({ detalles: [{ ...serial, ...patch }] }), ctx))
  assert.throws(() => model.validateReturn(values({ detalles: [serial, serial] }), ctx))
  const previous = record({
    estado: 'CONFIRMADA',
    total_devuelto: 100,
    detalles: [
      { ...phone, ...serial, precio_unitario: 100, subtotal: 100, reintegra_inventario: 1 },
    ],
  })
  const returned = await context([previous])
  assert.deepEqual(returned.lines[1].units, [])
  assert.throws(() => model.validateReturn(values({ detalles: [serial] }), returned))
  const base = services()
  const missing = await model.loadReturnContext({
    id: 4,
    ...base,
    sales: {
      ...base.sales,
      invoice: async () => {
        const e = new Error('Sin factura')
        e.status = 403
        throw e
      },
    },
  })
  assert.match(missing.serialError, /FACTURA_IMPRIMIR/)
  assert.match(missing.serialError, /permisos/)
  assert.deepEqual(missing.lines[1].units, [])
  assert.doesNotThrow(() => model.validateReturn(values(), missing))
  assert.throws(() => model.validateReturn(values({ detalles: [serial] }), missing))
})

test('devoluciones: APTO reintegra según modalidad; DEFECTUOSO nunca suma stock', async () => {
  const ctx = await context()
  for (const type of ['CANTIDAD', 'SERIALIZADO'])
    for (const condition of ['APTO', 'DEFECTUOSO']) {
      const reintegra = model.reintegrates(type, condition, false)
      assert.equal(reintegra, type === 'SERIALIZADO' && condition === 'APTO')
      const d = line({
        id_detalle_venta: type === 'CANTIDAD' ? 10 : 20,
        id_unidad: type === 'CANTIDAD' ? null : 11,
        condicion: condition,
        reintegra_inventario: reintegra,
      })
      assert.doesNotThrow(() => model.validateReturn(values({ detalles: [d] }), ctx))
    }
  assert.throws(
    () =>
      model.validateReturn(
        values({ detalles: [line({ condicion: 'DEFECTUOSO', reintegra_inventario: true })] }),
        ctx,
      ),
    /reintegro/,
  )
})

test('devoluciones: payload mínimo contra validators reales, importes y usuario solo del servidor', async () => {
  const body = returnPayload(
    values({
      detalles: [
        line(),
        line({
          id_detalle_venta: 20,
          id_unidad: '11',
          condicion: 'DEFECTUOSO',
          reintegra_inventario: false,
        }),
      ],
    }),
  )
  assert.equal(body.numero_devolucion, 'DEV-TEST')
  assert.equal(body.observacion, null)
  assert.equal(body.detalles[1].id_unidad, 11)
  assert.ok(
    !('total_devuelto' in body) &&
      !('id_usuario' in body) &&
      !('precio_unitario' in body.detalles[0]),
  )
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const { validarCrearDevolucion } = require('./src/validators/returnValidator.js')
  const { validationResult } = require('express-validator')
  const req = { body }
  for (const rule of validarCrearDevolucion) await rule.run(req)
  assert.deepEqual(validationResult(req).array(), [])
})

test('devoluciones: HTTP listado/detalle, creación revalidada y transiciones actualizan datos con JWT', async () => {
  await withFetch(
    (path, options) => {
      if (path.endsWith('/ventas/4')) return ok(sale({ detalles: [accessory] }))
      if (path.endsWith('/confirmar')) return ok(record({ estado: 'CONFIRMADA' }))
      if (path.endsWith('/anular')) return ok(record({ estado: 'ANULADA' }))
      if (path.endsWith('/devoluciones') && options.method === 'GET') return ok([])
      return ok(record())
    },
    async (calls) => {
      const signal = new AbortController().signal
      assert.deepEqual(model.returnRows(await service.list(signal)), [])
      let shown
      await model.createReturn({
        values: values(),
        sales: saleService,
        returns: service,
        signal,
        onCommitted: (r) => {
          shown = model.assertReturn(r.data)
        },
      })
      assert.equal(shown.estado, 'BORRADOR')
      for (const action of ['confirm', 'cancel']) {
        await model.processReturn({
          action,
          record: record(),
          returns: service,
          signal,
          onCurrent() {},
          onCommitted: (r) => {
            shown = model.assertReturn(r.data)
          },
        })
        assert.equal(shown.estado, action === 'confirm' ? 'CONFIRMADA' : 'ANULADA')
      }
      assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-test'))
      assert.equal(calls[0].signal, signal)
      assert.deepEqual(
        calls.filter((c) => c.method === 'POST').map((c) => c.path.split('/api')[1]),
        ['/devoluciones', '/devoluciones/8/confirmar', '/devoluciones/8/anular'],
      )
    },
  )
})

test('devoluciones: relectura concurrente impide crear de más o procesar una ya confirmada', async () => {
  const base = services([
    record({ estado: 'CONFIRMADA', detalles: [{ ...record().detalles[0], cantidad: 3 }] }),
  ])
  await assert.rejects(
    model.createReturn({
      values: values(),
      ...base,
      returns: { ...base.returns, create: () => assert.fail('No debe escribir') },
      onCommitted() {},
    }),
    /pendiente/,
  )
  await assert.rejects(
    model.processReturn({
      action: 'confirm',
      record: record(),
      returns: {
        get: async () => data(record({ estado: 'CONFIRMADA' })),
        confirm: () => assert.fail('No debe repetir'),
      },
      onCurrent() {},
      onCommitted() {},
    }),
    /ya está/,
  )
  const controller = new AbortController()
  controller.abort()
  await model.processReturn({
    action: 'cancel',
    record: record(),
    signal: controller.signal,
    returns: { get: async () => data(record()), cancel: () => assert.fail('No debe escribir') },
    onCurrent() {},
    onCommitted() {},
  })
})

test('devoluciones: bloqueo síncrono impide dos escrituras antes del render', async () => {
  const pending = { current: false }
  let release
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  await withFetch(
    async () => {
      await waiting
      return ok(record())
    },
    async (calls) => {
      const send = async () => {
        if (!model.acquireReturnOperation(pending)) return false
        try {
          await service.create(values())
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

test('devoluciones: errores 400/401/403/404/409 y validadores conservan mensajes útiles', async () => {
  for (const status of [400, 401, 403, 404, 409])
    await withFetch(
      () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: 'La unidad ya tiene una devolución CONFIRMADA',
          errores: [{ path: 'detalles', msg: 'Cantidad excedida' }],
        }),
      }),
      async () => {
        await assert.rejects(service.create(values()), (e) => {
          assert.equal(e.status, status)
          const message = apiErrorMessage(e)
          assert.match(message, /Cantidad excedida/)
          assert.match(message, /ya tiene una devolución/)
          if (status === 401) assert.match(message, /expiró/)
          if (status === 403) assert.match(message, /permisos/)
          return true
        })
      },
    )
})

test('devoluciones: red, respuesta HTML/500 e inválida no exponen SQL ni stack', async () => {
  await withFetch(
    () => {
      throw new Error('Offline')
    },
    async () => {
      await assert.rejects(service.list(), /conectar/)
    },
  )
  await withFetch(
    () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'SQL secreto stack', errores: [{ msg: 'SQL secreto' }] }),
    }),
    async () => {
      await assert.rejects(
        service.get(8),
        (e) => !/SQL|stack|secreto/.test(apiErrorMessage(e)) && e.status === 500,
      )
    },
  )
  await withFetch(
    () => ({
      ok: false,
      status: 409,
      json: async () => {
        throw new SyntaxError('<html>stack</html>')
      },
    }),
    async () => {
      await assert.rejects(
        service.confirm(8),
        (e) => e.status === 409 && !/html|stack/.test(e.message),
      )
    },
  )
  await withFetch(
    () => ({ ok: true, status: 200, json: async () => null }),
    async () => {
      await assert.rejects(service.create(values()), /inválida/)
    },
  )
})

test('devoluciones: fallo de listado después de POST conserva resultado sin reenviar', async () => {
  await withFetch(
    (path) => {
      if (path.endsWith('/devoluciones'))
        return { ok: false, status: 500, json: async () => ({ message: 'Fallo' }) }
      return ok(record({ estado: path.endsWith('/confirmar') ? 'CONFIRMADA' : 'BORRADOR' }))
    },
    async (calls) => {
      let shown
      await model.processReturn({
        action: 'confirm',
        record: record(),
        returns: service,
        onCurrent() {},
        onCommitted: (r) => {
          shown = model.assertReturn(r.data)
        },
      })
      await assert.rejects(service.list(), (e) => e.status === 500)
      assert.equal(shown.estado, 'CONFIRMADA')
      assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
    },
  )
})

const backendSource = await readFile(
  new URL('../../backend/src/services/returnService.js', import.meta.url),
  'utf8',
)
const backendFixture = () => {
  let saved
  let savedLines = []
  const changes = [],
    movements = [],
    states = []
  const sold = { ...unit, id_producto: 2, id_sucursal_actual: 2, estado: 'VENDIDO' }
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  }
  const repo = {
    pool: { getConnection: async () => connection },
    obtenerVentaParaActualizar: async () => sale(),
    obtenerDetalleVentaParaActualizar: async (_, id) => ({
      ...(id === 10 ? accessory : phone),
      id_venta: 4,
    }),
    obtenerCantidadDevuelta: async () => 0,
    obtenerUnidadParaActualizar: async () => sold,
    unidadPerteneceADetalle: async (_, detail, id) => detail === 20 && id === 11,
    unidadYaDevuelta: async () => false,
    crearDevolucion: async (_, header) => {
      saved = { ...header, id_devolucion: 8, estado: 'BORRADOR' }
      savedLines = []
      return 8
    },
    crearDetalle: async (_, id, d) => {
      savedLines.push({ ...d, id_detalle_devolucion: savedLines.length + 1 })
    },
    obtenerPorId: async () => ({ ...saved }),
    obtenerParaActualizar: async () => ({ ...saved }),
    obtenerDetalles: async () =>
      savedLines.map((d) => ({
        ...d,
        producto: d.id_producto === 1 ? 'Cable' : 'Teléfono',
        tipo_control: d.id_producto === 1 ? 'CANTIDAD' : 'SERIALIZADO',
      })),
    obtenerDetallesParaActualizar: async () => savedLines.map((d) => ({ ...d })),
    obtenerStock: async () => ({ stock_actual: 5 }),
    actualizarStock: async (_, branch, product, stock) => changes.push({ branch, product, stock }),
    registrarMovimiento: async (_, d) => movements.push(d),
    actualizarEstadoUnidad: async (_, id, state) => {
      sold.estado = state
      states.push(state)
      return 1
    },
    cambiarEstado: async (_, id, state) => {
      saved.estado = state
      return 1
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(backendSource, {
    module,
    require: (path) => {
      assert.equal(path, '../repositories/returnRepository')
      return repo
    },
  })
  return { backend: module.exports, repo, changes, movements, states, sold }
}

test('backend con repositorio simulado: accesorio APTO reintegra al confirmar; DEFECTUOSO y no reintegrable no suman', async () => {
  for (const [condicion, reintegra_inventario, expected] of [
    ['APTO', true, 1],
    ['APTO', false, 0],
    ['DEFECTUOSO', true, 0],
  ]) {
    const f = backendFixture()
    const draft = await f.backend.crearDevolucion(
      returnPayload(values({ detalles: [line({ condicion, reintegra_inventario })] })),
      7,
    )
    assert.equal(draft.estado, 'BORRADOR')
    assert.equal(f.changes.length, 0)
    assert.equal(f.movements.length, 0)
    assert.equal((await f.backend.confirmarDevolucion(8, 7)).estado, 'CONFIRMADA')
    assert.equal(f.changes.length, expected)
    assert.equal(f.movements.length, expected)
    if (expected) {
      assert.equal(f.changes[0].stock, 6)
      assert.equal(f.movements[0].id_devolucion, 8)
    }
    await assert.rejects(f.backend.confirmarDevolucion(8, 7), (e) => e.statusCode === 409)
  }
})

test('backend con mocks: IMEI APTO queda DISPONIBLE; falla técnica queda DEFECTUOSO sin stock ni movimiento', async () => {
  for (const condicion of ['APTO', 'DEFECTUOSO']) {
    const f = backendFixture()
    const d = line({ id_detalle_venta: 20, id_unidad: 11, condicion, reintegra_inventario: true })
    await f.backend.crearDevolucion(returnPayload(values({ detalles: [d] })), 7)
    assert.equal(f.states.length, 0)
    await f.backend.confirmarDevolucion(8, 7)
    assert.deepEqual(f.states, [condicion === 'APTO' ? 'DISPONIBLE' : 'DEFECTUOSO'])
    assert.equal(f.changes.length, condicion === 'APTO' ? 1 : 0)
    assert.equal(f.movements.length, condicion === 'APTO' ? 1 : 0)
    assert.equal(f.sold.id_sucursal_actual, 2)
  }
})

test('backend con mocks: anular borrador no afecta stock y rechaza venta anulada, cantidades e IMEI duplicados', async () => {
  const f = backendFixture()
  await f.backend.crearDevolucion(returnPayload(values()), 7)
  assert.equal((await f.backend.anularDevolucion(8)).estado, 'ANULADA')
  assert.equal(f.changes.length, 0)
  await assert.rejects(f.backend.anularDevolucion(8), (e) => e.statusCode === 409)
  f.repo.obtenerVentaParaActualizar = async () => sale({ estado: 'ANULADA' })
  await assert.rejects(
    f.backend.crearDevolucion(returnPayload(values()), 7),
    (e) => e.statusCode === 409,
  )
  const g = backendFixture()
  await assert.rejects(
    g.backend.crearDevolucion(returnPayload(values({ detalles: [line({ cantidad: 4 })] })), 7),
    (e) => e.statusCode === 409,
  )
  const serial = line({ id_detalle_venta: 20, id_unidad: 11 })
  await assert.rejects(
    g.backend.crearDevolucion(returnPayload(values({ detalles: [serial, serial] })), 7),
    (e) => e.statusCode === 409,
  )
  g.repo.unidadYaDevuelta = async () => true
  await assert.rejects(
    g.backend.crearDevolucion(returnPayload(values({ detalles: [serial] })), 7),
    (e) => e.statusCode === 409,
  )
  assert.equal(g.states.length, 0)
})
