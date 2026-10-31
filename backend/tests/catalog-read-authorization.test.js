const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');

// Closed dependency injection: never load database, commercial services or real controllers.
const secret = 'catalog-read-test-only';
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, process: { env: { JWT_SECRET: secret } }, console: { error() {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    }
  });
  return module.exports;
}

test('VENDEDOR consulta catalogos canonicos y crea ventas sin obtener permisos de modificacion', async t => {
  const state = {
    usuario: {
      id_usuario: 1, username: 'vendedor-simulado', activo: 1, roles: ['VENDEDOR'],
      permisos: ['VENTA_VER', 'VENTA_CREAR', 'PRODUCTO_VER', 'CLIENTE_VER', 'INVENTARIO_VER']
    },
    handled: []
  };
  const auth = load('middlewares/authMiddleware.js', {
    jsonwebtoken: jwt,
    '../repositories/authRepository': { obtenerSesion: async () => state.usuario }
  });
  const permission = load('middlewares/permissionMiddleware.js', {});
  const pass = (_req, _res, next) => next();
  const validators = new Proxy({}, { get: () => pass });
  const app = express();
  const resources = {
    productos: 'product', clientes: 'client', categorias: 'category', marcas: 'brand',
    ventas: 'sale', inventario: 'inventory', unidades: 'serializedUnit'
  };
  for (const [resource, name] of Object.entries(resources)) {
    const controller = new Proxy({}, {
      get: (_target, action) => (req, res) => {
        state.handled.push(`${resource}:${action}`);
        res.json({ ok: true, data: [] });
      }
    });
    const router = load(`routes/${name}Routes.js`, {
      express,
      [`../controllers/${name}Controller`]: controller,
      '../middlewares/authMiddleware': { verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args)) },
      '../middlewares/permissionMiddleware': permission,
      [`../validators/${name}Validator`]: validators
    });
    app.use(`/api/${resource}`, router);
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  // Stale ROOT claims must not override the current VENDEDOR session.
  const token = jwt.sign({ id_usuario: 1, roles: ['ROOT'] }, secret, { expiresIn: '1h' });
  const request = (route, method = 'GET') => fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
    method, headers: { Authorization: `Bearer ${token}` }
  });

  await t.test('listados y detalles usan PRODUCTO_VER / CLIENTE_VER', async () => {
    for (const resource of ['productos', 'clientes', 'categorias', 'marcas']) {
      for (const suffix of ['', '/1']) {
        assert.equal((await request(`/${resource}${suffix}`)).status, 200, `${resource}${suffix}`);
      }
    }
    assert.equal((await request('/inventario')).status, 200);
    assert.equal((await request('/ventas')).status, 200);
    assert.equal((await request('/ventas', 'POST')).status, 200, 'VENTA_CREAR permanece intacto');
  });
  await t.test('consultar no concede crear, editar, eliminar, ajustar ni registrar IMEI', async () => {
    const handled = state.handled.length;
    for (const resource of ['productos', 'clientes', 'categorias', 'marcas']) {
      for (const [suffix, method] of [['', 'POST'], ['/1', 'PUT'], ['/1', 'DELETE']]) {
        assert.equal((await request(`/${resource}${suffix}`, method)).status, 403, `${method} ${resource}${suffix}`);
      }
    }
    for (const [route, method] of [
      ['/inventario/ajustes', 'POST'], ['/inventario/1/1/stock-minimo', 'PUT'],
      ['/unidades', 'GET'], ['/unidades', 'POST']
    ]) assert.equal((await request(route, method)).status, 403, `${method} ${route}`);
    assert.equal(state.handled.length, handled, 'Ningun controlador restringido se ejecuta');
  });
  await t.test('sin permiso canonico el backend sigue denegando la consulta', async () => {
    state.usuario.permisos = ['VENTA_VER', 'VENTA_CREAR', 'PRODUCTOS_VER', 'CLIENTES_VER', 'INVENTARIO_VER'];
    for (const resource of ['productos', 'clientes', 'categorias', 'marcas']) {
      assert.equal((await request(`/${resource}`)).status, 403, resource);
    }
  });
});
