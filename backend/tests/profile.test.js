const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { deflateSync } = require('node:zlib');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
const { validatePhoto, createPhotoStore } = require('../src/services/profilePhoto');
const controller = require('../src/controllers/profileController');

function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length); result.write(name, 4); data.copy(result, 8);
  result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4);
  return result;
}
function png({ width = 1, height = 1, pixels = Buffer.from([0, 255, 0, 0, 255]), metadata = false } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    ...(metadata ? [chunk('tEXt', Buffer.from('secret metadata'))] : []),
    chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
async function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(await fs.readFile(path.join(__dirname, '../src', file), 'utf8'), {
    module, Buffer, console: { error() {} }, process: { env: { JWT_SECRET: 'profile-test' } },
    require: (name) => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
  });
  return module.exports;
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tienda-profile-'));
  const photos = createPhotoStore(root);
  const users = new Map([1, 2].map(id => [id, { id_usuario: id, username: `persona${id}`, nombres: 'Persona',
    apellidos: `Prueba ${id}`, email: null, roles: ['VENDEDOR'], permisos: [], activo: 1 }]));
  const hashes = new Map([[1, await bcrypt.hash('Actual-prueba-123', 4)], [2, 'untouched']]);
  const state = { calls: [], conflict: false, fail: false };
  const repo = {
    async sucursales(id) { state.calls.push(['sucursales', id]); if (state.fail) throw new Error('SQL interno sensible'); return [{ id_sucursal: 7, nombre: 'Asignada' }]; },
    async credencial(id) { state.calls.push(['credencial', id]); return { password_hash: hashes.get(id) }; },
    async cambiarPassword(id, old, next) {
      state.calls.push(['password', id]);
      if (state.conflict || old !== hashes.get(id)) return false;
      hashes.set(id, next); return true;
    },
  };
  const auth = await load('middlewares/authMiddleware.js', {
    jsonwebtoken: jwt, '../repositories/authRepository': { obtenerSesion: async id => users.get(Number(id)) },
  });
  const router = await load('routes/profileRoutes.js', {
    express, '../middlewares/authMiddleware': { verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args)) },
    '../repositories/profileRepository': repo,
    '../services/profilePhoto': { MAX_BYTES: 2 * 1024 * 1024, createPhotoStore: () => photos },
    '../controllers/profileController': controller,
  });
  const app = express(); app.use(express.json()); app.use('/api/auth/profile', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('tienda-profile-')) await fs.rm(root, { recursive: true, force: true });
  });
  const request = async (route = '', { method = 'GET', body, raw, mime = 'image/png', user = 1 } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/profile${route}`, {
      method, headers: { ...(user && { Authorization: `Bearer ${jwt.sign({ id_usuario: user, roles: ['ROOT'], username: 'forged' }, 'profile-test')}` }),
        ...(raw ? { 'Content-Type': mime } : body ? { 'Content-Type': 'application/json' } : {}) },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
    return { status: res.status, headers: res.headers, body: res.headers.get('Content-Type')?.startsWith('image/png') ? Buffer.from(await res.arrayBuffer()) : await res.json() };
  };
  return { request, state, hashes, photos, users };
}

test('Mi perfil: identidad vigente, datos mínimos y sucursales propias; sin permisos administrativos', async t => {
  const { request, state, users } = await fixture(t);
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.username, 'persona1');
  assert.deepEqual(result.body.data.roles, ['VENDEDOR']);
  assert.deepEqual(result.body.data.sucursales, [{ id_sucursal: 7, nombre: 'Asignada' }]);
  assert.equal(result.body.data.email, null);
  assert.ok(!JSON.stringify(result.body).includes('password'));
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(state.calls, [['sucursales', 1]]);
  assert.equal((await request('?id_usuario=2')).status, 400);
  assert.equal((await request('', { user: null })).status, 401);
  users.get(1).activo = 0;
  assert.equal((await request()).status, 403);
});

test('Fotos: validación completa PNG, CRC, dimensiones, filtros, bombas y metadatos', () => {
  assert.deepEqual(validatePhoto(png({ metadata: true })), png());
  const corrupt = png(); corrupt[35] ^= 1;
  for (const bad of [Buffer.from('<svg onload="alert(1)"/>'), corrupt,
    Buffer.concat([png(), Buffer.from('trailing')]), png({ width: 513 }),
    png({ pixels: Buffer.from([5, 1, 1, 1, 1]) }), png({ pixels: Buffer.alloc(500000) }),
    png().subarray(0, 30), Buffer.alloc(2 * 1024 * 1024 + 1)]) assert.throws(() => validatePhoto(bad));
});

test('Fotos HTTP: sustitución/borrado propios, otro usuario intacto, límites y autenticación', async t => {
  const { request, photos } = await fixture(t);
  await photos.write(2, png());
  assert.equal((await request('/photo')).status, 404);
  assert.equal((await request('/photo', { method: 'PUT', raw: png({ metadata: true }) })).status, 200);
  const result = await request('/photo');
  assert.deepEqual(result.body, png());
  assert.equal(result.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  const replacement = png({ pixels: Buffer.from([0, 0, 255, 0, 255]) });
  assert.equal((await request('/photo', { method: 'PUT', raw: replacement })).status, 200);
  assert.deepEqual((await request('/photo')).body, replacement);
  assert.equal((await request('/photo', { method: 'PUT', raw: Buffer.from('<svg/>') })).status, 400);
  assert.equal((await request('/photo', { method: 'PUT', raw: png(), mime: 'image/jpeg' })).status, 415);
  assert.equal((await request('/photo', { method: 'PUT', raw: Buffer.alloc(2 * 1024 * 1024 + 1) })).status, 413);
  assert.equal((await request('/photo', { method: 'PUT', raw: png(), user: null })).status, 401);
  assert.equal((await request('/photo?id_usuario=2', { method: 'DELETE' })).status, 400);
  assert.equal((await request('/photo', { method: 'DELETE', body: { id_usuario: 2 } })).status, 400);
  assert.equal((await request('/photo', { method: 'DELETE' })).status, 200);
  assert.equal((await request('/photo')).status, 404);
  assert.deepEqual(await photos.read(2), png());
  await assert.rejects(photos.read('../escape'));
});

test('Contraseña: verifica la actual, política bcrypt de 12 caracteres/72 bytes, CAS y alcance propio', async t => {
  const { request, hashes, state } = await fixture(t);
  const old = hashes.get(1);
  const body = { actual: 'Actual-prueba-123', nueva: 'Nueva-prueba-456', confirmacion: 'Nueva-prueba-456' };
  for (const patch of [{ id_usuario: 2 }, { roles: ['ROOT'] }, { nueva: 'corta' },
    { confirmacion: 'distinta' }, { nueva: '😀'.repeat(19), confirmacion: '😀'.repeat(19) }]) {
    assert.equal((await request('/password', { method: 'POST', body: { ...body, ...patch } })).status, 400);
  }
  assert.equal(hashes.get(1), old);
  assert.equal((await request('/password', { method: 'POST', body: { ...body, actual: 'incorrecta' } })).status, 400);
  state.conflict = true;
  assert.equal((await request('/password', { method: 'POST', body })).status, 409);
  assert.equal(hashes.get(1), old);
  state.conflict = false;
  const result = await request('/password', { method: 'POST', body });
  assert.equal(result.status, 200);
  assert.ok(await bcrypt.compare(body.nueva, hashes.get(1)));
  assert.ok(!await bcrypt.compare(body.actual, hashes.get(1)));
  assert.equal(bcrypt.getRounds(hashes.get(1)), 12);
  assert.equal(hashes.get(2), 'untouched');
  assert.ok(!JSON.stringify(result.body).includes(body.nueva));
  assert.ok(!JSON.stringify(result.body).includes('password_hash'));
  assert.ok(state.calls.every(call => call[1] === 1));
});

test('Contraseña: limita intentos; errores internos no exponen SQL ni hashes', async t => {
  const { request, state } = await fixture(t);
  const body = { actual: 'incorrecta', nueva: 'Nueva-prueba-456', confirmacion: 'Nueva-prueba-456' };
  for (let i = 0; i < 5; i++) assert.equal((await request('/password', { method: 'POST', body })).status, 400);
  const blocked = await request('/password', { method: 'POST', body });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  state.fail = true;
  const failure = await request();
  assert.equal(failure.status, 500);
  assert.ok(!JSON.stringify(failure).includes('SQL interno'));
});

test('Repositorio de perfil: consulta y actualización acotadas al actor; no usa DDL ni toca roles', async () => {
  const calls = [];
  const repository = await load('repositories/profileRepository.js', {
    '../config/database': { pool: { query: async (sql, params) => { calls.push([sql, params]); return sql.startsWith('UPDATE') ? [{ affectedRows: 1 }] : [[]]; } } },
  });
  await repository.sucursales(7); await repository.credencial(7); await repository.cambiarPassword(7, 'old', 'next');
  assert.ok(calls.every(([sql]) => /(?:us\.)?id_usuario = \?/.test(sql)));
  assert.deepEqual(Array.from(calls[2][1]), ['next', 7, 'old']);
  assert.match(calls[2][0], /password_hash = \? AND activo = 1/);
  assert.ok(calls.every(([sql]) => !/ALTER|CREATE|DELETE|usuario_roles|rol_permisos/.test(sql)));
});
