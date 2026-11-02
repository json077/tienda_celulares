import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'

const source = await readFile(
  new URL('../src/views/sales/salePhotoCache.js', import.meta.url),
  'utf8',
)
const { createSalePhotoCache } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
)
const tick = () => new Promise(setImmediate)
const urls = () => {
  const created = [],
    revoked = []
  return {
    created,
    revoked,
    createObjectURL(blob) {
      const url = `blob:photo-${created.length}`
      created.push({ blob, url })
      return url
    },
    revokeObjectURL(url) {
      revoked.push(url)
    },
  }
}

test('catálogo y carrito comparten descargas; búsqueda, categorías y cantidades reutilizan la misma foto', async () => {
  const calls = [],
    objectUrls = urls()
  const cache = createSalePhotoCache(async (id) => {
    calls.push(id)
    return new Blob([id])
  }, objectUrls)
  let updates = 0
  const unsubscribe = cache.subscribe(() => updates++)
  cache.load(1)
  cache.load('1')
  cache.load(2)
  await tick()
  const original = cache.get(1)
  // A filtered card can unmount/reappear, and a cart thumbnail can subscribe
  // independently. Neither owns or revokes the shared URL.
  unsubscribe()
  const stop = cache.subscribe(() => updates++)
  for (let i = 0; i < 5; i++) {
    cache.load('1')
    cache.load(2)
  }
  await tick()
  assert.deepEqual(calls, ['1', '2'])
  assert.equal(cache.get(1), original)
  assert.equal(objectUrls.created.length, 2)
  assert.equal(objectUrls.revoked.length, 0)
  assert.ok(updates >= 2)
  stop()
  cache.dispose()
  assert.deepEqual(objectUrls.revoked.sort(), objectUrls.created.map((x) => x.url).sort())
})

test('sin foto, error de descarga y error de decodificación mantienen placeholder sin reintentos repetitivos', async () => {
  const calls = [],
    objectUrls = urls()
  const cache = createSalePhotoCache(async (id) => {
    calls.push(id)
    if (id === '1') return null
    if (id === '2') throw Error('Imagen no disponible')
    return new Blob(['invalid image'])
  }, objectUrls)
  for (const id of [1, 2, 3]) cache.load(id)
  await tick()
  assert.equal(cache.get(1), '')
  assert.equal(cache.get(2), '')
  const invalid = cache.get(3)
  assert.ok(invalid)
  cache.fail(3)
  assert.equal(cache.get(3), '')
  for (const id of [1, 2, 3]) cache.load(id)
  await tick()
  assert.deepEqual(calls, ['1', '2', '3'])
  assert.deepEqual(objectUrls.revoked, [invalid])
  cache.dispose()
  assert.deepEqual(objectUrls.revoked, [invalid], 'No revoca dos veces la URL fallida')
})

test('concurrencia acotada, aborto al cerrar y respuestas tardías no crean URLs ni contaminan otra venta', async () => {
  const pending = [],
    objectUrls = urls()
  const cache = createSalePhotoCache(
    (id, signal) => new Promise((resolve) => pending.push({ id, signal, resolve })),
    objectUrls,
    2,
  )
  for (let id = 1; id <= 6; id++) cache.load(id)
  await tick()
  assert.equal(pending.length, 2)
  pending[0].resolve(new Blob(['first']))
  await tick()
  assert.equal(pending.length, 3)
  assert.equal(objectUrls.created.length, 1)
  cache.dispose()
  assert.ok(pending.every((x) => x.signal.aborted))
  for (const job of pending) job.resolve(new Blob(['late']))
  await tick()
  assert.equal(objectUrls.created.length, 1)
  assert.equal(objectUrls.revoked.length, 1)
  assert.equal(cache.get(1), '')
  cache.load(1)
  await tick()
  assert.equal(
    pending.length,
    4,
    'Una generación nueva puede cargar de nuevo (StrictMode/reapertura)',
  )
  pending[3].resolve(null)
  await tick()
  cache.dispose()
})

test('componente usa placeholder o foto decorativa con la misma estructura, y descarta imágenes rotas', async () => {
  const previous = globalThis.__salePhotoSnapshot
  const cache = createSalePhotoCache(async () => new Blob(['photo']), urls())
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    plugins: [
      {
        name: 'sale-photo-snapshot',
        enforce: 'pre',
        transform(code, id) {
          if (!id.replaceAll('\\', '/').endsWith('/sales/SaleProductImage.jsx')) return
          return (
            code.replace(
              'useSyncExternalStore }',
              'useSyncExternalStore as realUseSyncExternalStore }',
            ) +
            '\nconst useSyncExternalStore = (_subscribe, snapshot) => globalThis.__salePhotoSnapshot ? snapshot() : realUseSyncExternalStore(_subscribe, snapshot, () => "")\n'
          )
        },
      },
    ],
  })
  try {
    globalThis.__salePhotoSnapshot = true
    const { default: Image } = await server.ssrLoadModule('/src/views/sales/SaleProductImage.jsx')
    const render = (id) =>
      renderToStaticMarkup(React.createElement(Image, { productId: id, cache }))
    assert.match(render(1), /<svg/)
    cache.load(1)
    cache.load(2)
    await tick()
    for (const id of [1, 2]) {
      const html = render(id)
      assert.match(html, /class="pos-product-image"/)
      assert.match(html, /<img src="blob:photo-/)
      assert.match(html, /alt=""/)
      assert.doesNotMatch(html, /<svg/)
    }
    cache.fail(1)
    assert.match(render(1), /<svg/)
    assert.match(render(2), /<img/)
  } finally {
    cache.dispose()
    globalThis.__salePhotoSnapshot = previous
    await server.close()
  }
})
