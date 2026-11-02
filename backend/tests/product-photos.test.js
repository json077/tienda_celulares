const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const express = require('express');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const photoModule = require('../src/services/productPhoto');
const { createProductPhotoController } = require('../src/controllers/productPhotoController');

async function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(await fs.readFile(path.join(__dirname, '../src', file), 'utf8'), {
    module, console, process: { env: { JWT_SECRET: 'product-photo-test' } },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
  });
  return module.exports;
}

test('fotografías: endpoints autenticados, formatos reales, reemplazo seguro y productos antiguos', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tienda-product-photo-'));
  const store = photoModule.createProductPhotoStore(root);
  const state = { reference: null, fail: false, writes: 0 };
  const repo = {
    async obtenerFoto(id) { return Number(id) === 1 ? { id_producto: 1, imagen_ruta: state.reference } : null; },
    async cambiarFoto(id, value) {
      if (Number(id) !== 1) throw Object.assign(new Error('Producto no encontrado.'), { status: 404 });
      if (state.fail) throw new Error('DB failure');
      const old = state.reference; state.reference = value; state.writes++; return old;
    },
  };
  const user = { id_usuario: 1, roles: [], permisos: ['PRODUCTO_VER', 'PRODUCTOS_EDITAR'], activo: 1 };
  const auth = await load('middlewares/authMiddleware.js', {
    jsonwebtoken: jwt, '../repositories/authRepository': { obtenerSesion: async () => user },
  });
  const routes = await load('routes/productRoutes.js', {
    express,
    '../controllers/productController': new Proxy({}, { get: () => (_req, res) => res.json({ ok: true, data: [] }) }),
    '../middlewares/authMiddleware': { verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args)) },
    '../middlewares/permissionMiddleware': require('../src/middlewares/permissionMiddleware'),
    '../validators/productValidator': require('../src/validators/productValidator'),
    '../services/productPhoto': { ...photoModule, createProductPhotoService: () => photoModule.createProductPhotoService(repo, store) },
    '../controllers/productPhotoController': { createProductPhotoController },
    '../repositories/productRepository': repo,
  });
  const app = express(); app.use(express.json()); app.use('/api/productos', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('tienda-product-photo-')) await fs.rm(root, { recursive: true, force: true });
  });
  const token = jwt.sign({ id_usuario: 1, roles: ['ROOT'] }, 'product-photo-test');
  const request = (method = 'GET', body, mime = 'image/png', id = '1', authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}/api/productos/${id}/foto`, {
    method, headers: { ...(authenticated && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': mime }) }, body,
  });
  const image = format => sharp({ create: { width: 4, height: 3, channels: 3, background: '#336699' } }).toFormat(format).toBuffer();
  const png = await image('png');

  await t.test('producto antiguo sin fotografía y autenticación/permisos reales', async () => {
    assert.equal((await request()).status, 404);
    assert.equal((await request('GET', undefined, undefined, '1', false)).status, 401);
    user.permisos = ['PRODUCTO_VER'];
    assert.equal((await request('PUT', png)).status, 403);
    assert.equal((await request('DELETE')).status, 403);
    user.permisos = ['PRODUCTOS_EDITAR'];
    assert.equal((await request()).status, 403);
    assert.equal(state.writes, 0);
    user.permisos = ['PRODUCTO_VER', 'PRODUCTOS_EDITAR'];
  });
  await t.test('PNG/JPG/WebP válidos se normalizan y reemplazan sin conservar el archivo anterior', async () => {
    for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
      const previous = state.reference;
      assert.equal((await request('PUT', await image(format), mime)).status, 200);
      assert.match(state.reference, /^[a-f0-9-]+\.webp$/);
      const response = await request();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /private, no-store/);
      assert.match(response.headers.get('content-type'), /image\/webp/);
      const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 4);
      if (previous) await assert.rejects(fs.stat(path.join(root, previous)), { code: 'ENOENT' });
      assert.equal((await fs.readdir(root)).length, 1);
    }
  });
  await t.test('archivo falso, MIME incorrecto, truncado, tamaño y dimensiones no alteran la foto anterior', async () => {
    const previous = state.reference;
    for (const [bytes, mime, status] of [
      [Buffer.from('<svg></svg>'), 'image/png', 400],
      [png, 'image/jpeg', 400], [png.subarray(0, 40), 'image/png', 400],
      [Buffer.alloc(photoModule.MAX_BYTES + 1), 'image/png', 413],
      [png, 'image/svg+xml', 415],
      [await sharp({ create: { width: 4097, height: 1, channels: 3, background: '#fff' } }).png().toBuffer(), 'image/png', 400],
    ]) assert.equal((await request('PUT', bytes, mime)).status, status);
    assert.equal(state.reference, previous);
    assert.equal((await fs.readdir(root)).length, 1);
    assert.equal((await request('PUT', png, 'image/png', '999')).status, 404);
    assert.equal((await request('GET', undefined, undefined, '../secret')).status, 404);
    await assert.rejects(store.read('../../.env'), { status: 400 });
  });
  await t.test('fallo de MySQL conserva la fotografía anterior y limpia la nueva', async () => {
    const previous = state.reference, bytes = await store.read(previous);
    state.fail = true;
    assert.equal((await request('PUT', png)).status, 500);
    assert.equal((await request('DELETE')).status, 500);
    assert.equal(state.reference, previous);
    assert.deepEqual(await store.read(previous), bytes);
    assert.equal((await fs.readdir(root)).length, 1);
    state.fail = false;
  });
  await t.test('fallo al escribir el archivo no cambia MySQL ni la foto anterior', async () => {
    const previous = state.reference, writes = state.writes;
    const service = photoModule.createProductPhotoService(repo, {
      ...store, write: async () => { throw new Error('disk full'); },
    });
    await assert.rejects(service.replace(1, png, 'image/png'));
    assert.equal(state.reference, previous);
    assert.equal(state.writes, writes);
    assert.ok(await store.read(previous));
  });
  await t.test('eliminar fotografía es idempotente y no elimina el producto', async () => {
    assert.equal((await request('DELETE')).status, 200);
    assert.equal(state.reference, null);
    assert.equal((await request()).status, 404);
    assert.equal((await request('DELETE')).status, 200);
    assert.equal((await fs.readdir(root)).length, 0);
    assert.ok(await repo.obtenerFoto(1));
  });
});

test('repositorio de fotografía bloquea la fila y solo actualiza imagen_ruta; rollback ante fallo', async () => {
  const calls = []; let failed = false;
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async query(sql, values) { calls.push([sql, values]); if (sql.startsWith('SELECT')) return [[{ imagen_ruta: 'old' }]]; if (failed) throw Error('write failed'); return [{}]; },
    async commit() { calls.push('commit'); }, async rollback() { calls.push('rollback'); }, release() { calls.push('release'); },
  };
  const repo = await load('repositories/productRepository.js', { '../config/database': { pool: { getConnection: async () => connection } } });
  assert.equal(await repo.cambiarFoto(1, 'next'), 'old');
  assert.match(calls[1][0], /FOR UPDATE/);
  assert.equal(calls[2][0], 'UPDATE productos SET imagen_ruta = ? WHERE id_producto = ?');
  assert.ok(calls.includes('commit'));
  calls.length = 0; failed = true;
  await assert.rejects(repo.cambiarFoto(1, 'next'));
  assert.ok(calls.includes('rollback')); assert.equal(calls.includes('commit'), false);
});
