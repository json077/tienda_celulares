const { pool } = require('../config/database');

// Reuse the existing repositories' joins/projections, but never their unscoped list methods.
// EXISTS avoids duplicates and enforces current branch membership in the data query itself.
function scope(actor, branch = 's.id_sucursal') {
  return actor.roles.includes('ROOT') ? { sql: '1=1', params: [] } : {
    sql: `s.activo = 1 AND EXISTS (SELECT 1 FROM usuario_sucursales us
      INNER JOIN usuarios actor ON actor.id_usuario = us.id_usuario AND actor.activo = 1
      WHERE us.id_usuario = ? AND us.id_sucursal = ${branch})`,
    params: [actor.id_usuario],
  };
}

async function branches(actor) {
  const access = scope(actor);
  const [rows] = await pool.query(`SELECT s.id_sucursal, s.nombre FROM sucursales s WHERE ${access.sql} ORDER BY s.nombre`, access.params);
  return rows;
}

async function products(actor) {
  const access = scope(actor);
  const [rows] = await pool.query(`SELECT DISTINCT p.id_producto, p.sku, p.nombre
    FROM productos p INNER JOIN inventario_sucursal i ON i.id_producto=p.id_producto
    INNER JOIN sucursales s ON s.id_sucursal=i.id_sucursal
    WHERE ${access.sql} ORDER BY p.nombre`, access.params);
  return rows;
}

const date = field => `DATE_FORMAT(${field}, '%Y-%m-%d %H:%i:%s') AS fecha`;
const queries = {
  ventas: { select: `v.numero_venta AS numero, ${date('v.fecha')}, s.nombre AS sucursal, CONCAT_WS(' ', c.nombres, c.apellidos) AS cliente, v.tipo_venta, v.estado, v.total`, from: 'ventas v INNER JOIN sucursales s ON s.id_sucursal=v.id_sucursal INNER JOIN clientes c ON c.id_cliente=v.id_cliente', date: 'v.fecha', state: 'v.estado' },
  compras: { select: `c.numero_documento AS numero, ${date('c.fecha')}, s.nombre AS sucursal, p.nombre AS proveedor, c.estado, c.total`, from: 'compras c INNER JOIN sucursales s ON s.id_sucursal=c.id_sucursal INNER JOIN proveedores p ON p.id_proveedor=c.id_proveedor', date: 'c.fecha', state: 'c.estado' },
  existencias: { select: 's.nombre AS sucursal, p.sku, p.nombre AS producto, i.stock_actual, i.stock_minimo', from: 'inventario_sucursal i INNER JOIN sucursales s ON s.id_sucursal=i.id_sucursal INNER JOIN productos p ON p.id_producto=i.id_producto', product: 'p.id_producto' },
  movimientos: { select: `${date('m.fecha')}, s.nombre AS sucursal, p.sku, p.nombre AS producto, m.tipo, m.cantidad, m.stock_anterior, m.stock_nuevo, CONCAT_WS(' #', m.tipo_referencia, m.id_referencia) AS referencia`, from: 'movimientos_inventario m INNER JOIN sucursales s ON s.id_sucursal=m.id_sucursal INNER JOIN productos p ON p.id_producto=m.id_producto', date: 'm.fecha', product: 'p.id_producto' },
  ranking: { select: 'p.sku, p.nombre AS producto, SUM(d.cantidad) AS cantidad, SUM(d.subtotal) AS importe', from: 'detalle_ventas d INNER JOIN ventas v ON v.id_venta=d.id_venta INNER JOIN sucursales s ON s.id_sucursal=v.id_sucursal INNER JOIN productos p ON p.id_producto=d.id_producto', date: 'v.fecha', product: 'p.id_producto', extra: "v.estado='CONFIRMADA'", end: 'GROUP BY p.id_producto, p.sku, p.nombre ORDER BY cantidad DESC, p.sku' },
  creditos: { select: `v.numero_venta AS numero, DATE_FORMAT(c.fecha_inicio, '%Y-%m-%d') AS fecha, s.nombre AS sucursal, CONCAT_WS(' ', cl.nombres, cl.apellidos) AS cliente, c.estado, c.monto_total, c.saldo_pendiente`, from: 'creditos c INNER JOIN ventas v ON v.id_venta=c.id_venta INNER JOIN sucursales s ON s.id_sucursal=v.id_sucursal INNER JOIN clientes cl ON cl.id_cliente=c.id_cliente', date: 'c.fecha_inicio', extra: "c.estado='ACTIVO' AND c.saldo_pendiente>0" },
  pagos: { select: `p.id_pago, v.numero_venta AS numero, ${date('p.fecha')}, s.nombre AS sucursal, p.metodo, m.codigo AS moneda, p.monto, p.monto_base, p.estado`, from: 'pagos p INNER JOIN ventas v ON v.id_venta=p.id_venta INNER JOIN sucursales s ON s.id_sucursal=v.id_sucursal INNER JOIN monedas m ON m.id_moneda=p.id_moneda', date: 'p.fecha', state: 'p.estado', method: 'p.metodo' },
  devoluciones: { select: `d.numero_devolucion AS numero, v.numero_venta AS venta, ${date('d.fecha')}, s.nombre AS sucursal, d.motivo, d.estado, d.total_devuelto`, from: 'devoluciones d INNER JOIN ventas v ON v.id_venta=d.id_venta INNER JOIN sucursales s ON s.id_sucursal=d.id_sucursal', date: 'd.fecha', state: 'd.estado' },
};

function buildQuery(type, filters, actor) {
  const q = queries[type];
  const access = scope(actor);
  const where = [access.sql];
  const params = [...access.params];
  const add = (sql, value) => { where.push(sql); params.push(value); };
  if (q.extra) where.push(q.extra);
  if (filters.id_sucursal) add('s.id_sucursal = ?', filters.id_sucursal);
  if (filters.desde) add(`${q.date} >= ?`, filters.desde);
  if (filters.hasta) add(`${q.date} < DATE_ADD(?, INTERVAL 1 DAY)`, filters.hasta);
  if (filters.estado) add(`${q.state} = ?`, filters.estado);
  if (filters.id_producto) add(`${q.product} = ?`, filters.id_producto);
  if (filters.metodo) add(`${q.method} = ?`, filters.metodo);
  const order = q.end || (q.date ? `ORDER BY ${q.date} DESC` : 'ORDER BY s.nombre, p.nombre');
  return { sql: `SELECT ${q.select} FROM ${q.from} WHERE ${where.join(' AND ')} ${order} LIMIT 10001`, params };
}

async function read(type, filters, actor) {
  const { sql, params } = buildQuery(type, filters, actor);
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { branches, products, read, buildQuery };
