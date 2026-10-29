const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const express = require('express');

// Carga cerrada: nunca se importa config/database ni se abre una conexión MySQL.
function cargar(archivo, dependencias) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', archivo), 'utf8'), {
    module, Promise, process: { env: { JWT_SECRET: 'secreto-solo-pruebas' } }, console: { error() {} },
    require(nombre) {
      assert.ok(Object.hasOwn(dependencias, nombre), nombre);
      return dependencias[nombre];
    }
  });
  return module.exports;
}
const secret = 'secreto-solo-pruebas';
const token = (claims = {}, options = {}) => jwt.sign(
  { id_usuario: 1, username: 'anterior', roles: ['ROOT'], ...claims }, secret,
  { expiresIn: '8h', ...options });

async function fixture(t) {
  const hash = await bcrypt.hash('clave-prueba', 4);
  const state = {
    usuario: { id_usuario: 1, username: 'actual', email: 'actual@test.local', nombres: 'Ana',
      apellidos: 'Prueba', activo: 1, roles: ['VENDEDOR'], permisos: ['PRODUCTOS_CREAR'], password_hash: hash },
    consultas: 0, accesos: 0, fallo: false
  };
  const repository = {
    async obtenerSesion(id) {
      state.consultas++;
      assert.equal(id, 1);
      if (state.fallo) throw new Error('detalle interno sensible');
      return state.usuario;
    },
    async buscarCredenciales(username) {
      return username === 'actual' && state.usuario ? { ...state.usuario } : null;
    },
    async registrarAcceso() { state.accesos++; }
  };
  const auth = cargar('middlewares/authMiddleware.js', { jsonwebtoken: jwt, '../repositories/authRepository': repository });
  const permission = cargar('middlewares/permissionMiddleware.js', {});
  const controller = cargar('controllers/authController.js', {
    bcrypt, jsonwebtoken: jwt, '../repositories/authRepository': repository
  });
  const routes = cargar('routes/authRoutes.js', {
    express,
    // Promesas del contexto nativo para Express; las funciones probadas siguen siendo reales.
    '../controllers/authController': { login: (...args) => Promise.resolve(controller.login(...args)) },
    '../middlewares/authMiddleware': { verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args)) },
    '../middlewares/permissionMiddleware': permission
  });
  const app = express(); app.use(express.json()); app.use('/api/auth', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(route = '/me', bearer = token(), body) {
    const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth' + route, {
      method: body ? 'POST' : 'GET',
      headers: { ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json() };
  }
  return { state, request };
}

test('usuario activo y /me usan identidad, roles y permisos actuales sin hashes ni claims', async t => {
  const { request } = await fixture(t);
  const result = await request();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.usuario, { id_usuario: 1, username: 'actual', email: 'actual@test.local',
    nombres: 'Ana', apellidos: 'Prueba', roles: ['VENDEDOR'], permisos: ['PRODUCTOS_CREAR'] });
  assert.ok(!JSON.stringify(result).includes('password_hash'));
});

test('token ya emitido: desactivar usuario impide acceso y /me', async t => {
  const { state, request } = await fixture(t); const issued = token();
  assert.equal((await request('/prueba-permiso', issued)).status, 200);
  state.usuario.activo = 0;
  assert.equal((await request('/prueba-permiso', issued)).status, 403);
  assert.equal((await request('/me', issued)).status, 403);
});

test('usuario inexistente: HTTP 401', async t => {
  const { state, request } = await fixture(t); state.usuario = null;
  assert.equal((await request()).status, 401);
});

test('tokens inválidos, expirados, sin identidad o ausentes no consultan repositorio', async t => {
  const { state, request } = await fixture(t);
  for (const bearer of ['incorrecto', token({}, { expiresIn: -1 }),
    jwt.sign({ id_usuario: 1 }, 'otra-clave'), token({ id_usuario: null }), null]) {
    assert.equal((await request('/me', bearer)).status, 401);
  }
  assert.equal(state.consultas, 0);
});

test('ROOT revocado después de emitir token y permisos revocados se aplican en siguiente solicitud', async t => {
  const { state, request } = await fixture(t); const issued = token();
  state.usuario.roles = ['ROOT']; state.usuario.permisos = [];
  assert.equal((await request('/prueba-permiso', issued)).status, 200);
  state.usuario.roles = ['VENDEDOR'];
  assert.equal((await request('/prueba-permiso', issued)).status, 403);
  state.usuario.permisos = ['PRODUCTOS_CREAR'];
  assert.equal((await request('/prueba-permiso', issued)).status, 200);
  state.usuario.permisos = [];
  assert.equal((await request('/prueba-permiso', issued)).status, 403);
});

test('ROOT inactivo: repositorio sin roles activos impide privilegios del JWT', async t => {
  const { state, request } = await fixture(t);
  state.usuario.roles = []; state.usuario.permisos = [];
  assert.equal((await request('/prueba-permiso')).status, 403);
  const login = await request('/login', null, { username: 'actual', password: 'clave-prueba' });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.usuario.roles, []);
  assert.deepEqual(jwt.verify(login.body.token, secret).roles, []);
});

test('fallo del repositorio deniega acceso sin revelar información interna', async t => {
  const { state, request } = await fixture(t); state.fallo = true;
  const result = await request('/prueba-permiso');
  assert.equal(result.status, 500);
  assert.ok(!JSON.stringify(result).includes('detalle interno'));
});

test('login conserva contrato, usa roles vigentes y no expone hash', async t => {
  const { state, request } = await fixture(t);
  const result = await request('/login', null, { username: 'actual', password: 'clave-prueba' });
  assert.equal(result.status, 200); assert.equal(state.accesos, 1);
  assert.deepEqual(jwt.verify(result.body.token, secret).roles, ['VENDEDOR']);
  assert.deepEqual(result.body.usuario.roles, ['VENDEDOR']);
  assert.deepEqual(result.body.usuario.permisos, ['PRODUCTOS_CREAR']);
  assert.ok(!JSON.stringify(result).includes('password_hash'));
  assert.ok(!JSON.stringify(result).includes(state.usuario.password_hash));
  assert.equal((await request('/login', null, { username: 'actual', password: 'incorrecta' })).status, 401);
  state.usuario.activo = 0;
  assert.equal((await request('/login', null, { username: 'actual', password: 'clave-prueba' })).status, 403);
});

test('repositorio: consulta parametrizada filtra roles activos, incluye catálogo ROOT y omite hashes', async () => {
  let rows = []; const calls = [];
  const repository = cargar('repositories/authRepository.js', {
    '../config/database': { pool: { async query(sql, params) { calls.push({ sql, params }); return [rows]; } } }
  });
  assert.equal(await repository.obtenerSesion(1), null);
  const sql = calls[0].sql;
  assert.match(sql, /r.id_rol = ur.id_rol AND r.activo = 1/);
  assert.match(sql, /p.id_permiso = rp.id_permiso OR r.nombre = 'ROOT'/);
  assert.match(sql, /WHERE u.id_usuario = \?/);
  assert.ok(!sql.includes('password_hash'));
  assert.equal(calls[0].params[0], 1);
  const user = { id_usuario: 1, username: 'actual', activo: 1, password_hash: 'no-exponer' };
  rows = [{ ...user, rol: 'VENDEDOR', permiso: 'A' }, { ...user, rol: 'VENDEDOR', permiso: 'A' },
    { ...user, rol: 'VENDEDOR', permiso: 'B' }];
  let session = await repository.obtenerSesion(1);
  assert.deepEqual(Array.from(session.roles), ['VENDEDOR']);
  assert.deepEqual(Array.from(session.permisos), ['A', 'B']);
  assert.ok(!Object.hasOwn(session, 'password_hash'));
  rows = [{ ...user, rol: null, permiso: null }];
  session = await repository.obtenerSesion(1);
  assert.equal(session.roles.length, 0); assert.equal(session.permisos.length, 0);
});
