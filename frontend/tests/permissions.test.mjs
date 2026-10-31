import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = (p) => readFile(new URL(p, import.meta.url), 'utf8')
const moduleUrl = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const { canAccess, endpointPermission } = await import(
  moduleUrl(await source('../src/auth/permissions.js'))
)
const apiUrl = moduleUrl(await source('../src/services/api.js'))
const { api, bindAuthorization } = await import(apiUrl)
const { transferService } = await import(
  moduleUrl(
    (await source('../src/services/transferService.js')).replace("'./api'", JSON.stringify(apiUrl)),
  )
)

test('can usa únicamente la sesión efectiva: ROOT vigente, revocación y códigos exactos', () => {
  const current = {
    id_usuario: 1,
    roles: ['INVENTARIO'],
    permisos: ['PRODUCTO_VER', 'INVENTARIO_VER'],
  }
  assert.equal(canAccess(current, 'INVENTARIO_VER'), true)
  assert.equal(canAccess(current, 'PRODUCTOS_VER'), false)
  assert.equal(canAccess(current, 'USUARIO_VER'), false)
  assert.equal(canAccess({ ...current, roles: ['ROOT'] }, 'PRODUCTOS_VER'), true)
  assert.equal(canAccess({ ...current, roles: [], permisos: [] }, 'INVENTARIO_VER'), false)
  for (const session of [null, {}, { roles: ['ROOT'] }, { ...current, permisos: null }]) {
    assert.equal(canAccess(session, 'USUARIO_VER'), false)
  }
  assert.equal(canAccess(current, undefined), false)
})

test('VENDEDOR consulta productos/clientes canonicos sin adquirir permisos de escritura', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  const actor = {
    id_usuario: 1,
    roles: ['VENDEDOR'],
    permisos: ['VENTA_VER', 'VENTA_CREAR', 'PRODUCTO_VER', 'CLIENTE_VER', 'INVENTARIO_VER'],
  }
  const unbind = bindAuthorization({
    permissionFor: endpointPermission,
    can: (code) => canAccess(actor, code),
    onDenied: () => assert.fail('Los rechazos locales no revalidan'),
  })
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method })
    return { ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }
  }
  try {
    for (const resource of ['productos', 'categorias', 'marcas', 'clientes']) {
      for (const suffix of ['', '/1']) await api.get(`/${resource}${suffix}`, { token: 'simulado' })
    }
    assert.equal(calls.length, 8)
    assert.ok(calls.every((call) => call.method === 'GET'))
    for (const resource of ['productos', 'categorias', 'marcas', 'clientes']) {
      const prefix = resource === 'clientes' ? 'CLIENTES' : 'PRODUCTOS'
      assert.equal(endpointPermission(`/${resource}`, 'POST'), `${prefix}_CREAR`)
      assert.equal(endpointPermission(`/${resource}/1`, 'PUT'), `${prefix}_EDITAR`)
      assert.equal(endpointPermission(`/${resource}/1`, 'DELETE'), `${prefix}_ELIMINAR`)
      await assert.rejects(
        api.post(`/${resource}`, {}, { token: 'simulado' }),
        (e) => e.status === 403,
      )
      await assert.rejects(
        api.put(`/${resource}/1`, {}, { token: 'simulado' }),
        (e) => e.status === 403,
      )
      await assert.rejects(
        api.delete(`/${resource}/1`, { token: 'simulado' }),
        (e) => e.status === 403,
      )
    }
    await assert.rejects(
      api.post('/inventario/ajustes', {}, { token: 'simulado' }),
      (e) => e.permission === 'INVENTARIO_AJUSTAR',
    )
    await assert.rejects(
      api.post('/unidades', {}, { token: 'simulado' }),
      (e) => e.permission === 'IMEI_GESTIONAR',
    )
    assert.equal(calls.length, 8, 'No se envian escrituras ni consultas IMEI no autorizadas')
    assert.equal(endpointPermission('/ventas', 'POST'), 'VENTA_CREAR')
    assert.equal(canAccess(actor, 'PRODUCTOS_VER'), false, 'No hay alias generales en can()')
    assert.equal(canAccess(actor, 'CLIENTES_VER'), false)
  } finally {
    unbind()
    globalThis.fetch = originalFetch
  }
})

test('el mapa HTTP coincide con todos los guards reales del backend sin importar MySQL', async () => {
  const app = await source('../../backend/src/app.js')
  const files = Object.fromEntries(
    [...app.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)].map((m) => [m[1], m[2]]),
  )
  let count = 0
  for (const mount of app.matchAll(/app\.use\('\/api(\/[^']+)', (\w+)\)/g)) {
    const globalPermissions = []
    const routes = []
    const router = {
      use(...handlers) {
        globalPermissions.push(...handlers.filter((h) => h?.permission).map((h) => h.permission))
      },
    }
    for (const verb of ['get', 'post', 'put', 'patch', 'delete']) {
      router[verb] = (path, ...handlers) =>
        routes.push({
          path,
          verb,
          permissions: [
            ...globalPermissions,
            ...handlers.filter((h) => h?.permission).map((h) => h.permission),
          ],
        })
    }
    const module = { exports: {} }
    vm.runInNewContext(await source(`../../backend/src/routes/${files[mount[2]]}.js`), {
      module,
      require(name) {
        if (name === 'express') return { Router: () => router }
        if (name.endsWith('/permissionMiddleware'))
          return { verificarPermiso: (permission) => ({ permission }) }
        return new Proxy({}, { get: () => () => {} })
      },
    })
    for (const route of routes) {
      const path = mount[1] + (route.path === '/' ? '' : route.path)
      const actual = endpointPermission(path, route.verb)
      assert.deepEqual(actual ? [actual].flat() : [], route.permissions, `${route.verb} ${path}`)
      count++
    }
  }
  assert.ok(count > 90, 'Se inspeccionan todos los endpoints montados')
})

test('API: no envía consultas ni escrituras no autorizadas; 403 real conserva el error y revalida', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'simulado' }
  const calls = []
  let denials = 0
  let actor = { id_usuario: 1, roles: ['INVENTARIO'], permisos: ['INVENTARIO_VER'] }
  const unbind = bindAuthorization({
    permissionFor: endpointPermission,
    can: (code) => canAccess(actor, code),
    onDenied: () => {
      denials++
    },
  })
  globalThis.fetch = async (url) => {
    calls.push(url)
    return { ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }
  }
  try {
    for (const path of [
      '/productos',
      '/ventas',
      '/clientes',
      '/usuarios',
      '/inventario/movimientos',
      '/unidades',
    ]) {
      await assert.rejects(api.get(path, { token: 'simulado' }), (e) => e.status === 403)
    }
    await assert.rejects(
      api.post('/transferencias', {}, { token: 'simulado' }),
      (e) => e.status === 403,
    )
    await assert.rejects(transferService.list(), (e) => e.status === 403)
    await assert.rejects(transferService.confirm(1), (e) => e.status === 403)
    assert.equal(calls.length, 0)
    await api.get('/inventario', { token: 'simulado' })
    await api.get('/tipos-cambio/moneda/1', { token: 'simulado' })
    assert.equal(calls.length, 2)
    actor = { ...actor, permisos: ['USUARIO_CREAR'] }
    await assert.rejects(
      api.post('/usuarios', {}, { token: 'simulado' }),
      (e) => e.permission === 'USUARIO_ROLES',
    )
    assert.equal(calls.length, 2)
    actor = { ...actor, permisos: ['VENTA_VER'] }
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Permiso revocado' }),
    })
    await assert.rejects(
      api.get('/ventas', { token: 'simulado' }),
      (e) => e.status === 403 && e.message === 'Permiso revocado',
    )
    assert.equal(denials, 1)
    actor = { ...actor, permisos: ['TRANSFERENCIAS_VER'] }
    await assert.rejects(
      transferService.list(),
      (e) => e.status === 403 && e.permission === 'TRANSFERENCIAS_VER',
    )
    assert.equal(denials, 2, 'El cliente especializado de transferencias también revalida')
    actor = { ...actor, permisos: [] }
    await assert.rejects(api.get('/ventas', { token: 'simulado' }), (e) => e.status === 403)
    assert.equal(denials, 2, 'No revalida indefinidamente rechazos locales')
  } finally {
    unbind()
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
