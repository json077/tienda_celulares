import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const source = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8')
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const apiUrl = url(await source('src/services/api.js'))
const saleUrl = url(await source('src/views/sales/saleModel.js'))
const model = await import(
  url(
    (await source('src/views/warranties/warrantyModel.js'))
      .replace("'../sales/saleModel'", JSON.stringify(saleUrl))
      .replace("'../../services/api'", JSON.stringify(apiUrl)),
  )
)
const {
  warrantyService: service,
  warrantyPayload,
  claimPayload,
  resolutionPayload,
} = await import(
  url((await source('src/services/warrantyService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const { saleService } = await import(
  url((await source('src/services/saleService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const { apiErrorMessage } = await import(apiUrl)
const warranty = (patch = {}) => ({
  id_garantia: 8,
  id_venta: 4,
  id_detalle_venta: 10,
  id_producto: 1,
  id_unidad: null,
  fecha_inicio: '2026-10-01',
  fecha_fin: '2026-10-31',
  dias_garantia: 30,
  estado: 'VIGENTE',
  ...patch,
})
const claim = (patch = {}) => ({
  id_reclamo: 9,
  numero_reclamo: 'R-TEST',
  id_garantia: 8,
  id_sucursal: 2,
  id_usuario_recibe: 7,
  motivo: 'Falla técnica',
  estado: 'RECIBIDO',
  diagnostico: null,
  solucion: null,
  observacion: null,
  fecha_recepcion: '2026-10-28 09:00:00',
  ...patch,
})
const unit = { id_unidad: 11, imei1: '001234567890123', imei2: null, numero_serie: 'SERIE-TEST' }
const accessory = {
  id_detalle_venta: 10,
  id_producto: 1,
  producto: 'Cable',
  sku: 'CB',
  tipo_control: 'CANTIDAD',
  cantidad: 2,
  dias_garantia: 30,
}
const phone = {
  id_detalle_venta: 20,
  id_producto: 2,
  producto: 'Teléfono',
  sku: 'TL',
  tipo_control: 'SERIALIZADO',
  cantidad: 1,
  dias_garantia: 90,
}
const sale = (patch = {}) => ({
  id_venta: 4,
  numero_venta: 'V-TEST',
  estado: 'CONFIRMADA',
  id_sucursal: 2,
  sucursal: 'Centro',
  cliente: 'Cliente prueba',
  detalles: [accessory, phone],
  ...patch,
})
const data = (v) => ({ ok: true, data: v })
const sales = {
  get: async () => data(sale()),
  invoice: async () => data({ id_venta: 4, detalles: [{ ...phone, unidades: [unit] }] }),
}
const values = (patch = {}) => ({ id_venta: 4, id_detalle_venta: 10, id_unidad: null, ...patch })
const claimValues = (patch = {}) => ({
  id_sucursal: '2',
  numero_reclamo: ' R-TEST ',
  motivo: ' Falla técnica ',
  observacion: '',
  ...patch,
})
const context = () => model.loadWarrantySale({ id: 4, sales })
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
const ok = (v) => ({ ok: true, status: 200, json: async () => data(v) })

test('garantías: catálogo real, detalle, estados, filtros por venta/cliente/producto y referencias', () => {
  const rows = [warranty(), warranty({ id_garantia: 12, estado: 'VENCIDA' })]
  assert.deepEqual(model.warrantyRows(data(rows)), rows)
  assert.equal(model.assertWarranty(rows[0], '8'), rows[0])
  assert.equal(model.filterWarranties(rows, [sale()], ' cliente ', 'VIGENTE').length, 1)
  assert.equal(model.filterWarranties(rows, [sale()], 'Cable').length, 2)
  assert.equal(model.filterWarranties(rows, [], '8').length, 1)
  assert.deepEqual(model.knownWarrantyBranches([sale(), sale()]), [{ id: '2', label: 'Centro' }])
  for (const v of [null, {}, [null], [warranty({ estado: 'BORRADOR' })]])
    assert.throws(() => model.warrantyRows(data(v)))
  for (const patch of [
    { id_venta: 0 },
    { dias_garantia: 0 },
    { dias_garantia: 65536 },
    { fecha_inicio: null },
  ])
    assert.throws(() => model.assertWarranty(warranty(patch)))
  assert.throws(() => model.assertWarranty(warranty(), 99))
  assert.equal(model.validId('1e2'), false)
  assert.equal(model.validId('1.5'), false)
  assert.equal(model.validId('9007199254740992'), false)
})

test('garantías: venta, cobertura histórica por cantidad y dispositivo exacto de factura', async () => {
  const ctx = await context()
  assert.doesNotThrow(() => model.validateWarranty(values(), ctx, []))
  assert.doesNotThrow(() =>
    model.validateWarranty(values({ id_detalle_venta: 20, id_unidad: 11 }), ctx, []),
  )
  for (const v of [
    values({ id_venta: 99 }),
    values({ id_detalle_venta: 99 }),
    values({ id_unidad: 11 }),
    values({ id_detalle_venta: 20 }),
    values({ id_detalle_venta: 20, id_unidad: 12 }),
  ])
    assert.throws(() => model.validateWarranty(v, ctx, []))
  for (const dias_garantia of [0, -1, 1.5, 65536, null])
    assert.throws(() =>
      model.validateWarranty(values(), { ...ctx, lines: [{ ...accessory, dias_garantia }] }, []),
    )
  assert.throws(
    () => model.validateWarranty(values(), { ...ctx, sale: sale({ estado: 'ANULADA' }) }, []),
    /CONFIRMADA/,
  )
  // Una venta antigua no se bloquea por el reloj del navegador: MySQL puede crear VENCIDA.
  assert.doesNotThrow(() =>
    model.validateWarranty(values(), { ...ctx, sale: sale({ fecha: '2020-01-01' }) }, []),
  )
})

test('garantías: duplicado incluye garantías vencidas/anuladas y no depende del catálogo actual del producto', async () => {
  const ctx = await context()
  for (const estado of ['VIGENTE', 'VENCIDA', 'ANULADA'])
    assert.throws(() => model.validateWarranty(values(), ctx, [warranty({ estado })]), /Ya existe/)
  assert.throws(
    () =>
      model.validateWarranty(values({ id_detalle_venta: 20, id_unidad: 11 }), ctx, [
        warranty({ id_detalle_venta: 20, id_producto: 2, id_unidad: 11 }),
      ]),
    /Ya existe/,
  )
  assert.doesNotThrow(() => model.validateWarranty(values(), ctx, [warranty({ id_venta: 99 })]))
})

test('garantías: falta de FACTURA_IMPRIMIR conserva cantidad y bloquea registro serializado', async () => {
  const ctx = await model.loadWarrantySale({
    id: 4,
    sales: {
      ...sales,
      invoice: async () => {
        const e = new Error('No tiene permiso')
        e.status = 403
        throw e
      },
    },
  })
  assert.match(ctx.warning, /permisos/)
  assert.deepEqual(ctx.lines[1].units, [])
  assert.doesNotThrow(() => model.validateWarranty(values(), ctx, []))
  assert.throws(() =>
    model.validateWarranty(values({ id_detalle_venta: 20, id_unidad: 11 }), ctx, []),
  )
  await assert.rejects(
    model.loadWarrantySale({
      id: 4,
      sales: { ...sales, get: async () => data(sale({ id_venta: 99 })) },
    }),
    /válidos/,
  )
})

test('reclamos: cobertura, un solo abierto, sucursal y límites de texto en puntos de código', () => {
  assert.doesNotThrow(() => model.validateClaim(claimValues(), warranty(), []))
  assert.doesNotThrow(() =>
    model.validateClaim(claimValues({ motivo: '😀'.repeat(500) }), warranty(), []),
  )
  for (const patch of [
    { id_sucursal: 0 },
    { numero_reclamo: '' },
    { numero_reclamo: 'a'.repeat(51) },
    { motivo: '' },
    { motivo: 'a'.repeat(501) },
    { observacion: 'a'.repeat(501) },
  ])
    assert.throws(() => model.validateClaim(claimValues(patch), warranty(), []))
  for (const estado of ['VENCIDA', 'ANULADA'])
    assert.throws(() => model.validateClaim(claimValues(), warranty({ estado }), []))
  for (const estado of ['RECIBIDO', 'EN_REVISION', 'APROBADO', 'RECHAZADO'])
    assert.throws(
      () => model.validateClaim(claimValues(), warranty(), [claim({ estado })]),
      /abierto/,
    )
  assert.doesNotThrow(() =>
    model.validateClaim(claimValues(), warranty(), [claim({ estado: 'RESUELTO' })]),
  )
  assert.throws(() => model.claimRows(data([claim()]), 99))
})

test('reclamos: matriz real de transiciones y solución/diagnóstico requeridos', () => {
  assert.doesNotThrow(() =>
    model.validateResolution({ estado: 'EN_REVISION', solucion: null }, claim()),
  )
  assert.throws(() =>
    model.validateResolution({ estado: 'EN_REVISION', solucion: 'REPARACION' }, claim()),
  )
  assert.throws(() =>
    model.validateResolution({ estado: 'APROBADO', diagnostico: 'Revisado' }, claim()),
  )
  const review = claim({ estado: 'EN_REVISION' })
  assert.throws(() => model.validateResolution({ estado: 'APROBADO' }, review), /diagnóstico/)
  assert.doesNotThrow(() =>
    model.validateResolution(
      { estado: 'APROBADO', diagnostico: 'Cubierto', solucion: null },
      review,
    ),
  )
  assert.throws(() =>
    model.validateResolution(
      { estado: 'APROBADO', diagnostico: 'Cubierto', solucion: 'SIN_COBERTURA' },
      review,
    ),
  )
  assert.doesNotThrow(() =>
    model.validateResolution(
      { estado: 'RECHAZADO', diagnostico: 'Daño externo', solucion: 'SIN_COBERTURA' },
      review,
    ),
  )
  const approved = claim({ estado: 'APROBADO', diagnostico: 'Cubierto' })
  assert.throws(() => model.validateResolution({ estado: 'RESUELTO' }, approved), /solución/)
  for (const solucion of ['REPARACION', 'REEMPLAZO', 'DEVOLUCION'])
    assert.doesNotThrow(() => model.validateResolution({ estado: 'RESUELTO', solucion }, approved))
  const rejected = claim({
    estado: 'RECHAZADO',
    diagnostico: 'Sin cobertura',
    solucion: 'SIN_COBERTURA',
  })
  assert.doesNotThrow(() => model.validateResolution({ estado: 'RESUELTO' }, rejected))
  assert.throws(() =>
    model.validateResolution({ estado: 'RESUELTO', solucion: 'REPARACION' }, rejected),
  )
  assert.throws(() =>
    model.validateResolution(
      { estado: 'RESUELTO', solucion: 'REPARACION' },
      claim({ estado: 'RESUELTO' }),
    ),
  )
  assert.throws(() =>
    model.validateResolution({ estado: 'APROBADO', diagnostico: 'a'.repeat(1001) }, review),
  )
})

test('garantías: payloads exactos y validadores reales sin precio, días, fechas o usuario aportados por React', async () => {
  assert.deepEqual(warrantyPayload(values({ id_venta: '4' })), {
    id_venta: 4,
    id_detalle_venta: 10,
    id_unidad: null,
  })
  assert.deepEqual(claimPayload(claimValues()), {
    id_sucursal: 2,
    numero_reclamo: 'R-TEST',
    motivo: 'Falla técnica',
    observacion: null,
  })
  assert.deepEqual(resolutionPayload({ estado: 'RESUELTO' }), { estado: 'RESUELTO' })
  assert.deepEqual(resolutionPayload({ estado: 'EN_REVISION', diagnostico: '', solucion: null }), {
    estado: 'EN_REVISION',
    diagnostico: null,
    solucion: null,
  })
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const rules = require('./src/validators/warrantyValidator.js')
  const { validationResult } = require('express-validator')
  for (const [name, body, params] of [
    ['validarCrearGarantia', warrantyPayload(values()), {}],
    ['validarCrearReclamo', claimPayload(claimValues()), { idGarantia: '8' }],
    [
      'validarResolverReclamo',
      resolutionPayload({ estado: 'APROBADO', diagnostico: 'Cubierto', solucion: 'REPARACION' }),
      { idReclamo: '9' },
    ],
  ]) {
    const req = { body, params }
    for (const rule of rules[name]) await rule.run(req)
    assert.deepEqual(validationResult(req).array(), [])
  }
})

test('garantías: servicios HTTP, JWT, listado/detalle y creación con relectura sin efectos externos', async () => {
  await withFetch(
    (path, options) => {
      if (path.endsWith('/ventas/4')) return ok(sale({ detalles: [accessory] }))
      if (path.endsWith('/garantias') && options.method === 'GET') return ok([])
      return ok(warranty())
    },
    async (calls) => {
      const signal = new AbortController().signal
      assert.deepEqual(model.warrantyRows(await service.list(signal)), [])
      assert.equal(model.assertWarranty((await service.get(8, signal)).data).id_garantia, 8)
      let shown
      await model.createWarranty({
        values: values(),
        sales: saleService,
        service,
        signal,
        onCommitted: (r) => {
          shown = model.assertWarranty(r.data)
        },
      })
      assert.equal(shown.dias_garantia, 30)
      assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer jwt-test'))
      assert.equal(calls[0].signal, signal)
      assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
      assert.equal(calls.at(-1).path.split('/api')[1], '/garantias')
    },
  )
})

test('reclamos: crear, consultar y resolver usan solo rutas reales y actualizan respuesta mostrada', async () => {
  await withFetch(
    (path, options) => {
      if (path.endsWith('/garantias/8')) return ok(warranty())
      if (path.endsWith('/8/reclamos') && options.method === 'GET') return ok([])
      if (path.endsWith('/resolver')) return ok(claim({ estado: 'EN_REVISION' }))
      return ok(claim())
    },
    async (calls) => {
      let shown
      await model.receiveClaim({
        id: 8,
        values: claimValues(),
        service,
        onCommitted: (r) => {
          shown = model.assertClaim(r.data)
        },
      })
      assert.equal(shown.estado, 'RECIBIDO')
      await model.resolveClaim({
        record: shown,
        values: { estado: 'EN_REVISION', solucion: null },
        service,
        onCurrent() {},
        onCommitted: (r) => {
          shown = model.assertClaim(r.data)
        },
      })
      assert.equal(shown.estado, 'EN_REVISION')
      assert.deepEqual(
        calls.filter((c) => c.method === 'POST').map((c) => c.path.split('/api')[1]),
        ['/garantias/8/reclamos', '/garantias/reclamos/9/resolver'],
      )
    },
  )
})

test('garantías: cambio concurrente, duplicado y aborto impiden POST', async () => {
  await assert.rejects(
    model.createWarranty({
      values: values(),
      sales,
      service: { list: async () => data([warranty()]), create: () => assert.fail('No escribir') },
      onCommitted() {},
    }),
    /Ya existe/,
  )
  await assert.rejects(
    model.receiveClaim({
      id: 8,
      values: claimValues(),
      service: {
        get: async () => data(warranty()),
        claims: async () => data([claim()]),
        createClaim: () => assert.fail('No escribir'),
      },
      onCommitted() {},
    }),
    /abierto/,
  )
  await assert.rejects(
    model.resolveClaim({
      record: claim(),
      values: { estado: 'EN_REVISION' },
      service: {
        claim: async () => data(claim({ estado: 'EN_REVISION' })),
        resolve: () => assert.fail('No escribir'),
      },
      onCurrent() {},
      onCommitted() {},
    }),
    /cambió/,
  )
  const controller = new AbortController()
  controller.abort()
  await model.receiveClaim({
    id: 8,
    values: claimValues(),
    signal: controller.signal,
    service: {
      get: async () => data(warranty()),
      claims: async () => data([]),
      createClaim: () => assert.fail('No escribir'),
    },
    onCommitted() {},
  })
})

test('garantías: bloqueo síncrono impide doble envío incluso antes del render', async () => {
  const pending = { current: false }
  let release
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  await withFetch(
    async () => {
      await waiting
      return ok(warranty())
    },
    async (calls) => {
      const send = async () => {
        if (!model.acquireWarrantyOperation(pending)) return false
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

test('garantías: errores 400/401/403/404/409 conservan mensaje de negocio y validator', async () => {
  for (const status of [400, 401, 403, 404, 409])
    await withFetch(
      () => ({
        ok: false,
        status,
        json: async () => ({
          ok: false,
          message: 'La garantía ya tiene un reclamo abierto',
          errores: [{ path: 'motivo', msg: 'Motivo inválido' }],
        }),
      }),
      async () => {
        await assert.rejects(service.createClaim(8, claimValues()), (e) => {
          const message = apiErrorMessage(e)
          assert.equal(e.status, status)
          assert.match(message, /reclamo abierto/)
          assert.match(message, /Motivo inválido/)
          if (status === 401) assert.match(message, /expiró/)
          if (status === 403) assert.match(message, /permisos/)
          return true
        })
      },
    )
})

test('garantías: red, HTML/500, respuesta inválida y aborto sin exponer SQL/stack', async () => {
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
      json: async () => ({ message: 'SQL secreto', errores: [{ msg: 'stack' }] }),
    }),
    async () => {
      await assert.rejects(
        service.get(8),
        (e) => e.status === 500 && !/SQL|stack|secreto/.test(apiErrorMessage(e)),
      )
    },
  )
  await withFetch(
    () => ({
      ok: false,
      status: 409,
      json: async () => {
        throw new Error('<html>stack</html>')
      },
    }),
    async () => {
      await assert.rejects(
        service.resolve(9, { estado: 'EN_REVISION' }),
        (e) => e.status === 409 && !/html|stack/.test(e.message),
      )
    },
  )
  await withFetch(
    () => ({ ok: true, json: async () => null }),
    async () => {
      await assert.rejects(service.create(values()), /inválida/)
    },
  )
  await withFetch(
    () => {
      const e = new Error('Abortada')
      e.name = 'AbortError'
      throw e
    },
    async () => {
      await assert.rejects(service.claims(8), { name: 'AbortError' })
    },
  )
})

test('garantías: fallo de actualización tras POST conserva resultado y no reenvía escritura', async () => {
  await withFetch(
    (path) => {
      if (path.endsWith('/garantias'))
        return { ok: false, status: 500, json: async () => ({ message: 'Fallo interno' }) }
      return ok(claim({ estado: path.endsWith('/resolver') ? 'EN_REVISION' : 'RECIBIDO' }))
    },
    async (calls) => {
      let shown
      await model.resolveClaim({
        record: claim(),
        values: { estado: 'EN_REVISION', solucion: null },
        service,
        onCurrent() {},
        onCommitted: (r) => {
          shown = model.assertClaim(r.data)
        },
      })
      await assert.rejects(service.list(), (e) => e.status === 500)
      assert.equal(shown.estado, 'EN_REVISION')
      assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
    },
  )
})

const backendSource = await readFile(
  new URL('../../backend/src/services/warrantyService.js', import.meta.url),
  'utf8',
)
const backendFixture = () => {
  let warrantyRecord
  let claimRecord
  const inserts = []
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  }
  const repo = {
    pool: { getConnection: async () => connection },
    obtenerVentaParaActualizar: async () => ({
      id_venta: 4,
      estado: 'CONFIRMADA',
      fecha_inicio: '2026-10-01',
    }),
    obtenerDetalleParaActualizar: async (_, id) => ({
      ...(id === 10 ? accessory : phone),
      id_venta: 4,
    }),
    obtenerUnidadVendida: async (_, detail, id) => (detail === 20 && id === 11 ? unit : null),
    existeGarantia: async () => !!warrantyRecord,
    crearGarantia: async (_, d) => {
      inserts.push({ ...d })
      warrantyRecord = warranty({ ...d })
      return 8
    },
    obtenerPorId: async () => (warrantyRecord ? { ...warrantyRecord } : null),
    obtenerParaActualizar: async () =>
      warrantyRecord ? { ...warrantyRecord, en_cobertura: 1 } : null,
    obtenerSucursal: async () => ({ id_sucursal: 2, activo: 1 }),
    existeReclamoAbierto: async () => claimRecord && claimRecord.estado !== 'RESUELTO',
    crearReclamo: async (_, d) => {
      claimRecord = claim(d)
      return 9
    },
    obtenerReclamo: async () => (claimRecord ? { ...claimRecord } : null),
    obtenerReclamoParaActualizar: async () => (claimRecord ? { ...claimRecord } : null),
    actualizarReclamo: async (_, id, previous, d, user) => {
      claimRecord = {
        ...claimRecord,
        ...d,
        ...(d.estado === 'RESUELTO'
          ? { id_usuario_resuelve: user, fecha_resolucion: '2026-10-28 10:00:00' }
          : {}),
      }
      return 1
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(backendSource, {
    module,
    require: (path) => {
      assert.equal(path, '../repositories/warrantyRepository')
      return repo
    },
  })
  return { backend: module.exports, repo, inserts }
}

test('backend real con repositorio simulado: garantía usa fecha/días históricos, cantidad completa y vínculo serializado', async () => {
  const f = backendFixture()
  const r = await f.backend.crearGarantia(warrantyPayload(values()))
  assert.equal(r.id_garantia, 8)
  assert.equal(f.inserts[0].fecha_inicio, '2026-10-01')
  assert.equal(f.inserts[0].dias_garantia, 30)
  assert.equal(f.inserts[0].id_unidad, null)
  await assert.rejects(
    f.backend.crearGarantia(warrantyPayload(values())),
    (e) => e.statusCode === 409,
  )
  const g = backendFixture()
  assert.equal(
    (
      await g.backend.crearGarantia(
        warrantyPayload(values({ id_detalle_venta: 20, id_unidad: 11 })),
      )
    ).id_unidad,
    11,
  )
  await assert.rejects(
    backendFixture().backend.crearGarantia(
      warrantyPayload(values({ id_detalle_venta: 20, id_unidad: 99 })),
    ),
    (e) => e.statusCode === 400,
  )
  const h = backendFixture()
  h.repo.obtenerDetalleParaActualizar = async () => ({
    ...accessory,
    id_venta: 4,
    dias_garantia: 0,
  })
  await assert.rejects(h.backend.crearGarantia(warrantyPayload(values())), /no tiene cobertura/)
})

test('backend real con mocks: recepción, revisión, aprobación y resolución solo registran decisión', async () => {
  const f = backendFixture()
  await f.backend.crearGarantia(warrantyPayload(values()))
  assert.equal((await f.backend.crearReclamo(8, claimPayload(claimValues()), 7)).estado, 'RECIBIDO')
  await assert.rejects(
    f.backend.crearReclamo(8, claimPayload(claimValues()), 7),
    (e) => e.statusCode === 409,
  )
  await assert.rejects(
    f.backend.resolverReclamo(
      9,
      { estado: 'RESUELTO', diagnostico: 'x', solucion: 'REPARACION' },
      7,
    ),
    (e) => e.statusCode === 409,
  )
  assert.equal(
    (await f.backend.resolverReclamo(9, { estado: 'EN_REVISION' }, 7)).estado,
    'EN_REVISION',
  )
  await assert.rejects(f.backend.resolverReclamo(9, { estado: 'APROBADO' }, 7), /diagnóstico/)
  assert.equal(
    (
      await f.backend.resolverReclamo(
        9,
        { estado: 'APROBADO', diagnostico: 'Falla cubierta', solucion: 'REEMPLAZO' },
        7,
      )
    ).estado,
    'APROBADO',
  )
  const r = await f.backend.resolverReclamo(9, { estado: 'RESUELTO' }, 7)
  assert.equal(r.solucion, 'REEMPLAZO')
  assert.equal(r.id_usuario_resuelve, 7)
  assert.ok(r.fecha_resolucion)
  await assert.rejects(
    f.backend.resolverReclamo(9, { estado: 'EN_REVISION' }, 7),
    (e) => e.statusCode === 409,
  )
})

test('backend real con mocks: cobertura fuera de intervalo, sucursal inválida y cierre rechazado', async () => {
  const f = backendFixture()
  await f.backend.crearGarantia(warrantyPayload(values()))
  f.repo.obtenerParaActualizar = async () => ({ ...warranty(), en_cobertura: 0 })
  await assert.rejects(
    f.backend.crearReclamo(8, claimPayload(claimValues()), 7),
    (e) => e.statusCode === 409,
  )
  f.repo.obtenerParaActualizar = async () => ({ ...warranty(), en_cobertura: 1 })
  f.repo.obtenerSucursal = async () => ({ activo: 0 })
  await assert.rejects(f.backend.crearReclamo(8, claimPayload(claimValues()), 7), /inactiva/)
  f.repo.obtenerSucursal = async () => ({ activo: 1 })
  await f.backend.crearReclamo(8, claimPayload(claimValues()), 7)
  await f.backend.resolverReclamo(9, { estado: 'EN_REVISION' }, 7)
  assert.equal(
    (await f.backend.resolverReclamo(9, { estado: 'RECHAZADO', diagnostico: 'Daño externo' }, 7))
      .solucion,
    'SIN_COBERTURA',
  )
  await assert.rejects(
    f.backend.resolverReclamo(9, { estado: 'RESUELTO', solucion: 'REPARACION' }, 7),
    /SIN_COBERTURA/,
  )
  assert.equal(
    (await f.backend.resolverReclamo(9, { estado: 'RESUELTO' }, 7)).solucion,
    'SIN_COBERTURA',
  )
})
