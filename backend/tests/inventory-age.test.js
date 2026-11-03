const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const definitions = require('../src/services/reportDefinitions');
const service = require('../src/services/reportService');
function repository(pool) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/repositories/reportRepository.js'), 'utf8'), { module, require: () => ({ pool }) });
  return module.exports;
}
test('antigüedad: validación, evidencia original y filtros parametrizados', () => {
  for (const filters of [{ desde: '2026-01-01' }, { antiguedad: 'otro' }, { imei: ' ' }, { imei: 'x'.repeat(81) }, { imei: ['x'] }]) assert.throws(() => service.validate('antiguedad_imei', filters));
  const filters = service.validate('antiguedad_imei', { antiguedad: 'No determinada', imei: "%' OR 1=1", id_sucursal: '2', id_producto: '3' });
  const { sql, params } = repository({}).buildQuery('antiguedad_imei', filters, { id_usuario: 7, roles: [] });
  assert.match(sql, /u.estado='DISPONIBLE'/);
  assert.match(sql, /p.activo=1 AND s.activo=1/);
  assert.match(sql, /s.id_sucursal=u.id_sucursal_actual/);
  assert.match(sql, /m.entradas=1/);
  assert.match(sql, /m.id_referencia=c.id_compra/);
  assert.match(sql, /DATEDIFF\(CURRENT_DATE\(\)/);
  assert.doesNotMatch(sql, /created_at|updated_at|c.fecha/);
  assert.equal(params.join('|'), "7|2|3|No determinada|%' OR 1=1|%' OR 1=1|%' OR 1=1");
  assert.doesNotMatch(sql, /%' OR 1=1/);
});
test('MySQL solo lectura: esquema real y antigüedad con compras, transferencias, devoluciones e incertidumbre', { skip: process.env.REPORTS_MYSQL_READONLY !== '1' }, async t => {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, decimalNumbers: true, connectTimeout: 6000 });
  t.after(async () => { await connection.rollback(); await connection.end(); });
  await connection.query('START TRANSACTION READ ONLY');
  for (const table of ['unidades_producto', 'detalle_compras', 'compras', 'movimientos_inventario', 'inventario_sucursal']) {
    const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
    t.diagnostic(`${table}: ${columns.map(c => `${c.Field} ${c.Type}`).join(', ')}`);
  }
  const [[clock]] = await connection.query('SELECT CURRENT_DATE() dia, @@session.time_zone zona, @@system_time_zone sistema');
  t.diagnostic(JSON.stringify(clock));
  const repo = repository(connection);
  const root = { roles: ['ROOT'] };
  const actual = await repo.read('antiguedad_imei', {}, root);
  t.diagnostic(`Unidades disponibles reales: ${actual.length}; fecha verificable: ${actual.filter(r => r.dias != null).length}`);
  assert.equal((await repo.read('antiguedad_imei', {}, { id_usuario: 999999999, roles: [] })).length, 0);
  for (const range of definitions.antiguedad_imei.ageRanges) {
    const selected = await repo.read('antiguedad_imei', { antiguedad: range }, root);
    assert.deepEqual(selected, actual.filter(r => r.clasificacion === range));
  }
  assert.equal((await repo.read('antiguedad_imei', { imei: 'NO-EXISTE-IMEI-PRUEBA' }, root)).length, 0);
  for (const days of [0, 30, 31, 60, 61, 90, 91]) {
    const { sql } = repo.buildQuery('antiguedad_imei', {}, root);
    const fixture = sql
      .replace('unidades_producto u', `(SELECT 1 id_unidad, 1 id_producto, 2 id_sucursal_actual, 1 id_detalle_compra, 'IMEI' imei1, NULL imei2, NULL numero_serie, 'DISPONIBLE' estado) u`)
      .replace('productos p', "(SELECT 1 id_producto, 'SERIALIZADO' tipo_control, 1 activo, 'Producto' nombre, 'SKU' sku) p")
      .replace('sucursales s', "(SELECT 2 id_sucursal, 1 activo, 'Destino' nombre) s")
      .replace('detalle_compras dc', '(SELECT 1 id_detalle_compra, 1 id_producto, 1 id_compra) dc')
      .replace('compras c', "(SELECT 1 id_compra, 1 id_sucursal, 'CONFIRMADA' estado, 'C1' numero_documento) c")
      .replace('FROM movimientos_inventario WHERE', 'FROM movimientos_inventario source_m WHERE')
      .replaceAll('movimientos_inventario', `(SELECT 1 id_unidad, 1 id_producto, 1 id_sucursal, 'COMPRA' tipo, 1 cantidad, 'COMPRA' tipo_referencia, 1 id_referencia, DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY) fecha UNION ALL SELECT 1,1,2,'TRANSFERENCIA_ENTRADA',1,'TRANSFERENCIA',2,CURRENT_DATE() UNION ALL SELECT 1,1,2,'DEVOLUCION',1,'DEVOLUCION',3,CURRENT_DATE())`);
    const [[row]] = await connection.query(fixture);
    assert.equal(row.dias, days);
    assert.equal(row.clasificacion, days <= 30 ? 'Reciente' : days <= 60 ? 'Seguimiento' : days <= 90 ? 'Inventario lento' : 'Revisar');
    const [[unknown]] = await connection.query(fixture.replaceAll("'COMPRA' tipo,", "'AJUSTE_ENTRADA' tipo,"));
    assert.equal(unknown.dias, null); assert.equal(unknown.fecha_ingreso, 'No determinada');
    const [[noPurchase]] = await connection.query(fixture.replace('1 id_detalle_compra,', 'NULL id_detalle_compra,'));
    assert.equal(noPurchase.dias, null);
    const [[future]] = await connection.query(fixture.replaceAll(`INTERVAL ${days} DAY`, 'INTERVAL -1 DAY'));
    assert.equal(future.dias, null);
    const [[draft]] = await connection.query(fixture.replace("'CONFIRMADA' estado", "'BORRADOR' estado"));
    assert.equal(draft.dias, null);
    for (const state of ['VENDIDO', 'DEFECTUOSO', 'DEVUELTO', 'RESERVADO', 'EN_TRANSFERENCIA']) {
      const [excluded] = await connection.query(fixture.replace("'DISPONIBLE' estado", `'${state}' estado`));
      assert.equal(excluded.length, 0);
    }
  }
});
