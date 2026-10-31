const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inflateRawSync } = require('node:zlib');
const express = require('express');
const jwt = require('jsonwebtoken');
const definitions = require('../src/services/reportDefinitions');
const service = require('../src/services/reportService');
const permission = require('../src/middlewares/permissionMiddleware');

function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, Buffer, console, process: { env: { JWT_SECRET: 'reports-test-only' } },
    require(name) { return Object.hasOwn(dependencies, name) ? dependencies[name] : require(name); },
  });
  return module.exports;
}

// Inspect the actual OOXML entries through the ZIP central directory, not just the PK signature.
function unzip(buffer) {
  const files = {};
  let offset = buffer.length - 22;
  while (offset >= 0 && buffer.readUInt32LE(offset) !== 0x06054b50) offset--;
  assert.ok(offset >= 0, 'ZIP end of central directory');
  const count = buffer.readUInt16LE(offset + 10);
  offset = buffer.readUInt32LE(offset + 16);
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const length = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 46, offset + 46 + length).toString();
    const local = buffer.readUInt32LE(offset + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const bytes = buffer.subarray(start, start + size);
    files[name] = (method === 8 ? inflateRawSync(bytes) : bytes).toString();
    offset += 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return files;
}

test('reportes: validación estricta de fechas, filtros aplicables y alcance', () => {
  assert.equal(Object.keys(definitions).length, 8);
  for (const [type, filters] of [
    ['no-existe', {}], ['toString', {}], ['ventas', { desde: '2026-02-30' }],
    ['ventas', { desde: '2026-11-01', hasta: '2026-10-01' }],
    ['ventas', { estado: ['CONFIRMADA'] }], ['ventas', { id_sucursal: '1 OR 1=1' }],
    ['ventas', { id_sucursal: '9007199254740992' }], ['existencias', { desde: '2026-01-01' }],
    ['ranking', { estado: 'ANULADA' }], ['pagos', { metodo: 'DESCONOCIDO' }],
    ['creditos', { estado: 'PAGADO' }], ['ventas', { otro: '1' }],
  ]) assert.throws(() => service.validate(type, filters));
  assert.deepEqual(service.validate('ventas', { desde: '2026-10-01', hasta: '2026-10-31', id_sucursal: '2', estado: 'CONFIRMADA' }), { desde: '2026-10-01', hasta: '2026-10-31', id_sucursal: 2, estado: 'CONFIRMADA' });
});

test('reportes: las ocho consultas son SELECT parametrizados con sucursal vigente y sin N+1', async () => {
  const calls = [];
  const repo = load('repositories/reportRepository.js', { '../config/database': { pool: {
    async query(sql, params) { calls.push({ sql, params }); return [[]]; },
  } } });
  for (const type of Object.keys(definitions)) {
    const filters = service.validate(type, { id_sucursal: '2', ...(type === 'existencias' ? { id_producto: '3' } : { desde: '2026-10-01', hasta: '2026-10-31' }), ...(type === 'pagos' ? { estado: 'APLICADO', metodo: 'EFECTIVO' } : {}) });
    await repo.read(type, filters, { id_usuario: 7, roles: ['ADMINISTRADOR'] });
    const { sql, params } = calls.at(-1);
    assert.match(sql, /^SELECT /);
    assert.doesNotMatch(sql, /INSERT|DELETE|FOR UPDATE|\bUPDATE\b/);
    assert.match(sql, /EXISTS.*usuario_sucursales/s);
    assert.match(sql, /actor.activo = 1/);
    assert.match(sql, /s.activo = 1/);
    assert.equal(params[0], 7);
    assert.equal(params[1], 2);
    if (type !== 'existencias') assert.match(sql, /< DATE_ADD\(\?, INTERVAL 1 DAY\)/);
    if (type === 'ranking') {
      assert.match(sql, /v.estado='CONFIRMADA'/);
      assert.match(sql, /SUM\(d.cantidad\)/);
      assert.match(sql, /GROUP BY/);
    }
    if (type === 'creditos') assert.match(sql, /c.estado='ACTIVO' AND c.saldo_pendiente>0/);
  }
  assert.equal(calls.length, 8);
  const root = repo.buildQuery('ventas', {}, { id_usuario: 1, roles: ['ROOT'] });
  assert.doesNotMatch(root.sql, /usuario_sucursales/);
  assert.equal(root.params.length, 0);
});

test('créditos pendientes: el período corresponde al inicio del crédito, no a la venta', () => {
  const repo = load('repositories/reportRepository.js', { '../config/database': { pool: {} } });
  const filters = service.validate('creditos', { desde: '2026-10-01', hasta: '2026-10-31' });
  const { sql, params } = repo.buildQuery('creditos', filters, { roles: ['ROOT'] });
  assert.match(sql, /c.fecha_inicio >= \?/);
  assert.match(sql, /c.fecha_inicio < DATE_ADD\(\?, INTERVAL 1 DAY\)/);
  assert.doesNotMatch(sql, /v.fecha\s*[<>]/);
  assert.match(sql, /c.estado='ACTIVO' AND c.saldo_pendiente>0/);
  assert.equal(params.join(','), '2026-10-01,2026-10-31');
});

test('reportes: proyección, totales exactos y negativa a truncar resultados', async () => {
  let rows = [{ numero: 'V1', fecha: '2026-10-31', sucursal: 'A', cliente: '=1+1', tipo_venta: 'CONTADO', estado: 'CONFIRMADA', total: '0.10', password_hash: 'NO MOSTRAR' }, { numero: 'V2', estado: 'ANULADA', total: '0.20' }];
  const s = load('services/reportService.js', {
    './reportDefinitions': definitions,
    '../repositories/reportRepository': { branches: async () => [{ id_sucursal: 1 }], read: async () => rows },
  });
  const actor = { id_usuario: 7, roles: [] };
  const result = await s.report('ventas', {}, actor);
  assert.equal(result.totals.find(t => t.label === 'Total (NIO)').value, 0.3);
  assert.equal(result.totals.find(t => t.label === 'CONFIRMADA (NIO)').value, 0.1);
  assert.ok(!JSON.stringify(result).includes('password_hash'));
  await assert.rejects(s.report('ventas', { id_sucursal: '2' }, actor), e => e.status === 403);
  rows = new Array(10001).fill(rows[0]);
  await assert.rejects(s.report('ventas', {}, actor), e => e.status === 422);
  const totals = service.summarize('pagos', [{ estado: 'APLICADO', monto: 100, monto_base: 3650 }, { estado: 'ANULADO', monto: 10, monto_base: 365 }]);
  assert.equal(totals.find(t => t.label === 'Aplicados (NIO)').value, 3650);
  assert.equal(totals.find(t => t.label === 'Anulados (NIO)').value, 365);
});

test('reportes: XLSX real para los ocho tipos con metadatos, números, resumen y texto seguro', async () => {
  for (const [id, definition] of Object.entries(definitions)) {
    const row = Object.fromEntries(definition.columns.map(c => [c.key, ['number', 'money'].includes(c.type) ? 12.5 : '=1+1']));
    if (id === 'pagos') row.estado = 'APLICADO';
    const data = { id, ...definition, note: definition.note || 'Datos seleccionados', filters: { id_sucursal: 1 }, generatedAt: '2026-10-31T12:00:00Z', rows: [row], totals: service.summarize(id, [row]) };
    const buffer = await service.excel(data);
    const files = unzip(buffer);
    assert.ok(files['[Content_Types].xml'].includes('spreadsheetml'));
    assert.ok(files['xl/workbook.xml'].includes('Reporte'));
    const xml = Object.values(files).join('\n');
    assert.ok(xml.includes(definition.title));
    assert.ok(xml.includes('id_sucursal=1'));
    assert.ok(xml.includes('2026-10-31T12:00:00Z'));
    assert.ok(xml.includes('Resumen'));
    assert.ok(xml.includes('=1+1'));
    assert.doesNotMatch(files['xl/worksheets/sheet1.xml'], /<f[ >]/);
    assert.match(files['xl/worksheets/sheet1.xml'], /<v>12.5<\/v>/);
  }
});

test('reportes HTTP: autenticación vigente, permisos de consulta/exportación, ROOT y sucursal', async t => {
  const state = { actor: { id_usuario: 7, activo: true, roles: ['VENDEDOR'], permisos: ['REPORTE_VER'] }, calls: 0 };
  const realService = load('services/reportService.js', {
    './reportDefinitions': definitions,
    '../repositories/reportRepository': {
      branches: async () => [{ id_sucursal: 1, nombre: 'Sucursal autorizada' }],
      products: async () => [],
      read: async () => { state.calls++; return []; },
    },
  });
  const controller = load('controllers/reportController.js', { '../services/reportService': realService });
  const auth = load('middlewares/authMiddleware.js', { jsonwebtoken: jwt, '../repositories/authRepository': { obtenerSesion: async () => state.actor } });
  const router = load('routes/reportRoutes.js', {
    express, '../controllers/reportController': controller,
    '../middlewares/authMiddleware': auth, '../middlewares/permissionMiddleware': permission,
  });
  const app = express(); app.use('/api/reportes', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ id_usuario: 7, roles: ['ROOT'] }, 'reports-test-only');
  const request = (suffix, authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}/api/reportes${suffix}`, { headers: authenticated ? { Authorization: `Bearer ${token}` } : {} });
  assert.equal((await request('/ventas', false)).status, 401);
  for (const id of Object.keys(definitions)) assert.equal((await request(`/${id}`)).status, 200);
  assert.equal((await request('/ventas/excel')).status, 403);
  state.actor.permisos = ['REPORTE_EXPORTAR'];
  assert.equal((await request('/ventas/excel')).status, 403);
  state.actor.permisos = ['REPORTE_VER', 'REPORTE_EXPORTAR'];
  assert.equal((await request('/ventas?id_sucursal=2')).status, 403);
  assert.equal((await request('/ventas?desde=2026-02-30')).status, 400);
  assert.equal((await request('/desconocido')).status, 404);
  const exported = await request('/pagos/excel?id_sucursal=1');
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-type'), /spreadsheetml.sheet/);
  unzip(Buffer.from(await exported.arrayBuffer()));
  state.actor.permisos = [];
  const count = state.calls;
  assert.equal((await request('/ventas')).status, 403);
  assert.equal(state.calls, count);
  state.actor.roles = ['ROOT'];
  assert.equal((await request('/ventas/excel')).status, 200);
  state.actor.activo = false;
  assert.equal((await request('/ventas')).status, 403);
});
