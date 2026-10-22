const { pool } = require('../config/database');

async function obtenerInventario() {
  const [rows] = await pool.query(`
    SELECT
      i.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      i.id_producto,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      i.stock_actual,
      i.stock_minimo,
      CASE
        WHEN i.stock_actual <= i.stock_minimo THEN TRUE
        ELSE FALSE
      END AS stock_bajo,
      i.updated_at
    FROM inventario_sucursal i
    INNER JOIN sucursales s
      ON s.id_sucursal = i.id_sucursal
    INNER JOIN productos p
      ON p.id_producto = i.id_producto
    ORDER BY s.nombre, p.nombre
  `);

  return rows;
}

async function obtenerStock(connection, idSucursal, idProducto) {
  const [rows] = await connection.query(
    `SELECT
       id_sucursal,
       id_producto,
       stock_actual,
       stock_minimo
     FROM inventario_sucursal
     WHERE id_sucursal = ?
       AND id_producto = ?
     FOR UPDATE`,
    [idSucursal, idProducto]
  );

  return rows[0] || null;
}

async function obtenerProducto(connection, idProducto) {
  const [rows] = await connection.query(
    `SELECT id_producto, sku, nombre, tipo_control, activo
     FROM productos
     WHERE id_producto = ?
     LIMIT 1`,
    [idProducto]
  );

  return rows[0] || null;
}

async function obtenerSucursal(connection, idSucursal) {
  const [rows] = await connection.query(
    `SELECT id_sucursal, codigo, nombre, activo
     FROM sucursales
     WHERE id_sucursal = ?
     LIMIT 1`,
    [idSucursal]
  );

  return rows[0] || null;
}

async function crearInventario(
  connection,
  idSucursal,
  idProducto,
  stockMinimo = 0
) {
  await connection.query(
    `INSERT INTO inventario_sucursal
       (id_sucursal, id_producto, stock_actual, stock_minimo)
     VALUES (?, ?, 0, ?)`,
    [idSucursal, idProducto, stockMinimo]
  );
}

async function actualizarStock(
  connection,
  idSucursal,
  idProducto,
  stockNuevo
) {
  await connection.query(
    `UPDATE inventario_sucursal
     SET stock_actual = ?
     WHERE id_sucursal = ?
       AND id_producto = ?`,
    [stockNuevo, idSucursal, idProducto]
  );
}

async function registrarMovimiento(connection, datos) {
  const [result] = await connection.query(
    `INSERT INTO movimientos_inventario (
       id_sucursal,
       id_producto,
       id_unidad,
       id_usuario,
       tipo,
       cantidad,
       stock_anterior,
       stock_nuevo,
       tipo_referencia,
       id_referencia,
       observacion
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.id_sucursal,
      datos.id_producto,
      datos.id_unidad || null,
      datos.id_usuario,
      datos.tipo,
      datos.cantidad,
      datos.stock_anterior,
      datos.stock_nuevo,
      datos.tipo_referencia || null,
      datos.id_referencia || null,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

async function actualizarStockMinimo(
  idSucursal,
  idProducto,
  stockMinimo
) {
  const [result] = await pool.query(
    `UPDATE inventario_sucursal
     SET stock_minimo = ?
     WHERE id_sucursal = ?
       AND id_producto = ?`,
    [stockMinimo, idSucursal, idProducto]
  );

  return result.affectedRows;
}

async function obtenerMovimientos() {
  const [rows] = await pool.query(`
    SELECT
      m.id_movimiento,
      m.id_sucursal,
      s.nombre AS sucursal,
      m.id_producto,
      p.sku,
      p.nombre AS producto,
      m.id_unidad,
      m.id_usuario,
      u.username AS usuario,
      m.tipo,
      m.cantidad,
      m.stock_anterior,
      m.stock_nuevo,
      m.tipo_referencia,
      m.id_referencia,
      m.observacion,
      m.fecha
    FROM movimientos_inventario m
    INNER JOIN sucursales s
      ON s.id_sucursal = m.id_sucursal
    INNER JOIN productos p
      ON p.id_producto = m.id_producto
    INNER JOIN usuarios u
      ON u.id_usuario = m.id_usuario
    ORDER BY m.fecha DESC, m.id_movimiento DESC
  `);

  return rows;
}

module.exports = {
  pool,
  obtenerInventario,
  obtenerStock,
  obtenerProducto,
  obtenerSucursal,
  crearInventario,
  actualizarStock,
  registrarMovimiento,
  actualizarStockMinimo,
  obtenerMovimientos
};