import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const source = async (file) => readFile(new URL(file, import.meta.url), 'utf8')
const url = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`

test('Perfil: política de contraseña real, confirmación, UTF-8 y dimensiones de foto por contenido', async () => {
  const { validatePassword, photoDimensions, preparePhoto } = await import(
    url(await source('../src/views/profile/profileModel.js'))
  )
  const values = {
    actual: 'Actual-prueba-123',
    nueva: 'Nueva-prueba-456',
    confirmacion: 'Nueva-prueba-456',
  }
  assert.equal(validatePassword(values), '')
  for (const patch of [
    { actual: '' },
    { nueva: 'corta' },
    { confirmacion: 'distinta' },
    { nueva: values.actual, confirmacion: values.actual },
    { nueva: '😀'.repeat(19) },
    { nueva: 'null\0character' },
  ])
    assert.notEqual(validatePassword({ ...values, ...patch }), '')
  const png = new Uint8Array(24)
  png.set([137, 80, 78, 71, 13, 10, 26, 10])
  new DataView(png.buffer).setUint32(16, 300)
  new DataView(png.buffer).setUint32(20, 400)
  assert.deepEqual(photoDimensions(png), [300, 400])
  const jpeg = Uint8Array.from([255, 216, 255, 192, 0, 8, 8, 0, 100, 0, 200, 1])
  assert.deepEqual(photoDimensions(jpeg), [200, 100])
  assert.throws(() => photoDimensions(new TextEncoder().encode('<svg/>')))
  for (const file of [
    { type: 'image/svg+xml', size: 4 },
    { type: 'image/png', size: 6 * 1024 * 1024 },
    {
      type: 'image/png',
      size: 4,
      arrayBuffer: async () => new TextEncoder().encode('fake').buffer,
    },
  ])
    await assert.rejects(preparePhoto(file))
  const large = new Uint8Array(png)
  new DataView(large.buffer).setUint32(16, 100000)
  await assert.rejects(
    preparePhoto({ type: 'image/png', size: large.length, arrayBuffer: async () => large.buffer }),
    /16 megapíxeles/,
  )
})

test('Perfil HTTP: rutas propias sin IDs, foto binaria con Bearer, límites, errores y aborto', async () => {
  const apiModule = await import(url(await source('../src/services/api.js')))
  const serviceSource = (await source('../src/services/profileService.js')).replace(
    "from './api'",
    `from '${url(await source('../src/services/api.js'))}'`,
  )
  const { profileService } = await import(url(serviceSource))
  const originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  const calls = []
  let response = {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'image/png' }),
    blob: async () => new Blob(['PNG'], { type: 'image/png' }),
    json: async () => ({ ok: true, message: 'Correcto', data: {} }),
  }
  globalThis.localStorage = { getItem: () => 'own-token' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options })
    return response
  }
  const unbind = apiModule.bindAuthorization({ permissionFor: () => null, can: () => false })
  try {
    const controller = new AbortController()
    await profileService.get(controller.signal)
    await profileService.photo(controller.signal)
    const blob = new Blob(['test'], { type: 'image/png' })
    await profileService.upload(blob, controller.signal)
    await profileService.password(
      { actual: 'Actual', nueva: 'Nueva', confirmacion: 'Nueva', id_usuario: 999, roles: ['ROOT'] },
      controller.signal,
    )
    await profileService.remove(controller.signal)
    assert.ok(
      calls.every(
        ({ path }) =>
          path.startsWith('http://localhost:3000/api/auth/profile') && !path.includes('999'),
      ),
    )
    assert.ok(calls.every(({ options }) => options.headers.Authorization === 'Bearer own-token'))
    assert.equal(calls[2].options.body, blob)
    assert.equal(calls[2].options.headers['Content-Type'], 'image/png')
    assert.equal(calls[2].options.signal, controller.signal)
    assert.deepEqual(JSON.parse(calls[3].options.body), {
      actual: 'Actual',
      nueva: 'Nueva',
      confirmacion: 'Nueva',
    })
    response = { ...response, ok: false, status: 404 }
    assert.equal(await profileService.photo(), null)
    response = { ...response, status: 413, json: async () => ({ message: 'Demasiado grande' }) }
    await assert.rejects(profileService.upload(blob), /Demasiado grande/)
    response = {
      ...response,
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html' }),
    }
    await assert.rejects(profileService.photo(), /no es válida/)
    globalThis.fetch = async () => {
      throw new DOMException('Cancelled', 'AbortError')
    }
    await assert.rejects(profileService.photo(), (error) => error.name === 'AbortError')
  } finally {
    unbind()
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('Perfil CoreUI: acceso desde cuenta, avatar y datos reales sin edición administrativa', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  try {
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { default: Profile } = await server.ssrLoadModule('/src/views/profile/MyProfile.jsx')
    const { default: Header } = await server.ssrLoadModule(
      '/src/components/header/AppHeaderDropdown.jsx',
    )
    const { routes } = await server.ssrLoadModule('/src/routes.js')
    const own = {
      id_usuario: 1,
      username: 'cuenta-propia',
      nombres: 'Ana',
      apellidos: 'Prueba',
      roles: ['VENDEDOR'],
      email: null,
    }
    const render = (Component) =>
      renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          { value: { usuario: own, can: () => false, logout() {} } },
          React.createElement(MemoryRouter, null, React.createElement(Component)),
        ),
      )
    const html = render(Profile)
    for (const text of [
      'Mi perfil',
      'Ana Prueba',
      'cuenta-propia',
      'VENDEDOR',
      'Cargando tu información',
      'Seguridad',
      'Contraseña actual',
      'Nueva contraseña',
      'Confirmar nueva contraseña',
      'Subir fotografía',
    ])
      assert.ok(html.includes(text), text)
    assert.equal((html.match(/type="password"/g) || []).length, 3)
    assert.doesNotMatch(html, /<select|name="roles"|name="id_sucursal"|password_hash/)
    assert.match(html, /Avatar de Ana Prueba/)
    assert.match(render(Header), /Mi perfil/)
    assert.match(render(Header), /Avatar de Ana Prueba/)
    assert.equal(routes.find((route) => route.path === '/mi-perfil').authenticatedOnly, true)
  } finally {
    await server.close()
  }
})
