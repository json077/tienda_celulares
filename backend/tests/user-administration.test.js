const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validatorLibrary = require('express-validator');

// Dependencias cerradas: no se importa config/database ni se abre MySQL.
function cargar(archivo, dependencias) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', archivo), 'utf8'), {
    module, Buffer, BigInt, console: { error() { throw new Error('No registrar datos sensibles'); } },
    process: { env: { JWT_SECRET: 'usuarios-solo-pruebas' } },
    require(nombre) {
      assert.ok(Object.hasOwn(dependencias, nombre), nombre);
      return dependencias[nombre];
    }
  });
  return module.exports;
}
const permisos = ['USUARIO_VER', 'USUARIO_CREAR', 'USUARIO_EDITAR', 'USUARIO_ROLES', 'ROL_VER'];
const datos = (username = 'nuevo') => ({ username, email: `${username}@test.local`, nombres: 'Ana',
  apellidos: 'Prueba', password: 'Una clave de prueba', roles: [3] });
const perfil = username => { const { password, roles, ...resto } = datos(username); return resto; };

async function fixture(t) {
  const state = {
    roles: [{ id_rol: 1, nombre: 'ROOT', activo: 1 }, { id_rol: 2, nombre: 'ADMINISTRADOR', activo: 1 },
      { id_rol: 3, nombre: 'VENDEDOR', activo: 1 }, { id_rol: 4, nombre: 'INACTIVO', activo: 0 }],
    permisos: permisos.map((codigo, i) => ({ id_permiso: i + 1, codigo })),
    rolPermisos: permisos.map((_, i) => ({ id_rol: 2, id_permiso: i + 1 })),
    usuarios: [1, 2, 3].map(id_usuario => ({ id_usuario, ...perfil('usuario' + id_usuario), activo: 1 })),
    usuarioRoles: [{ id_usuario: 1, id_rol: 1 }, { id_usuario: 2, id_rol: 2 }, { id_usuario: 3, id_rol: 3 }],
    hashes: {}, auditoria: [], commits: 0, rollbacks: 0, fallo: false
  };
  const eq = (a, b) => String(a) === String(b);
  const rolesDe = id => state.roles.filter(r => state.usuarioRoles.some(ur => eq(ur.id_usuario, id) && eq(ur.id_rol, r.id_rol)));
  const detalle = async id => {
    const u = state.usuarios.find(u => eq(u.id_usuario, id));
    return u ? { ...u, roles: rolesDe(id).map(r => ({ ...r })) } : null;
  };
  let cola = Promise.resolve();
  const repository = {
    detalle,
    async listar(f) {
      const rows = state.usuarios.filter(u => (!f.buscar || u.username.includes(f.buscar)) &&
        (f.activo === undefined || Number(u.activo) === Number(f.activo)) &&
        (!f.id_rol || rolesDe(u.id_usuario).some(r => eq(r.id_rol, f.id_rol))));
      return { registros: rows.slice((f.pagina - 1) * f.limite, f.pagina * f.limite),
        paginacion: { pagina: f.pagina, limite: f.limite, total: rows.length } };
    },
    async rolesDisponibles() { return state.roles.filter(r => r.activo); },
    async transaccion(fn) {
      const previa = cola; let liberar;
      cola = new Promise(resolve => { liberar = resolve; });
      await previa;
      const copia = structuredClone(state);
      try { const result = await fn({}); state.commits++; return result; }
      catch (error) { Object.assign(state, copia); state.rollbacks++; throw error; }
      finally { liberar(); }
    },
    async bloquearSeguridad() {
      const snapshot = structuredClone(state);
      if (state.revocarActor) snapshot.usuarioRoles = snapshot.usuarioRoles.filter(ur => ur.id_usuario !== state.revocarActor);
      return snapshot;
    },
    async crear(db, d, hash) {
      if (state.usuarios.some(u => u.username === d.username || u.email === d.email)) {
        throw Object.assign(new Error('SQL con información sensible'), { code: 'ER_DUP_ENTRY' });
      }
      const id = Math.max(...state.usuarios.map(u => u.id_usuario)) + 1;
      state.usuarios.push({ id_usuario: id, username: d.username, email: d.email,
        nombres: d.nombres, apellidos: d.apellidos, activo: 1 });
      state.hashes[id] = hash; return id;
    },
    async editar(db, id, d) {
      if (state.usuarios.some(u => !eq(u.id_usuario, id) && (u.username === d.username || u.email === d.email))) {
        throw Object.assign(new Error('SQL sensible'), { code: 'ER_DUP_ENTRY' });
      }
      Object.assign(state.usuarios.find(u => eq(u.id_usuario, id)), d);
    },
    async estado(db, id, activo) { state.usuarios.find(u => eq(u.id_usuario, id)).activo = activo ? 1 : 0; },
    async asignarRoles(db, id, roles) {
      state.usuarioRoles = state.usuarioRoles.filter(ur => !eq(ur.id_usuario, id));
      if (state.falloRoles) throw new Error('Fallo después de retirar roles');
      state.usuarioRoles.push(...roles.map(id_rol => ({ id_usuario: id, id_rol })));
    },
    async auditar(db, actor, id, accion, antes, despues) {
      if (state.fallo) throw new Error('Fallo de auditoría con SQL sensible');
      state.auditoria.push({ actor, id, accion, antes, despues });
    }
  };
  const service = cargar('services/userService.js', { bcrypt, '../repositories/userRepository': repository });
  const controller = cargar('controllers/userController.js', { '../services/userService': service, 'node:net': require('node:net') });
  const validators = cargar('validators/userValidator.js', { 'express-validator': validatorLibrary });
  const auth = cargar('middlewares/authMiddleware.js', { jsonwebtoken: jwt,
    '../repositories/authRepository': { async obtenerSesion(id) {
      const u = await detalle(id); if (!u) return null;
      const roles = rolesDe(id).filter(r => r.activo);
      const ids = state.rolPermisos.filter(rp => roles.some(r => eq(r.id_rol, rp.id_rol))).map(rp => rp.id_permiso);
      return { ...u, roles: roles.map(r => r.nombre),
        permisos: state.permisos.filter(p => ids.includes(p.id_permiso)).map(p => p.codigo) };
    } } });
  const permission = cargar('middlewares/permissionMiddleware.js', {});
  const wrapped = Object.fromEntries(Object.entries(controller).map(([k, fn]) => [k, (...args) => Promise.resolve(fn(...args))]));
  const routes = cargar('routes/userRoutes.js', { express, '../controllers/userController': wrapped,
    '../validators/userValidator': validators, '../middlewares/authMiddleware': {
      verificarToken: (...args) => Promise.resolve(auth.verificarToken(...args))
    }, '../middlewares/permissionMiddleware': permission });
  const app = express(); app.use(express.json()); app.use('/api/usuarios', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(method, ruta = '', body, actor = 1) {
    const token = jwt.sign({ id_usuario: actor, roles: ['ROOT'] }, 'usuarios-solo-pruebas', { expiresIn: '1h' });
    const result = await fetch(`http://127.0.0.1:${server.address().port}/api/usuarios${ruta}`, {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const respuesta = { status: result.status, body: await result.json() };
    assert.ok(!JSON.stringify(respuesta).includes('password_hash'));
    assert.ok(!JSON.stringify(respuesta).includes('SQL sensible'));
    return respuesta;
  }
  return { state, request };
}

test('crear usuario: bcrypt real costo 12, roles y auditoría sin secretos', async t => {
  const { state, request } = await fixture(t);
  const d = datos(); const r = await request('POST', '', d, 2);
  assert.equal(r.status, 201); assert.equal(r.body.data.activo, 1);
  const hash = state.hashes[r.body.data.id_usuario];
  assert.notEqual(hash, d.password); assert.equal(bcrypt.getRounds(hash), 12);
  assert.equal(await bcrypt.compare(d.password, hash), true);
  assert.equal(r.body.data.roles[0].id_rol, 3);
  assert.equal(state.commits, 1); assert.equal(state.auditoria[0].accion, 'CREAR');
  assert.ok(!JSON.stringify(state.auditoria).includes(d.password));
  assert.ok(!JSON.stringify(state.auditoria).includes(hash));
  assert.ok(!JSON.stringify(r).includes(hash));
});

test('validación rechaza campos, contraseñas, roles y filtros inválidos sin reflejar secretos', async t => {
  const { state, request } = await fixture(t);
  for (const d of [ { ...datos(), password: 'corta' }, { ...datos(), password: '😀'.repeat(20) },
    { ...datos(), email: 'invalido' }, { ...datos(), roles: [3, '3'] }, { ...datos(), roles: [] },
    { ...datos(), activo: false }, { ...datos(), nombres: {} }, { ...datos(), password_hash: 'secreto' } ]) {
    const r = await request('POST', '', d);
    assert.equal(r.status, 400); assert.ok(!JSON.stringify(r).includes('secreto'));
    assert.ok(r.body.errores.every(e => !Object.hasOwn(e, 'value')));
  }
  for (const ruta of ['?pagina=0', '?limite=101', '?activo=true', '?id_rol=0', '?otro=1',
    '?activo=0&activo=1', '?pagina=1&pagina=2', '/no-id']) {
    assert.equal((await request('GET', ruta)).status, 400);
  }
  assert.equal(state.commits, 0);
});

test('duplicados en creación y edición: HTTP 409 y rollback', async t => {
  const { state, request } = await fixture(t);
  assert.equal((await request('POST', '', datos('usuario1'))).status, 409);
  assert.equal((await request('PUT', '/3', perfil('usuario1'))).status, 409);
  assert.equal(state.usuarios.length, 3); assert.equal(state.auditoria.length, 0);
  assert.equal(state.rollbacks, 2);
});

test('listado filtrado/paginado, detalle, catálogo activo y usuario inexistente', async t => {
  const { request } = await fixture(t);
  const lista = await request('GET', '?buscar=usuario&activo=1&id_rol=3&pagina=1&limite=1', undefined, 2);
  assert.equal(lista.status, 200); assert.equal(lista.body.data.registros.length, 1);
  assert.equal(lista.body.data.registros[0].id_usuario, 3);
  assert.equal((await request('GET', '/3')).body.data.roles[0].nombre, 'VENDEDOR');
  const catalogo = await request('GET', '/roles');
  assert.equal(catalogo.status, 200); assert.ok(!catalogo.body.data.some(r => r.id_rol === 4));
  const catalogoAdmin = await request('GET', '/roles', undefined, 2);
  assert.ok(!catalogoAdmin.body.data.some(r => r.nombre === 'ROOT'));
  assert.equal((await request('GET', '/999')).status, 404);
});

test('editar perfil, desactivar y activar sin modificar contraseñas', async t => {
  const { state, request } = await fixture(t);
  assert.equal((await request('PUT', '/3', perfil('editado'), 2)).status, 200);
  assert.equal(state.usuarios[2].username, 'editado');
  assert.equal((await request('PATCH', '/3/estado', { activo: false }, 2)).status, 200);
  assert.equal(state.usuarios[2].activo, 0);
  assert.equal((await request('PATCH', '/3/estado', { activo: true }, 2)).status, 200);
  assert.equal(state.usuarios[2].activo, 1);
  assert.equal((await request('PUT', '/3', { ...perfil('otro'), password: 'No cambiar clave' })).status, 400);
  assert.equal((await request('PATCH', '/2/estado', { activo: false }, 2)).status, 409);
});

test('asignación y revocación de roles; inexistentes o inactivos no se asignan', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('PUT', '/3/roles', { roles: [2, 3] }, 2)).status, 200);
  const r = await request('PUT', '/3/roles', { roles: [] }, 2);
  assert.equal(r.status, 200); assert.deepEqual(r.body.data.roles, []);
  for (const roles of [[4], [999]]) {
    assert.equal((await request('PUT', '/3/roles', { roles }, 2)).status, 400);
  }
});

test('sin permisos: 403 en todos los endpoints aunque JWT diga ROOT', async t => {
  const { request } = await fixture(t);
  for (const [m, ruta, body] of [['GET', ''], ['GET', '/roles'], ['GET', '/2'],
    ['POST', '', datos()], ['PUT', '/2', perfil('otro')], ['PATCH', '/2/estado', { activo: false }],
    ['PUT', '/2/roles', { roles: [1] }]]) {
    assert.equal((await request(m, ruta, body, 3)).status, 403);
  }
});

test('ROOT solo puede asignarse o retirarse por ROOT vigente; no ROOT no modifica ROOT', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('POST', '', { ...datos(), roles: [1] }, 2)).status, 403);
  assert.equal((await request('PUT', '/3/roles', { roles: [1] }, 2)).status, 403);
  assert.equal((await request('PUT', '/1/roles', { roles: [] }, 2)).status, 403);
  assert.equal((await request('PATCH', '/1/estado', { activo: false }, 2)).status, 403);
  assert.equal((await request('PUT', '/1', perfil('cambiado'), 2)).status, 403);
  assert.equal((await request('PUT', '/3/roles', { roles: [1] })).status, 200);
  assert.equal((await request('PUT', '/3/roles', { roles: [3] })).status, 200);
});

test('último administrador: no puede perder roles aunque se conserve otro usuario activo', async t => {
  const { state, request } = await fixture(t);
  state.usuarios[1].activo = 0;
  assert.equal((await request('PUT', '/1/roles', { roles: [] })).status, 409);
  assert.equal(state.usuarioRoles.find(ur => ur.id_usuario === 1).id_rol, 1);
});

test('capacidad administrativa se calcula por permisos, no por nombre ADMINISTRADOR', async t => {
  const { state, request } = await fixture(t);
  state.rolPermisos = [];
  assert.equal((await request('PUT', '/1/roles', { roles: [] })).status, 409);
});

test('un operador con permiso de estado no puede desactivar al último administrador', async t => {
  const { state, request } = await fixture(t);
  state.roles.push({ id_rol: 5, nombre: 'OPERADOR', activo: 1 });
  state.rolPermisos.push({ id_rol: 5, id_permiso: 3 });
  state.usuarioRoles = state.usuarioRoles.filter(ur => ur.id_usuario !== 1);
  state.usuarioRoles.push({ id_usuario: 1, id_rol: 5 });
  assert.equal((await request('PATCH', '/2/estado', { activo: false })).status, 409);
  assert.equal(state.usuarios[1].activo, 1);
});

test('revalidar al actor bajo bloqueo impide usar permisos revocados tras el middleware', async t => {
  const { state, request } = await fixture(t); state.revocarActor = 2;
  assert.equal((await request('PATCH', '/3/estado', { activo: false }, 2)).status, 403);
  assert.equal(state.usuarios[2].activo, 1);
});

test('dos revocaciones concurrentes no eliminan al último administrador', async t => {
  const { state, request } = await fixture(t);
  state.usuarioRoles = [{ id_usuario: 1, id_rol: 1 }, { id_usuario: 2, id_rol: 1 }, { id_usuario: 3, id_rol: 3 }];
  const respuestas = await Promise.all([
    request('PUT', '/1/roles', { roles: [] }, 1), request('PUT', '/2/roles', { roles: [] }, 2)
  ]);
  assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
  assert.equal(state.usuarioRoles.filter(ur => ur.id_rol === 1).length, 1);
});

test('fallo de auditoría revierte usuario, hash y roles y devuelve error genérico', async t => {
  const { state, request } = await fixture(t); state.fallo = true;
  const r = await request('POST', '', datos());
  assert.equal(r.status, 500); assert.equal(r.body.message, 'Error interno del servidor');
  assert.equal(state.usuarios.length, 3); assert.equal(Object.keys(state.hashes).length, 0);
  assert.equal(state.usuarioRoles.length, 3); assert.equal(state.rollbacks, 1);
});

test('fallo al reemplazar roles revierte la eliminación inicial', async t => {
  const { state, request } = await fixture(t); state.falloRoles = true;
  assert.equal((await request('PUT', '/3/roles', { roles: [2] })).status, 500);
  assert.equal(state.usuarioRoles.find(ur => ur.id_usuario === 3).id_rol, 3);
  assert.equal(state.auditoria.length, 0); assert.equal(state.rollbacks, 1);
});

test('catálogo de auditoría incluye usuarios sin duplicar eventos transaccionales', () => {
  const catalogo = cargar('config/auditEvents.js', {});
  const eventos = catalogo.eventos.filter(e => e.modulo === 'USUARIOS');
  assert.equal(eventos.length, 5); assert.ok(eventos.every(e => e.transaccional));
  assert.equal(catalogo.buscarEvento('POST', '/api/usuarios'), null);
  assert.equal(catalogo.buscarEvento('PUT', '/api/usuarios/3/roles'), null);
  assert.ok(catalogo.buscarEvento('POST', '/api/productos'));
});

test('repositorio real: consultas parametrizadas, bloqueo ordenado, commit y rollback con pool simulado', async () => {
  const llamadas = []; let fallo = false;
  const db = {
    async query(sql, params) {
      llamadas.push({ sql, params });
      if (fallo) throw new Error('fallo simulado');
      if (sql.includes('COUNT(*)')) return [[{ total: 0 }]];
      if (sql.startsWith('INSERT INTO usuarios')) return [{ insertId: 5 }];
      return [[]];
    },
    async beginTransaction() { llamadas.push('begin'); }, async commit() { llamadas.push('commit'); },
    async rollback() { llamadas.push('rollback'); }, release() { llamadas.push('release'); }
  };
  const repository = cargar('repositories/userRepository.js', {
    '../config/database': { pool: { ...db, async getConnection() { return db; } } }
  });
  await repository.transaccion(async conn => {
    await repository.bloquearSeguridad(conn);
    await repository.crear(conn, datos(), 'hash-no-exponer');
    await repository.asignarRoles(conn, 5, [2, 3]);
    await repository.editar(conn, 5, perfil('editado'));
    await repository.estado(conn, 5, false);
    await repository.auditar(conn, 1, 5, 'CREAR', null, { activo: 1 }, null);
  });
  assert.deepEqual(llamadas.filter(x => typeof x === 'string'), ['begin', 'commit', 'release']);
  const locks = llamadas.filter(x => x.sql?.includes('FOR UPDATE'));
  assert.equal(locks.length, 5);
  assert.ok(locks[0].sql.includes('FROM roles')); assert.ok(locks[3].sql.includes('FROM usuarios'));
  const insert = llamadas.find(x => x.sql?.startsWith('INSERT INTO usuarios'));
  assert.ok(!insert.sql.includes('hash-no-exponer')); assert.equal(insert.params[4], 'hash-no-exponer');
  assert.ok(!llamadas.find(x => x.sql?.includes('INSERT INTO auditoria')).params.join().includes('hash-no-exponer'));
  await repository.listar({ buscar: "' OR 1=1", activo: '1', id_rol: '3', pagina: 2, limite: 10 });
  const listado = llamadas.find(x => x.sql?.includes('OFFSET'));
  assert.ok(!listado.sql.includes("' OR 1=1")); assert.equal(listado.params.at(-1), 10);
  assert.equal(await repository.detalle(5), null);
  await repository.rolesDisponibles();
  for (const call of llamadas.filter(x => x.sql?.trim().startsWith('SELECT'))) {
    assert.ok(!call.sql.includes('password_hash')); assert.ok(!call.sql.includes('SELECT *'));
  }
  fallo = true;
  await assert.rejects(repository.transaccion(conn => repository.estado(conn, 5, true)));
  assert.deepEqual(llamadas.slice(-2), ['rollback', 'release']);
});
