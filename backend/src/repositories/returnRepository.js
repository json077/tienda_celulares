const { pool } = require('../config/database');

async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT d.*, v.numero_venta, s.nombre AS sucursal, u.username AS usuario
    FROM devoluciones d
    INNER JOIN ventas v ON v.id_venta = d.id_venta
    INNER JOIN sucursales s ON s.id_sucursal = d.id_sucursal
    INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
    ORDER BY d.id_devolucion DESC
  `);
  return rows;
}

async function obtenerPorId(idDevolucion, connection = pool) {
  const [rows] = await connection.query(
    `SELECT * FROM devoluciones WHERE id_devolucion = ?`,
    [idDevolucion]
  );
  return rows[0] || null;
}

async function obtenerDetalles(idDevolucion, connection = pool) {
  const [rows] = await connection.query(
    `SELECT dd.*, p.nombre AS producto, p.tipo_control,
            up.imei1, up.imei2, up.numero_serie
     FROM detalle_devoluciones dd
     INNER JOIN productos p ON p.id_producto = dd.id_producto
     LEFT JOIN unidades_producto up ON up.id_unidad = dd.id_unidad
     WHERE dd.id_devolucion = ?
     ORDER BY dd.id_detalle_devolucion`,
    [idDevolucion]
  );
  return rows;
}

async function obtenerParaActualizar(connection, idDevolucion) {
  const [rows] = await connection.query(
    `SELECT * FROM devoluciones WHERE id_devolucion = ? FOR UPDATE`,
    [idDevolucion]
  );
  return rows[0] || null;
}

async function obtenerDetallesParaActualizar(connection, idDevolucion) {
  const [rows] = await connection.query(
    `SELECT * FROM detalle_devoluciones
     WHERE id_devolucion = ? ORDER BY id_detalle_devolucion FOR UPDATE`,
    [idDevolucion]
  );
  return rows;
}

async function obtenerVentaParaActualizar(connection, idVenta) {
  const [rows] = await connection.query(
    `SELECT id_venta, id_sucursal, estado FROM ventas
     WHERE id_venta = ? FOR UPDATE`,
    [idVenta]
  );
  return rows[0] || null;
}

async function obtenerDetalleVentaParaActualizar(connection, idDetalleVenta) {
  const [rows] = await connection.query(
    `SELECT dv.id_detalle_venta, dv.id_venta, dv.id_producto,
            dv.cantidad, dv.precio_unitario, p.tipo_control
     FROM detalle_ventas dv
     INNER JOIN productos p ON p.id_producto = dv.id_producto
     WHERE dv.id_detalle_venta = ? FOR UPDATE`,
    [idDetalleVenta]
  );
  return rows[0] || null;
}

async function obtenerCantidadDevuelta(connection, idDetalleVenta) {
  // Lectura actual con bloqueo: evita snapshots anteriores a otra confirmación.
  const [rows] = await connection.query(
    `SELECT dd.cantidad
     FROM detalle_devoluciones dd
     INNER JOIN devoluciones d ON d.id_devolucion = dd.id_devolucion
     WHERE dd.id_detalle_venta = ? AND d.estado = 'CONFIRMADA'
     FOR UPDATE`,
    [idDetalleVenta]
  );
  return rows.reduce((total, row) => total + Number(row.cantidad), 0);
}

async function obtenerUnidadParaActualizar(connection, idUnidad) {
  const [rows] = await connection.query(
    `SELECT id_unidad, id_producto, id_sucursal_actual, estado
     FROM unidades_producto WHERE id_unidad = ? FOR UPDATE`,
    [idUnidad]
  );
  return rows[0] || null;
}

async function unidadPerteneceADetalle(connection, idDetalleVenta, idUnidad) {
  const [rows] = await connection.query(
    `SELECT id_unidad FROM detalle_venta_unidades
     WHERE id_detalle_venta = ? AND id_unidad = ? FOR UPDATE`,
    [idDetalleVenta, idUnidad]
  );
  return rows.length > 0;
}

async function unidadYaDevuelta(connection, idUnidad) {
  const [rows] = await connection.query(
    `SELECT dd.id_detalle_devolucion
     FROM detalle_devoluciones dd
     INNER JOIN devoluciones d ON d.id_devolucion = dd.id_devolucion
     WHERE dd.id_unidad = ? AND d.estado = 'CONFIRMADA'
     LIMIT 1 FOR UPDATE`,
    [idUnidad]
  );
  return rows.length > 0;
}

async function crearDevolucion(connection, datos) {
  const [result] = await connection.query(
    `INSERT INTO devoluciones (
       numero_devolucion, id_venta, id_sucursal, id_usuario,
       motivo, estado, total_devuelto, observacion
     ) VALUES (?, ?, ?, ?, ?, 'BORRADOR', ?, ?)`,
    [datos.numero_devolucion, datos.id_venta, datos.id_sucursal,
      datos.id_usuario, datos.motivo, datos.total_devuelto, datos.observacion]
  );
  return result.insertId;
}

async function crearDetalle(connection, idDevolucion, datos) {
  await connection.query(
    `INSERT INTO detalle_devoluciones (
       id_devolucion, id_detalle_venta, id_producto, id_unidad, cantidad,
       precio_unitario, subtotal, condicion, reintegra_inventario, motivo
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [idDevolucion, datos.id_detalle_venta, datos.id_producto, datos.id_unidad,
      datos.cantidad, datos.precio_unitario, datos.subtotal, datos.condicion,
      datos.reintegra_inventario, datos.motivo]
  );
}

async function obtenerStock(connection, idSucursal, idProducto) {
  const [rows] = await connection.query(
    `SELECT stock_actual FROM inventario_sucursal
     WHERE id_sucursal = ? AND id_producto = ? FOR UPDATE`,
    [idSucursal, idProducto]
  );
  return rows[0] || null;
}

async function crearInventario(connection, idSucursal, idProducto) {
  // También bloquea una fila creada concurrentemente sin alterar sus existencias.
  await connection.query(
    `INSERT INTO inventario_sucursal
       (id_sucursal, id_producto, stock_actual, stock_minimo)
     VALUES (?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE stock_actual = stock_actual`,
    [idSucursal, idProducto]
  );
}

async function actualizarStock(connection, idSucursal, idProducto, stockNuevo) {
  await connection.query(
    `UPDATE inventario_sucursal SET stock_actual = ?
     WHERE id_sucursal = ? AND id_producto = ?`,
    [stockNuevo, idSucursal, idProducto]
  );
}

async function actualizarEstadoUnidad(connection, idUnidad, estado) {
  const [result] = await connection.query(
    `UPDATE unidades_producto SET estado = ?
     WHERE id_unidad = ? AND estado = 'VENDIDO'`,
    [estado, idUnidad]
  );
  return result.affectedRows;
}

async function registrarMovimiento(connection, datos) {
  await connection.query(
    `INSERT INTO movimientos_inventario (
       id_sucursal, id_producto, id_unidad, id_usuario, tipo, cantidad,
       stock_anterior, stock_nuevo, tipo_referencia, id_referencia, observacion
     ) VALUES (?, ?, ?, ?, 'DEVOLUCION', ?, ?, ?, 'DEVOLUCION', ?, ?)`,
    [datos.id_sucursal, datos.id_producto, datos.id_unidad, datos.id_usuario,
      datos.cantidad, datos.stock_anterior, datos.stock_nuevo,
      datos.id_devolucion, datos.observacion]
  );
}

async function cambiarEstado(connection, idDevolucion, estado) {
  const [result] = await connection.query(
    `UPDATE devoluciones SET estado = ?
     WHERE id_devolucion = ? AND estado = 'BORRADOR'`,
    [estado, idDevolucion]
  );
  return result.affectedRows;
}

module.exports = {
  pool, obtenerTodas, obtenerPorId, obtenerDetalles, obtenerParaActualizar,
  obtenerDetallesParaActualizar, obtenerVentaParaActualizar,
  obtenerDetalleVentaParaActualizar, obtenerCantidadDevuelta,
  obtenerUnidadParaActualizar, unidadPerteneceADetalle, unidadYaDevuelta,
  crearDevolucion, crearDetalle, obtenerStock, crearInventario, actualizarStock,
  actualizarEstadoUnidad, registrarMovimiento, cambiarEstado
};
