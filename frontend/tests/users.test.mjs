import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const source = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8')
const url = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const permissionUrl = url(await source('src/auth/permissions.js'))
const modelUrl = url(
  (await source('src/views/users/userModel.js')).replace(
    "'../../auth/permissions'",
    JSON.stringify(permissionUrl),
  ),
)
const model = await import(modelUrl)
const apiUrl = url(await source('src/services/api.js'))
const authUrl = url(
  (await source('src/services/authService.js')).replaceAll("'./api'", JSON.stringify(apiUrl)),
)
const { userService, userErrorMessage } = await import(
  url(
    (await source('src/services/userService.js'))
      .replaceAll("'./api'", JSON.stringify(apiUrl))
      .replaceAll("'./authService'", JSON.stringify(authUrl))
      .replaceAll("'../views/users/userModel'", JSON.stringify(modelUrl)),
  )
)
const catalog = [
  { id_rol: '1', nombre: 'ROOT', activo: 1 },
  { id_rol: '2', nombre: 'VENDEDOR', activo: 1 },
]
const actor = { id_usuario: 1, roles: ['ROOT'], permisos: [] }
const user = (id = 2) => ({
  id_usuario: id,
  username: 'persona' + id,
  email: 'persona@test.local',
  nombres: 'Ana',
  apellidos: 'Prueba',
  activo: 1,
  roles: [catalog[1]],
})
const draft = () => ({
  username: ' nueva ',
  email: 'nueva@test.local',
  nombres: 'Ana',
  apellidos: 'Prueba',
  password: 'Una clave de prueba',
  confirmPassword: 'Una clave de prueba',
  roles: ['2'],
})
const ok = (data) => new Response(JSON.stringify({ ok: true, data }), { status: 200 })

function fixture(t, override = () => undefined) {
  const originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = {
    getItem: () => 'token-simulado',
    setItem() {
      throw Error('No almacenar secretos')
    },
  }
  globalThis.fetch = async (url, options) => {
    assert.ok(url.startsWith('http://localhost:3000/api/'))
    assert.equal(options.headers.Authorization, 'Bearer token-simulado')
    const path = new URL(url).pathname.replace('/api', '')
    const call = { path, url, options, body: options.body ? JSON.parse(options.body) : null }
    calls.push(call)
    const response = await override(call)
    if (response !== undefined) return response
    if (path === '/auth/me') return new Response(JSON.stringify({ ok: true, usuario: actor }))
    if (path === '/usuarios/roles') return ok(catalog)
    if (options.method === 'GET' && /^\/usuarios\/\d+$/.test(path))
      return ok(user(path.split('/').at(-1)))
    if (options.method === 'POST') return ok({ ...user(5), ...call.body, roles: [catalog[1]] })
    if (options.method === 'PUT') return ok({ ...user(), ...call.body, roles: [catalog[1]] })
    if (options.method === 'PATCH') return ok({ ...user(), activo: call.body.activo })
    throw Error('Solicitud no esperada: ' + path)
  }
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  })
  return calls
}

test('listado: filtros exactos, paginación del servidor y roles desde detalles con concurrencia limitada', async (t) => {
  let active = 0,
    max = 0
  const calls = fixture(t, async (c) => {
    if (c.path === '/usuarios')
      return ok({
        registros: Array.from({ length: 9 }, (_, i) => user(i + 1)),
        paginacion: { pagina: 2, limite: 10, total: 19, total_paginas: 2 },
      })
    if (/^\/usuarios\/\d+$/.test(c.path)) {
      active++
      max = Math.max(active, max)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active--
      return ok({ ...user(c.path.split('/').at(-1)), password_hash: 'NO MOSTRAR' })
    }
  })
  const result = await userService.list({
    buscar: 'Ana & Luis',
    activo: '0',
    id_rol: '2',
    pagina: 2,
    limite: 10,
  })
  const params = new URL(calls[0].url).searchParams
  assert.equal(params.get('buscar'), 'Ana & Luis')
  assert.equal(params.get('activo'), '0')
  assert.equal(params.get('id_rol'), '2')
  assert.equal(params.get('pagina'), '2')
  assert.equal(result.users.length, 9)
  assert.equal(result.users[0].roles[0].nombre, 'VENDEDOR')
  assert.equal(result.pagination.total, 19)
  assert.ok(max <= 4)
  assert.ok(!JSON.stringify(result).includes('password_hash'))
})

test('creación y edición usan campos permitidos; contraseña y confirmación se limpian al enviar', async (t) => {
  const values = draft()
  const calls = fixture(t, async (c) => {
    if (c.options.method === 'POST') {
      await Promise.resolve()
      assert.equal(values.password, '')
      assert.equal(values.confirmPassword, '')
      return ok({ ...user(5), roles: [catalog[1]] })
    }
  })
  await userService.commit('create', null, values)
  const post = calls.find((c) => c.options.method === 'POST')
  assert.deepEqual(Object.keys(post.body).sort(), [
    'apellidos',
    'email',
    'nombres',
    'password',
    'roles',
    'username',
  ])
  assert.equal(post.body.username, 'nueva')
  assert.equal(post.body.password, 'Una clave de prueba')
  assert.ok(!Object.hasOwn(post.body, 'confirmPassword'))
  await userService.commit('edit', user(), {
    ...draft(),
    activo: false,
    password_hash: 'NO ENVIAR',
  })
  const put = calls.find((c) => c.options.method === 'PUT')
  assert.equal(put.path, '/usuarios/2')
  assert.deepEqual(Object.keys(put.body).sort(), ['apellidos', 'email', 'nombres', 'username'])
})

test('validaciones: perfil, confirmación, longitud UTF-8 y roles disponibles', () => {
  assert.equal(model.validateUser(draft(), true, catalog), '')
  for (const patch of [
    { username: 'x' },
    { email: 'incorrecto' },
    { nombres: '' },
    { password: 'corta' },
    { password: '😀'.repeat(20), confirmPassword: '😀'.repeat(20) },
    { confirmPassword: 'otra contraseña' },
    { roles: [] },
    { roles: ['9'] },
    { roles: ['2', '2'] },
  ])
    assert.ok(model.validateUser({ ...draft(), ...patch }, true, catalog))
  assert.ok(model.validateRoles({ roles: ['2'] }, [{ ...catalog[1], activo: 0 }]))
  assert.equal(model.validateRoles({ roles: [] }, catalog), '')
})

test('estado: PATCH booleano para activar/desactivar y roles: PUT reemplaza IDs', async (t) => {
  const calls = fixture(t, (c) => {
    if (c.path === '/usuarios/3' && c.options.method === 'GET') return ok({ ...user(3), activo: 0 })
    if (c.path === '/usuarios/3/estado') return ok({ ...user(3), activo: 1 })
  })
  await userService.commit('state', user(), {})
  await userService.commit('state', { ...user(3), activo: 0 }, {})
  await userService.commit('roles', user(), { roles: [] })
  assert.deepEqual(
    calls.filter((c) => c.options.method === 'PATCH').map((c) => c.body),
    [{ activo: false }, { activo: true }],
  )
  assert.deepEqual(
    calls.find((c) => c.path.endsWith('/roles') && c.options.method === 'PUT').body,
    { roles: [] },
  )
})

test('permisos: no ROOT no administra ROOT, autodesactivación bloqueada y creación exige permisos combinados', () => {
  const admin = {
    id_usuario: 2,
    roles: ['ADMINISTRADOR'],
    permisos: ['USUARIO_VER', 'USUARIO_CREAR', 'USUARIO_EDITAR', 'USUARIO_ROLES', 'ROL_VER'],
  }
  const root = { ...user(), roles: [catalog[0]] }
  assert.equal(model.canManage(admin, root), false)
  assert.equal(model.canRoles(admin, root), false)
  assert.equal(model.canState(admin, user()), false)
  assert.equal(model.canCreate(admin), true)
  assert.equal(model.canCreate({ ...admin, permisos: ['USUARIO_CREAR'] }), false)
  assert.equal(model.canManage(actor, root), true)
})

test('roles revocados y autodesactivación impiden escritura aunque el formulario ya esté abierto', async (t) => {
  let identity = actor
  const calls = fixture(t, (c) =>
    c.path === '/auth/me'
      ? new Response(JSON.stringify({ ok: true, usuario: identity }))
      : undefined,
  )
  await assert.rejects(userService.commit('state', user(1), {}), { status: 403 })
  identity = { id_usuario: 1, roles: ['VENDEDOR'], permisos: ['USUARIO_VER'] }
  await assert.rejects(userService.commit('edit', user(), draft()), { status: 403 })
  assert.ok(calls.every((c) => c.options.method === 'GET'))
})

test('estado o roles concurrentes, detalle incorrecto y aborto impiden mutaciones', async (t) => {
  let mode = 'changed'
  const calls = fixture(t, (c) =>
    /^\/usuarios\/\d+$/.test(c.path) && c.options.method === 'GET'
      ? ok(mode === 'changed' ? { ...user(), activo: 0 } : user(99))
      : undefined,
  )
  await assert.rejects(userService.commit('state', user(), {}), /cambiaron/)
  mode = 'wrong'
  await assert.rejects(userService.detail(2), /no corresponde/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(userService.list({ pagina: 1, limite: 20 }, controller.signal))
  assert.ok(calls.every((c) => c.options.method === 'GET'))
})

test('errores 400/401/403/409/422 y detalles campo/mensaje del validador administrativo', async (t) => {
  let status = 400
  fixture(t, (c) =>
    c.options.method === 'PUT'
      ? new Response(
          JSON.stringify({
            ok: false,
            message: 'Operación rechazada',
            errores: [{ campo: 'email', mensaje: 'Correo duplicado' }],
          }),
          { status },
        )
      : undefined,
  )
  for (const code of [400, 401, 403, 409, 422]) {
    status = code
    await assert.rejects(userService.commit('edit', user(), draft()), (error) => {
      assert.equal(error.status, code)
      assert.match(userErrorMessage(error), /Correo duplicado/)
      if (code === 401) assert.match(userErrorMessage(error), /sesión/)
      if (code === 403) assert.match(userErrorMessage(error), /permisos/)
      return true
    })
  }
})

test('red, respuestas ilegibles y falta de permisos efectivos se muestran como errores', async (t) => {
  let mode = 'network'
  fixture(t, () => {
    if (mode === 'network') throw Error('sin red')
    if (mode === 'html') return new Response('<html>error</html>', { status: 500 })
    return new Response(JSON.stringify({ ok: true, usuario: { id_usuario: 1, roles: ['ROOT'] } }))
  })
  await assert.rejects(userService.detail(2), /conectar/)
  mode = 'html'
  await assert.rejects(userService.detail(2), /solicitud/)
  mode = 'claims'
  await assert.rejects(userService.me(), /permisos vigentes/)
})

test('exclusión síncrona evita doble envío y se libera después de un error', async () => {
  const pending = { current: false }
  let calls = 0,
    release
  const first = model.exclusive(pending, async () => {
    calls++
    await new Promise((resolve) => {
      release = resolve
    })
  })
  await model.exclusive(pending, async () => {
    calls++
  })
  assert.equal(calls, 1)
  release()
  await first
  await assert.rejects(
    model.exclusive(pending, async () => {
      throw Error('fallo')
    }),
  )
  assert.equal(pending.current, false)
})

test('payloads de creación, edición, estado y roles cumplen los validadores reales sin MySQL', async () => {
  const require = createRequire(new URL('../../backend/package.json', import.meta.url))
  const library = require('express-validator'),
    module = { exports: {} }
  vm.runInNewContext(
    await readFile(
      new URL('../../backend/src/validators/userValidator.js', import.meta.url),
      'utf8',
    ),
    {
      module,
      Buffer,
      require(name) {
        assert.equal(name, 'express-validator')
        return library
      },
    },
  )
  for (const [key, body] of [
    ['crear', model.createPayload(draft())],
    ['editar', model.profilePayload(draft())],
    ['estado', { activo: false }],
    ['asignarRoles', { roles: ['2'] }],
  ]) {
    const req = { body }
    for (const chain of module.exports[key]) await chain.run(req)
    assert.equal(library.validationResult(req).isEmpty(), true, key)
  }
})
