const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const validators = require('../src/validators/serializedUnitValidator');

// Same closed-loader approach as auth-authorization/available-units tests.
// No dotenv, database module, production server, real credentials or MySQL connection.
function load(file, dependencies, secret) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, process: { env: { JWT_SECRET: secret } }, console: { error() {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  return module.exports;
}

test('HTTP aislado: IMEI_VER permite consulta limitada, nunca registro o gestion de unidades', async t => {
  const secret = randomBytes(32).toString('hex');
  const actor = {
    id_usuario: 104, username: 'Ocasco', activo: 1,
    roles: ['VENDEDOR'], permisos: ['IMEI_VER']
  };
  const calls = {
    sessions: 0, registrationValidation: 0, controllers: {}, services: {},
    connections: 0, writes: [], reads: []
  };
  const assignedBranches = new Set([1]);
  const fakeUnit = {
    id_unidad: 900001, id_producto: 900002, id_sucursal_actual: 1,
    imei1: 'TEST-ONLY-IMEI', imei2: null, numero_serie: 'TEST-ONLY-SERIAL'
  };
  const forbiddenWrite = name => async () => {
    calls.writes.push(name);
    throw new Error('A write double was reached; no real database exists in this test');
  };
  const repository = {
    pool: {
      async getConnection() {
        calls.connections++;
        throw new Error('Opening a write transaction is forbidden in this test');
      },
      query: forbiddenWrite('pool.query')
    },
    crearUnidad: forbiddenWrite('crearUnidad'),
    crearInventario: forbiddenWrite('crearInventario'),
    actualizarStock: forbiddenWrite('actualizarStock'),
    registrarMovimiento: forbiddenWrite('registrarMovimiento'),
    async sucursalAutorizada(user, branch) {
      calls.reads.push('sucursalAutorizada');
      assert.equal(user, 104);
      return assignedBranches.has(branch);
    },
    async obtenerDisponibles(user, product, branch) {
      calls.reads.push('obtenerDisponibles');
      assert.equal(user, 104);
      assert.equal(product, fakeUnit.id_producto);
      assert.ok(assignedBranches.has(branch));
      return [fakeUnit];
    },
    async obtenerTodas() { calls.reads.push('obtenerTodas'); return [fakeUnit]; },
    async obtenerPorId() { calls.reads.push('obtenerPorId'); return fakeUnit; }
  };
  const rawService = load('services/serializedUnitService.js', {
    '../repositories/serializedUnitRepository': repository
  }, secret);
  const service = Object.fromEntries(Object.entries(rawService).map(([name, fn]) => [name, (...args) => {
    calls.services[name] = (calls.services[name] || 0) + 1;
    return Promise.resolve(fn(...args));
  }]));
  const rawController = load('controllers/serializedUnitController.js', {
    '../services/serializedUnitService': service
  }, secret);
  const controller = Object.fromEntries(Object.entries(rawController).map(([name, fn]) => [name, (...args) => {
    calls.controllers[name] = (calls.controllers[name] || 0) + 1;
    return Promise.resolve(fn(...args));
  }]));
  const auth = load('middlewares/authMiddleware.js', {
    jsonwebtoken: jwt,
    '../repositories/authRepository': {
      async obtenerSesion(id) {
        calls.sessions++;
        assert.equal(id, 104);
        return actor;
      }
    }
  }, secret);
  const permission = load('middlewares/permissionMiddleware.js', {}, secret);
  const router = load('routes/serializedUnitRoutes.js', {
    express,
    '../controllers/serializedUnitController': controller,
    '../middlewares/authMiddleware': { verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args)) },
    '../middlewares/permissionMiddleware': permission,
    '../validators/serializedUnitValidator': {
      ...validators,
      validarRegistroUnidad: [
        (_req, _res, next) => { calls.registrationValidation++; next(); },
        ...validators.validarRegistroUnidad
      ]
    }
  }, secret);
  const app = express();
  app.use(express.json());
  app.use('/api/unidades', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  // Signed only with this fixture's ephemeral key, never the application's JWT_SECRET.
  const token = jwt.sign({ id_usuario: 104, roles: ['VENDEDOR'] }, secret, { expiresIn: '5m' });
  const request = async (suffix = '', method = 'GET', body, authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/unidades${suffix}`, {
      method,
      headers: {
        ...(authenticated && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' })
      },
      ...(body !== undefined && { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  const assertNoRegistration = () => {
    assert.equal(calls.registrationValidation, 0, 'Authorization must precede registration validation');
    assert.equal(calls.controllers.registrar || 0, 0, 'Registration controller must not run');
    assert.equal(calls.services.registrarUnidad || 0, 0, 'Registration service must not run');
    assert.equal(calls.connections, 0, 'No transaction connection is requested');
    assert.deepEqual(calls.writes, [], 'No unit, stock or inventory movement writes');
  };
  const denied = {
    status: 403,
    body: { ok: false, message: 'No tiene permiso para realizar esta acción' }
  };

  await t.test('POST autentica y devuelve 403 antes de validadores, controlador y servicio', async () => {
    const before = calls.sessions;
    const result = await request('', 'POST', {
      id_producto: fakeUnit.id_producto, id_sucursal: 1,
      imei1: 'TEST-ONLY-NEW-IMEI', numero_serie: 'TEST-ONLY-NEW-SERIAL'
    });
    assert.deepEqual(result, denied);
    assert.equal(calls.sessions, before + 1, 'Authentication reads the simulated current session');
    assert.deepEqual(calls.reads, [], 'Denied POST never reaches a unit repository');
    assertNoRegistration();
  });
  await t.test('cuerpo vacio tambien da 403, no 400: la autorizacion precede a la validacion', async () => {
    assert.deepEqual(await request('', 'POST', {}), denied);
    assertNoRegistration();
  });
  await t.test('IMEI_VER no permite GET generales ni detalle de gestion', async () => {
    assert.deepEqual(await request(''), denied);
    assert.deepEqual(await request('/900001'), denied);
    assert.equal(calls.controllers.listar || 0, 0);
    assert.equal(calls.controllers.obtenerPorId || 0, 0);
    assert.equal(calls.services.listarUnidades || 0, 0);
    assert.equal(calls.services.obtenerUnidad || 0, 0);
    assert.deepEqual(calls.reads, []);
    assertNoRegistration();
  });
  await t.test('GET disponibles permite IMEI_VER con sucursal asignada y solo realiza lecturas', async () => {
    const result = await request(`/disponibles?id_producto=${fakeUnit.id_producto}&id_sucursal=1`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, data: [fakeUnit] });
    assert.equal(calls.controllers.disponibles, 1);
    assert.equal(calls.services.unidadesDisponibles, 1);
    assert.deepEqual(calls.reads, ['sucursalAutorizada', 'obtenerDisponibles']);
    assertNoRegistration();
  });
  await t.test('sin sesion: 401 antes de obtener permisos o entrar en registro', async () => {
    const before = calls.sessions;
    const result = await request('', 'POST', {}, false);
    assert.equal(result.status, 401);
    assert.equal(result.body.ok, false);
    assert.equal(calls.sessions, before);
    assertNoRegistration();
  });
});
