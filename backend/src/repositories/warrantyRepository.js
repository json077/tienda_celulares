const { pool } = require('../config/database');

// DATE permanece como texto; toda comparación usa el calendario de MySQL.
const seleccionGarantia = `SELECT g.id_garantia, g.id_venta, g.id_detalle_venta,
  g.id_producto, g.id_unidad,
  DATE_FORMAT(g.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
  DATE_FORMAT(g.fecha_fin, '%Y-%m-%d') AS fecha_fin, g.dias_garantia,
  CASE WHEN g.estado = 'VIGENTE' AND g.fecha_fin < CURDATE()
    THEN 'VENCIDA' ELSE g.estado END AS estado,
  g.created_at, g.updated_at FROM garantias g`;

async function obtenerTodas() {
  const [rows] = await pool.query(`${seleccionGarantia} ORDER BY g.id_garantia DESC`);
  return rows;
}

async function obtenerPorId(id, connection = pool) {
  const [rows] = await connection.query(
    `${seleccionGarantia} WHERE g.id_garantia = ?`, [id]
  );
  return rows[0] || null;
}

async function obtenerParaActualizar(connection, id) {
  const [rows] = await connection.query(
    `SELECT g.*, (CURDATE() BETWEEN fecha_inicio AND fecha_fin) AS en_cobertura
     FROM garantias g WHERE id_garantia = ? FOR UPDATE`, [id]
  );
  return rows[0] || null;
}

async function obtenerVentaParaActualizar(connection, id) {
  const [rows] = await connection.query(
    `SELECT id_venta, estado, DATE_FORMAT(DATE(fecha), '%Y-%m-%d') AS fecha_inicio
     FROM ventas WHERE id_venta = ? FOR UPDATE`, [id]
  );
  return rows[0] || null;
}

async function obtenerDetalleParaActualizar(connection, id) {
  const [rows] = await connection.query(
    `SELECT dv.id_detalle_venta, dv.id_venta, dv.id_producto, dv.cantidad,
            dv.dias_garantia, p.tipo_control
     FROM detalle_ventas dv INNER JOIN productos p ON p.id_producto = dv.id_producto
     WHERE dv.id_detalle_venta = ? FOR UPDATE`, [id]
  );
  return rows[0] || null;
}

async function obtenerUnidadVendida(connection, idDetalle, idUnidad, idProducto) {
  const [rows] = await connection.query(
    `SELECT up.id_unidad FROM detalle_venta_unidades dvu
     INNER JOIN unidades_producto up ON up.id_unidad = dvu.id_unidad
     WHERE dvu.id_detalle_venta = ? AND up.id_unidad = ? AND up.id_producto = ?
     FOR UPDATE`, [idDetalle, idUnidad, idProducto]
  );
  return rows[0] || null;
}

async function existeGarantia(connection, idVenta, idDetalle, idUnidad) {
  const [rows] = await connection.query(
    `SELECT id_garantia FROM garantias
     WHERE id_venta = ? AND
       ((? IS NULL AND id_detalle_venta = ?) OR (? IS NOT NULL AND id_unidad = ?))
     LIMIT 1 FOR UPDATE`, [idVenta, idUnidad, idDetalle, idUnidad, idUnidad]
  );
  return rows.length > 0;
}

async function crearGarantia(connection, datos) {
  const [result] = await connection.query(
    `INSERT INTO garantias (id_venta, id_detalle_venta, id_producto, id_unidad,
       fecha_inicio, fecha_fin, dias_garantia, estado)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL ? DAY), ?,
       CASE WHEN DATE_ADD(?, INTERVAL ? DAY) < CURDATE() THEN 'VENCIDA' ELSE 'VIGENTE' END)`,
    [datos.id_venta, datos.id_detalle_venta, datos.id_producto, datos.id_unidad,
      datos.fecha_inicio, datos.fecha_inicio, datos.dias_garantia, datos.dias_garantia,
      datos.fecha_inicio, datos.dias_garantia]
  );
  return result.insertId;
}

async function obtenerSucursal(connection, id) {
  const [rows] = await connection.query(
    'SELECT id_sucursal, activo FROM sucursales WHERE id_sucursal = ? FOR UPDATE', [id]
  );
  return rows[0] || null;
}

async function obtenerReclamos(idGarantia, connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM reclamos_garantia WHERE id_garantia = ? ORDER BY id_reclamo DESC',
    [idGarantia]
  );
  return rows;
}

async function obtenerReclamo(id, connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM reclamos_garantia WHERE id_reclamo = ?', [id]
  );
  return rows[0] || null;
}

async function obtenerReclamoParaActualizar(connection, id) {
  const [rows] = await connection.query(
    'SELECT * FROM reclamos_garantia WHERE id_reclamo = ? FOR UPDATE', [id]
  );
  return rows[0] || null;
}

async function existeReclamoAbierto(connection, idGarantia) {
  const [rows] = await connection.query(
    `SELECT id_reclamo FROM reclamos_garantia WHERE id_garantia = ?
     AND estado IN ('RECIBIDO', 'EN_REVISION', 'APROBADO', 'RECHAZADO')
     LIMIT 1 FOR UPDATE`, [idGarantia]
  );
  return rows.length > 0;
}

async function crearReclamo(connection, datos) {
  const [result] = await connection.query(
    `INSERT INTO reclamos_garantia (numero_reclamo, id_garantia, id_sucursal,
       id_usuario_recibe, motivo, observacion, estado)
     VALUES (?, ?, ?, ?, ?, ?, 'RECIBIDO')`,
    [datos.numero_reclamo, datos.id_garantia, datos.id_sucursal,
      datos.id_usuario_recibe, datos.motivo, datos.observacion]
  );
  return result.insertId;
}

async function actualizarReclamo(connection, id, anterior, datos, idUsuario) {
  const [result] = await connection.query(
    `UPDATE reclamos_garantia SET estado = ?, diagnostico = ?, solucion = ?, observacion = ?,
       id_usuario_resuelve = CASE WHEN ? = 'RESUELTO' THEN ? ELSE id_usuario_resuelve END,
       fecha_resolucion = CASE WHEN ? = 'RESUELTO' THEN NOW() ELSE fecha_resolucion END
     WHERE id_reclamo = ? AND estado = ?`,
    [datos.estado, datos.diagnostico, datos.solucion, datos.observacion,
      datos.estado, idUsuario, datos.estado, id, anterior]
  );
  return result.affectedRows;
}

module.exports = {
  pool, obtenerTodas, obtenerPorId, obtenerParaActualizar, obtenerVentaParaActualizar,
  obtenerDetalleParaActualizar, obtenerUnidadVendida, existeGarantia, crearGarantia,
  obtenerSucursal, obtenerReclamos, obtenerReclamo, obtenerReclamoParaActualizar,
  existeReclamoAbierto, crearReclamo, actualizarReclamo
};
