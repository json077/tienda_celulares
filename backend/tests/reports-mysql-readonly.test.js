// Explicit opt-in. All SQL runs inside START TRANSACTION READ ONLY; never use the app's audited routes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('MySQL solo lectura: ocho reportes, filtros, totales y aislamiento real de sucursales', { skip: process.env.REPORTS_MYSQL_READONLY !== '1' }, async t => {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, decimalNumbers: true, connectTimeout: 6000 });
  t.after(async () => { await connection.rollback(); await connection.end(); });
  await connection.query('START TRANSACTION READ ONLY');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/repositories/reportRepository.js'), 'utf8'), {
    module, require: () => ({ pool: connection }),
  });
  const repo = module.exports;
  const root = { id_usuario: 1, roles: ['ROOT'] };
  await t.test('créditos: inicio fuera de octubre aunque la venta sea de octubre', async () => {
    // SELECT-derived fixtures exercise the real SQL without creating or changing records.
    const { sql, params } = repo.buildQuery('creditos', { desde: '2026-10-01', hasta: '2026-10-31' }, root);
    const fixtureSql = sql
      .replace('creditos c', `(SELECT 205 id_venta, 52 id_cliente, 'ACTIVO' estado,
        1000 monto_total, 770 saldo_pendiente, CAST('2026-01-11' AS DATE) fecha_inicio) c`)
      .replace('ventas v', `(SELECT 205 id_venta, 1 id_sucursal, 'REGRESION' numero_venta,
        CAST('2026-10-25' AS DATE) fecha) v`)
      .replace('sucursales s', "(SELECT 1 id_sucursal, 'Central' nombre) s")
      .replace('clientes cl', "(SELECT 52 id_cliente, 'Prueba' nombres, '' apellidos) cl");
    const [october] = await connection.query(fixtureSql, params);
    assert.equal(october.length, 0);
    const [january] = await connection.query(fixtureSql, ['2026-01-01', '2026-01-31']);
    assert.equal(january.length, 1);
    assert.equal(Number(january[0].saldo_pendiente), 770);
    const all = await repo.read('creditos', {}, root);
    const actual = await repo.read('creditos', { desde: '2026-10-01', hasta: '2026-10-31' }, root);
    assert.deepEqual(actual, all.filter(r => r.fecha >= '2026-10-01' && r.fecha <= '2026-10-31'));
  });
  assert.ok(Array.isArray(await repo.products(root)));
  assert.equal((await repo.products({ id_usuario: 999999999, roles: ['VENDEDOR'] })).length, 0);
  const specs = {
    ventas: ["SELECT COUNT(*) n, COALESCE(SUM(total),0) total FROM ventas", 'total'],
    compras: ["SELECT COUNT(*) n, COALESCE(SUM(total),0) total FROM compras", 'total'],
    existencias: ["SELECT COUNT(*) n, COALESCE(SUM(stock_actual),0) total FROM inventario_sucursal", 'stock_actual'],
    movimientos: ["SELECT COUNT(*) n, COALESCE(SUM(cantidad),0) total FROM movimientos_inventario", 'cantidad'],
    ranking: ["SELECT COUNT(DISTINCT d.id_producto) n, COALESCE(SUM(d.cantidad),0) total FROM detalle_ventas d INNER JOIN ventas v ON v.id_venta=d.id_venta WHERE v.estado='CONFIRMADA'", 'cantidad'],
    creditos: ["SELECT COUNT(*) n, COALESCE(SUM(saldo_pendiente),0) total FROM creditos WHERE estado='ACTIVO' AND saldo_pendiente>0", 'saldo_pendiente'],
    pagos: ["SELECT COUNT(*) n, COALESCE(SUM(monto_base),0) total FROM pagos", 'monto_base'],
    devoluciones: ["SELECT COUNT(*) n, COALESCE(SUM(total_devuelto),0) total FROM devoluciones", 'total_devuelto'],
  };
  for (const [id, [sql, key]] of Object.entries(specs)) {
    await t.test(id, async () => {
      const rows = await repo.read(id, {}, root);
      const [[expected]] = await connection.query(sql);
      assert.equal(rows.length, expected.n);
      const sum = rows.reduce((n, r) => n + Math.round(Number(r[key]) * 100), 0) / 100;
      assert.equal(sum, Number(expected.total));
      assert.equal((await repo.read(id, { ...(id === 'existencias' ? { id_producto: 999999999 } : { desde: '1000-01-01', hasta: '1000-01-01' }) }, root)).length, 0);
      assert.equal((await repo.read(id, {}, { id_usuario: 999999999, roles: ['ADMINISTRADOR'] })).length, 0);
    });
  }
  const [[expected]] = await connection.query("SELECT COUNT(*) n, COALESCE(SUM(monto_base),0) total FROM pagos WHERE estado='APLICADO' AND metodo='EFECTIVO' AND fecha>='2026-10-01' AND fecha<'2026-11-01'");
  const filtered = await repo.read('pagos', { estado: 'APLICADO', metodo: 'EFECTIVO', desde: '2026-10-01', hasta: '2026-10-31' }, root);
  assert.equal(filtered.length, expected.n);
  assert.equal(filtered.reduce((n, r) => n + Math.round(r.monto_base * 100), 0) / 100, Number(expected.total));
  const [members] = await connection.query('SELECT us.id_usuario, us.id_sucursal, s.nombre FROM usuario_sucursales us INNER JOIN sucursales s ON s.id_sucursal=us.id_sucursal AND s.activo=1 INNER JOIN usuarios u ON u.id_usuario=us.id_usuario AND u.activo=1 LIMIT 1');
  if (members.length) {
    const user = { id_usuario: members[0].id_usuario, roles: ['ADMINISTRADOR'] };
    const branches = await repo.branches(user);
    const names = new Set(branches.map(b => b.nombre));
    for (const id of Object.keys(specs).filter(id => id !== 'ranking')) {
      const scoped = await repo.read(id, { id_sucursal: members[0].id_sucursal }, user);
      assert.ok(scoped.every(r => names.has(r.sucursal)));
    }
    const [[expectedSales]] = await connection.query('SELECT COUNT(*) n FROM ventas WHERE id_sucursal=?', [members[0].id_sucursal]);
    assert.equal((await repo.read('ventas', { id_sucursal: members[0].id_sucursal }, user)).length, expectedSales.n);
    const [[expectedRanking]] = await connection.query("SELECT COALESCE(SUM(d.cantidad),0) cantidad FROM detalle_ventas d INNER JOIN ventas v ON v.id_venta=d.id_venta WHERE v.estado='CONFIRMADA' AND v.id_sucursal=?", [members[0].id_sucursal]);
    const scopedRanking = await repo.read('ranking', { id_sucursal: members[0].id_sucursal }, user);
    assert.equal(scopedRanking.reduce((n, r) => n + Number(r.cantidad), 0), Number(expectedRanking.cantidad));
  }
});
