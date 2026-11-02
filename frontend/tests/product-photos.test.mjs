import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const source = (name) => readFile(new URL('../src/' + name, import.meta.url), 'utf8')
const url = (text) => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const api = await source('services/api.js')
const apiUrl = url(api)
const { productPhotoService } = await import(
  url((await source('services/productPhotoService.js')).replace("'./api'", JSON.stringify(apiUrl)))
)
const { saveProductWithPhoto } = await import(
  url(await source('views/products/saveProductPhoto.js'))
)
const { endpointPermission } = await import(url(await source('auth/permissions.js')))

test('fotos usan Bearer, blob y permiso de edición al quitar; nunca token en URL', async () => {
  const originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'test-token' }
  const calls = []
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options })
    return options.method === 'GET'
      ? new Response(new Blob(['test'], { type: 'image/webp' }), {
          headers: { 'Content-Type': 'image/webp' },
        })
      : Response.json({ ok: true })
  }
  try {
    assert.equal((await productPhotoService.get(1)).type, 'image/webp')
    await productPhotoService.upload(1, new Blob(['test'], { type: 'image/png' }))
    await productPhotoService.remove(1)
    assert.equal(endpointPermission('/productos/1/foto', 'DELETE'), 'PRODUCTOS_EDITAR')
    assert.equal(endpointPermission('/productos/1', 'DELETE'), 'PRODUCTOS_ELIMINAR')
    for (const call of calls) {
      assert.match(call.path, /\/productos\/1\/foto$/)
      assert.equal(call.path.includes('test-token'), false)
      assert.equal(call.options.headers.Authorization, 'Bearer test-token')
    }
    assert.equal(calls[1].options.headers['Content-Type'], 'image/png')
    globalThis.fetch = async () => new Response(null, { status: 404 })
    assert.equal(await productPhotoService.get(1), null)
    await assert.rejects(
      productPhotoService.upload(1, new Blob(['bad'], { type: 'image/svg+xml' })),
    )
    await assert.rejects(
      productPhotoService.upload(
        1,
        new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' }),
      ),
    )
    globalThis.fetch = async () => Response.json({ message: 'Denegado' }, { status: 403 })
    await assert.rejects(productPhotoService.get(1), { status: 403 })
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('crear y fallar foto permite reintentar exclusivamente la foto sin duplicar ni cambiar campos', async () => {
  let creates = 0,
    uploads = 0,
    saved
  const products = {
    create: async () => {
      creates++
      return { data: { id_producto: 7 }, message: 'Creado' }
    },
    update: () => assert.fail('No actualizar al reintentar foto'),
  }
  const photos = {
    upload: async (id) => {
      assert.equal(id, 7)
      uploads++
      if (uploads === 1) throw Error('network')
    },
  }
  const change = { action: 'upload', file: new Blob(['test']) }
  const common = {
    products,
    photos,
    values: {},
    change,
    onPersisted: (product) => {
      saved = product
    },
  }
  await assert.rejects(saveProductWithPhoto(common), { photoPending: true })
  assert.equal(saved.id_producto, 7)
  await saveProductWithPhoto({ ...common, product: saved, photoOnly: true })
  assert.equal(creates, 1)
  assert.equal(uploads, 2)
})

test('editar sin cambio conserva foto; quitar usa solo la operación explícita', async () => {
  let removed = 0,
    updated = 0
  const product = { id_producto: 7 }
  const common = {
    product,
    values: {},
    onPersisted: () => {},
    products: {
      update: async () => {
        updated++
        return { data: product }
      },
    },
    photos: {
      upload: () => assert.fail('No subir sin selección'),
      remove: async () => {
        removed++
      },
    },
  }
  await saveProductWithPhoto(common)
  assert.equal(removed, 0)
  await saveProductWithPhoto({ ...common, change: { action: 'remove' } })
  assert.equal(removed, 1)
  assert.equal(updated, 2)
})
