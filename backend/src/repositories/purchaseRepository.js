const { pool } = require('../config/database');

async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT
      c.id_compra,
      c.id_proveedor,
      p.nombre AS proveedor,
      c.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      c.id_usuario,
      u.username AS usuario,
      c.numero_documento,
      c.fecha,
      c.subtotal,
      c.descuento,
      c.impuesto,
      c.total,
      c.estado,
      c.observacion,
      c.created_at,
      c.updated_at
    FROM compras c
    INNER JOIN proveedores p
      ON p.id_proveedor = c.id_proveedor
    INNER JOIN sucursales s
      ON s.id_sucursal = c.id_sucursal
    INNER JOIN usuarios u
      ON u.id_usuario = c.id_usuario
    ORDER BY c.id_compra DESC
  `);

  return rows;
}

async function obtenerPorId(idCompra) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id_compra,
      c.id_proveedor,
      p.nombre AS proveedor,
      c.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      c.id_usuario,
      u.username AS usuario,
      c.numero_documento,
      c.fecha,
      c.subtotal,
      c.descuento,
      c.impuesto,
      c.total,
      c.estado,
      c.observacion,
      c.created_at,
      c.updated_at
    FROM compras c
    INNER JOIN proveedores p
      ON p.id_proveedor = c.id_proveedor
    INNER JOIN sucursales s
      ON s.id_sucursal = c.id_sucursal
    INNER JOIN usuarios u
      ON u.id_usuario = c.id_usuario
    WHERE c.id_compra = ?
    LIMIT 1
    `,
    [idCompra]
  );

  return rows[0] || null;
}

async function obtenerDetalles(idCompra) {
  const [rows] = await pool.query(
    `
    SELECT
      dc.id_detalle_compra,
      dc.id_compra,
      dc.id_producto,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      dc.cantidad,
      dc.costo_unitario,
      dc.descuento,
      dc.impuesto,
      dc.subtotal
    FROM detalle_compras dc
    INNER JOIN productos p
      ON p.id_producto = dc.id_producto
    WHERE dc.id_compra = ?
    ORDER BY dc.id_detalle_compra ASC
    `,
    [idCompra]
  );

  return rows;
}

async function obtenerProveedor(connection, idProveedor) {
  const [rows] = await connection.query(
    `
    SELECT
      id_proveedor,
      nombre,
      activo
    FROM proveedores
    WHERE id_proveedor = ?
    LIMIT 1
    `,
    [idProveedor]
  );

  return rows[0] || null;
}

async function obtenerSucursal(connection, idSucursal) {
  const [rows] = await connection.query(
    `
    SELECT
      id_sucursal,
      codigo,
      nombre,
      activo
    FROM sucursales
    WHERE id_sucursal = ?
    LIMIT 1
    `,
    [idSucursal]
  );

  return rows[0] || null;
}

async function obtenerProducto(connection, idProducto) {
  const [rows] = await connection.query(
    `
    SELECT
      id_producto,
      sku,
      nombre,
      tipo_control,
      activo
    FROM productos
    WHERE id_producto = ?
    LIMIT 1
    `,
    [idProducto]
  );

  return rows[0] || null;
}

async function crearCompra(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO compras (
      id_proveedor,
      id_sucursal,
      id_usuario,
      numero_documento,
      subtotal,
      descuento,
      impuesto,
      total,
      estado,
      observacion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BORRADOR', ?)
    `,
    [
      datos.id_proveedor,
      datos.id_sucursal,
      datos.id_usuario,
      datos.numero_documento,
      datos.subtotal,
      datos.descuento,
      datos.impuesto,
      datos.total,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

async function crearDetalle(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO detalle_compras (
      id_compra,
      id_producto,
      cantidad,
      costo_unitario,
      descuento,
      impuesto,
      subtotal
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      datos.id_compra,
      datos.id_producto,
      datos.cantidad,
      datos.costo_unitario,
      datos.descuento,
      datos.impuesto,
      datos.subtotal
    ]
  );

  return result.insertId;
}

async function obtenerCompraParaActualizar(connection, idCompra) {
  const [rows] = await connection.query(
    `
    SELECT
      id_compra,
      id_proveedor,
      id_sucursal,
      id_usuario,
      numero_documento,
      subtotal,
      descuento,
      impuesto,
      total,
      estado,
      observacion
    FROM compras
    WHERE id_compra = ?
    FOR UPDATE
    `,
    [idCompra]
  );

  return rows[0] || null;
}

async function obtenerDetallesParaConfirmar(connection, idCompra) {
  const [rows] = await connection.query(
    `
    SELECT
      dc.id_detalle_compra,
      dc.id_compra,
      dc.id_producto,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      p.activo,
      dc.cantidad,
      dc.costo_unitario,
      dc.descuento,
      dc.impuesto,
      dc.subtotal
    FROM detalle_compras dc
    INNER JOIN productos p
      ON p.id_producto = dc.id_producto
    WHERE dc.id_compra = ?
    ORDER BY dc.id_detalle_compra ASC
    `,
    [idCompra]
  );

  return rows;
}

async function obtenerStock(connection, idSucursal, idProducto) {
  const [rows] = await connection.query(
    `
    SELECT
      id_sucursal,
      id_producto,
      stock_actual,
      stock_minimo
    FROM inventario_sucursal
    WHERE id_sucursal = ?
      AND id_producto = ?
    FOR UPDATE
    `,
    [idSucursal, idProducto]
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
    `
    INSERT INTO inventario_sucursal (
      id_sucursal,
      id_producto,
      stock_actual,
      stock_minimo
    )
    VALUES (?, ?, 0, ?)
    `,
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
    `
    UPDATE inventario_sucursal
    SET stock_actual = ?
    WHERE id_sucursal = ?
      AND id_producto = ?
    `,
    [stockNuevo, idSucursal, idProducto]
  );
}

async function registrarMovimiento(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO movimientos_inventario (
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
    VALUES (?, ?, ?, ?, 'COMPRA', ?, ?, ?, 'COMPRA', ?, ?)
    `,
    [
      datos.id_sucursal,
      datos.id_producto,
      datos.id_unidad || null,
      datos.id_usuario,
      datos.cantidad,
      datos.stock_anterior,
      datos.stock_nuevo,
      datos.id_compra,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

async function buscarUnidadPorImei(connection, imei) {
  const [rows] = await connection.query(
    `
    SELECT
      id_unidad,
      id_producto,
      imei1,
      imei2,
      numero_serie,
      estado
    FROM unidades_producto
    WHERE imei1 = ?
       OR imei2 = ?
    LIMIT 1
    `,
    [imei, imei]
  );

  return rows[0] || null;
}

async function buscarUnidadPorNumeroSerie(connection, numeroSerie) {
  if (!numeroSerie) {
    return null;
  }

  const [rows] = await connection.query(
    `
    SELECT
      id_unidad,
      id_producto,
      imei1,
      imei2,
      numero_serie,
      estado
    FROM unidades_producto
    WHERE numero_serie = ?
    LIMIT 1
    `,
    [numeroSerie]
  );

  return rows[0] || null;
}

async function crearUnidadCompra(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO unidades_producto (
      id_producto,
      id_sucursal_actual,
      id_detalle_compra,
      imei1,
      imei2,
      numero_serie,
      estado
    )
    VALUES (?, ?, ?, ?, ?, ?, 'DISPONIBLE')
    `,
    [
      datos.id_producto,
      datos.id_sucursal,
      datos.id_detalle_compra,
      datos.imei1,
      datos.imei2 || null,
      datos.numero_serie || null
    ]
  );

  return result.insertId;
}

async function confirmarCompra(connection, idCompra) {
  const [result] = await connection.query(
    `
    UPDATE compras
    SET estado = 'CONFIRMADA'
    WHERE id_compra = ?
      AND estado = 'BORRADOR'
    `,
    [idCompra]
  );

  return result.affectedRows;
}

async function anularCompra(connection, idCompra) {
  const [result] = await connection.query(
    `
    UPDATE compras
    SET estado = 'ANULADA'
    WHERE id_compra = ?
      AND estado = 'BORRADOR'
    `,
    [idCompra]
  );

  return result.affectedRows;
}

module.exports = {
  pool,
  obtenerTodas,
  obtenerPorId,
  obtenerDetalles,
  obtenerProveedor,
  obtenerSucursal,
  obtenerProducto,
  crearCompra,
  crearDetalle,

  obtenerCompraParaActualizar,
  obtenerDetallesParaConfirmar,
  obtenerStock,
  crearInventario,
  actualizarStock,
  registrarMovimiento,

  buscarUnidadPorImei,
  buscarUnidadPorNumeroSerie,
  crearUnidadCompra,

  confirmarCompra,
  anularCompra
};