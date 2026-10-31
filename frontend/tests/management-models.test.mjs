import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const load = async (file) =>
  import(moduleUrl(await readFile(new URL(file, import.meta.url), 'utf8')))

test('Dashboard: octubre inicial, validación de período y sucursal y vacíos sin datos inventados', async () => {
  const { initialDashboardFilters, validateDashboardFilters, buildDashboard, loadDashboard } =
    await load('../src/views/dashboard/dashboardModel.js')
  assert.equal(initialDashboardFilters.desde, '2026-10-01')
  assert.equal(initialDashboardFilters.hasta, '2026-10-31')
  for (const invalid of [
    { desde: '2026-02-30' },
    { hasta: '2026-01-01' },
    { desde: '' },
    { id_sucursal: '1 OR 1=1' },
  ])
    assert.throws(() => validateDashboardFilters({ ...initialDashboardFilters, ...invalid }))
  const empty = buildDashboard([], [], [])
  assert.deepEqual([empty.total, empty.count, empty.units, empty.stock], [0, 0, 0, 0])
  assert.deepEqual(empty.daily, [])
  assert.deepEqual(empty.products, [])
  assert.deepEqual(
    empty.states.map((r) => r.cantidad),
    [0, 0, 0],
  )
  const calls = []
  const controller = new AbortController()
  await loadDashboard(
    {
      read: async (...args) => {
        calls.push(args)
        return { data: { rows: [] } }
      },
    },
    { ...initialDashboardFilters, id_sucursal: '2' },
    controller.signal,
  )
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['ventas', 'ranking', 'existencias'],
  )
  assert.deepEqual(calls[0][1], { ...initialDashboardFilters, id_sucursal: '2' })
  assert.deepEqual(calls[2][1], { id_sucursal: '2' })
  assert.ok(calls.every((c) => c[2] === controller.signal))
  await assert.rejects(
    loadDashboard(
      {
        read: async () => {
          throw new Error('Fallo del reporte')
        },
      },
      initialDashboardFilters,
    ),
    /Fallo del reporte/,
  )
})

test('Respaldos: permisos independientes, confirmación exacta y exclusión síncrona de doble envío', async () => {
  const { assertBackupAction, runBackupOperation, backupDate, backupSize } = await load(
    '../src/views/backups/backupModel.js',
  )
  const can = (code) => code === 'BACKUP_CREAR'
  assert.doesNotThrow(() => assertBackupAction(can, 'create'))
  assert.throws(() => assertBackupAction(can, 'restore', 'RESTAURAR 1', '1'), /permiso/)
  assert.throws(
    () => assertBackupAction(() => true, 'restore', 'RESTAURAR 2', '1'),
    /Escribe RESTAURAR 1/,
  )
  assert.doesNotThrow(() => assertBackupAction(() => true, 'restore', 'RESTAURAR 1', '1'))
  const lock = { current: false }
  let release,
    calls = 0
  const pending = runBackupOperation(lock, async () => {
    calls++
    await new Promise((r) => {
      release = r
    })
  })
  await runBackupOperation(lock, async () => {
    calls++
  })
  assert.equal(calls, 1)
  release()
  await pending
  assert.equal(lock.current, false)
  await assert.rejects(
    runBackupOperation(lock, async () => {
      throw new Error('Fallo')
    }),
    /Fallo/,
  )
  assert.equal(lock.current, false)
  assert.equal(backupDate(null), '—')
  assert.equal(backupDate('fecha inválida'), '—')
  assert.equal(backupSize(1024), '1 KB')
})

test('Respaldos HTTP: rutas existentes, cuerpo vacío, JWT, IDs, descarga SQL y permisos revocados', async () => {
  const apiUrl = moduleUrl(
    await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'),
  )
  const source = await readFile(
    new URL('../src/services/backupService.js', import.meta.url),
    'utf8',
  )
  const { backupService, backupId } = await import(
    moduleUrl(source.replace("'./api'", JSON.stringify(apiUrl)))
  )
  const { bindAuthorization } = await import(apiUrl)
  const { endpointPermission } = await load('../src/auth/permissions.js')
  const originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  const calls = [],
    permissions = new Set(['BACKUP_CREAR'])
  let denied = 0
  const unbind = bindAuthorization({
    permissionFor: endpointPermission,
    can: (code) => permissions.has(code),
    onDenied: () => denied++,
  })
  globalThis.localStorage = { getItem: () => 'test-only-token' }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return url.endsWith('/descargar')
      ? new Response('test-only-download', { headers: { 'Content-Type': 'application/sql' } })
      : new Response(JSON.stringify({ ok: true, data: [] }))
  }
  try {
    for (const id of ['../1', 0, -1, '1/restaurar', '18446744073709551616'])
      assert.throws(() => backupId(id))
    await backupService.list()
    await backupService.create()
    await backupService.download('1')
    assert.ok(calls.every((c) => c.options.headers.Authorization === 'Bearer test-only-token'))
    assert.equal(calls[1].options.method, 'POST')
    assert.equal(calls[1].options.body, undefined)
    await assert.rejects(backupService.restore('1'), (e) => e.status === 403)
    assert.equal(calls.length, 3)
    permissions.add('BACKUP_RESTAURAR')
    await backupService.restore('1')
    assert.ok(calls[3].url.endsWith('/respaldos/1/restaurar'))
    assert.equal(calls[3].options.body, undefined)
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'Acceso revocado' }), { status: 403 })
    await assert.rejects(backupService.download('1'), (e) => e.status === 403)
    assert.equal(denied, 1)
    globalThis.fetch = async () => new Response('<html>Error</html>')
    await assert.rejects(backupService.download('1'), /SQL válida/)
    permissions.clear()
    await assert.rejects(backupService.create(), (e) => e.status === 403)
  } finally {
    unbind()
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
