const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');
const validator = require('../src/validators/serializedUnitValidator');

// Real route/controller/service/repository/authorization; injected SQL pool, never MySQL.
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, process: { env: { JWT_SECRET: 'available-unit-test' } }, console: { error() {} },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; }
  });
  return module.exports;
}

test('disponibilidad: autorizacion, alcance vigente, SQL limitado y ausencia de escrituras', async t => {
  const state = {
    actor: { id_usuario: 7, activo: 1, roles: ['VENDEDOR'], permisos: ['IMEI_VER'] },
    branches: new Set([1]), inactive: new Set(), queries: [], revokeBetweenQueries: false,
    units: [
      { id_unidad: 1, id_producto: 10, id_sucursal_actual: 1, imei1: '000000000000001', imei2: null, numero_serie: '001', estado: 'DISPONIBLE', active: true, type: 'SERIALIZADO' },
      { id_unidad: 2, id_producto: 10, id_sucursal_actual: 2, imei1: '002', estado: 'DISPONIBLE', active: true, type: 'SERIALIZADO' },
      { id_unidad: 3, id_producto: 10, id_sucursal_actual: 1, imei1: '003', estado: 'VENDIDO', active: true, type: 'SERIALIZADO' },
      { id_unidad: 4, id_producto: 20, id_sucursal_actual: 1, imei1: '004', estado: 'DISPONIBLE', active: false, type: 'SERIALIZADO' },
      { id_unidad: 5, id_producto: 30, id_sucursal_actual: 1, imei1: '005', estado: 'DISPONIBLE', active: true, type: 'CANTIDAD' },
    ]
  };
  const pool = { async query(sql, params) {
    state.queries.push({ sql, params });
    assert.match(sql.trim(), /^SELECT\b/i);
    assert.doesNotMatch(sql, /FOR UPDATE|INSERT|DELETE|\bUPDATE\b/i);
    assert.ok(params.every(Number.isSafeInteger));
    if (sql.includes('AS autorizada')) {
      assert.deepEqual(Array.from(params), [7, params[1]]);
      return [state.branches.has(params[1]) && !state.inactive.has(params[1]) ? [{ autorizada: 1 }] : []];
    }
    assert.match(sql, /INNER JOIN usuario_sucursales us.*us\.id_usuario = \?/s);
    assert.match(sql, /actor\.activo = 1/);
    assert.match(sql, /s\.activo = 1/);
    assert.match(sql, /p\.activo = 1 AND p\.tipo_control = 'SERIALIZADO'/);
    assert.match(sql, /u\.id_producto = \? AND u\.id_sucursal_actual = \? AND u\.estado = 'DISPONIBLE'/);
    assert.doesNotMatch(sql, /id_detalle_compra|costo|created_at|updated_at|SELECT\s+\*/i);
    const [user, product, branch] = params;
    assert.equal(user, 7);
    if (state.revokeBetweenQueries) return [[]];
    return [state.units.filter(u => u.id_producto === product && u.id_sucursal_actual === branch &&
      u.estado === 'DISPONIBLE' && u.active && u.type === 'SERIALIZADO' && state.branches.has(branch) && !state.inactive.has(branch))
      .map(u => ({ ...u, costo: 'SECRET', id_detalle_compra: 99, created_at: 'SECRET' }))];
  } };
  const repository = load('repositories/serializedUnitRepository.js', { '../config/database': { pool } });
  const service = load('services/serializedUnitService.js', { '../repositories/serializedUnitRepository': repository });
  const controller = load('controllers/serializedUnitController.js', { '../services/serializedUnitService': service });
  const httpController = Object.fromEntries(Object.entries(controller).map(([name, fn]) =>
    [name, (...args) => Promise.resolve(fn(...args))]
  ));
  const auth = load('middlewares/authMiddleware.js', {
    jsonwebtoken: jwt, '../repositories/authRepository': { obtenerSesion: async () => state.actor }
  });
  const permission = load('middlewares/permissionMiddleware.js', {});
  const router = load('routes/serializedUnitRoutes.js', {
    express, '../controllers/serializedUnitController': httpController,
    '../middlewares/authMiddleware': { verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args)) },
    '../middlewares/permissionMiddleware': permission, '../validators/serializedUnitValidator': validator
  });
  const app = express(); app.use(express.json()); app.use('/api/unidades', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ id_usuario: 7, roles: ['ROOT'] }, 'available-unit-test');
  const request = async (suffix = '/disponibles?id_producto=10&id_sucursal=1', method = 'GET', authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/unidades${suffix}`, {
      method, headers: authenticated ? { Authorization: `Bearer ${token}` } : {}
    });
    return { status: response.status, body: await response.json() };
  };
  await t.test('ruta estatica, seis campos y ceros iniciales; sin datos administrativos', async () => {
    const result = await request();
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, [{ id_unidad: 1, id_producto: 10, id_sucursal_actual: 1, imei1: '000000000000001', imei2: null, numero_serie: '001' }]);
    assert.doesNotMatch(JSON.stringify(result), /SECRET|costo|compra|created_at|estado/);
    assert.equal(state.queries.length, 2);
  });
  await t.test('sin asignacion, otra sucursal e inactiva: 403; ROOT tampoco tiene acceso global', async () => {
    assert.equal((await request('/disponibles?id_producto=10&id_sucursal=2')).status, 403);
    state.inactive.add(1);
    assert.equal((await request()).status, 403);
    state.inactive.clear(); state.branches.clear();
    assert.equal((await request()).status, 403);
    state.actor.roles = ['ROOT'];
    assert.equal((await request()).status, 403);
    state.actor.roles = ['VENDEDOR']; state.branches.add(1);
  });
  await t.test('no disponibles, producto inactivo/no serializado o inexistente: lista vacia', async () => {
    for (const product of [20, 30, 999]) {
      const result = await request(`/disponibles?id_producto=${product}&id_sucursal=1`);
      assert.equal(result.status, 200); assert.deepEqual(result.body.data, []);
    }
    state.revokeBetweenQueries = true;
    assert.deepEqual((await request()).body.data, []);
    state.revokeBetweenQueries = false;
  });
  await t.test('valida ambos filtros escalares y rechaza ampliaciones de alcance', async () => {
    const count = state.queries.length;
    for (const query of ['', '?id_producto=10', '?id_sucursal=1', '?id_producto=-1&id_sucursal=1',
      '?id_producto=1.5&id_sucursal=1', '?id_producto=10&id_sucursal=9007199254740992',
      '?id_producto=10&id_sucursal=1&id_sucursal=2', '?id_producto[]=10&id_sucursal=1',
      '?id_producto=10&id_sucursal=1&estado=VENDIDO', '?id_producto=10&id_sucursal=0']) {
      assert.equal((await request(`/disponibles${query}`)).status, 400, query);
    }
    assert.equal(state.queries.length, count);
  });
  await t.test('IMEI_VER no autoriza GET generales, POST IMEI ni ajustes', async () => {
    assert.equal((await request('')).status, 403);
    assert.equal((await request('/1')).status, 403);
    assert.equal((await request('', 'POST')).status, 403);
    assert.equal(permission.verificarPermiso('INVENTARIO_AJUSTAR')({ usuario: state.actor }, {
      status(code) { assert.equal(code, 403); return this; }, json() {}
    }, () => assert.fail('Sin ajustes')), undefined);
  });
  await t.test('revocacion de permiso/usuario, solo gestionar y sin token no habilitan disponibilidad', async () => {
    state.actor.permisos = ['IMEI_GESTIONAR'];
    assert.equal((await request()).status, 403);
    state.actor.permisos = [];
    assert.equal((await request()).status, 403);
    state.actor.permisos = ['IMEI_VER']; state.actor.activo = 0;
    assert.equal((await request()).status, 403);
    state.actor.activo = 1;
    assert.equal((await request(undefined, 'GET', false)).status, 401);
  });
});
