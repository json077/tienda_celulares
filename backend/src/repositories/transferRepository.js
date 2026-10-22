const { pool } = require('../config/database');

// ============================================================
// LISTAR TRANSFERENCIAS
// ============================================================

async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT
      t.id_transferencia,
      t.numero_transferencia,

      t.id_sucursal_origen,
      so.codigo AS codigo_sucursal_origen,
      so.nombre AS sucursal_origen,

      t.id_sucursal_destino,
      sd.codigo AS codigo_sucursal_destino,
      sd.nombre AS sucursal_destino,

      t.id_usuario_solicita,
      us.username AS usuario_solicita,

      t.id_usuario_confirma,
      uc.username AS usuario_confirma,

      t.fecha_solicitud,
      t.fecha_confirmacion,
      t.estado,
      t.observacion,
      t.created_at,
      t.updated_at

    FROM transferencias t

    INNER JOIN sucursales so
      ON so.id_sucursal = t.id_sucursal_origen

    INNER JOIN sucursales sd
      ON sd.id_sucursal = t.id_sucursal_destino

    INNER JOIN usuarios us
      ON us.id_usuario = t.id_usuario_solicita

    LEFT JOIN usuarios uc
      ON uc.id_usuario = t.id_usuario_confirma

    ORDER BY t.fecha_solicitud DESC,
             t.id_transferencia DESC
  `);

  return rows;
}

// ============================================================
// OBTENER TRANSFERENCIA POR ID
// ============================================================

async function obtenerPorId(idTransferencia) {
  const [rows] = await pool.query(
    `
    SELECT
      t.id_transferencia,
      t.numero_transferencia,

      t.id_sucursal_origen,
      so.codigo AS codigo_sucursal_origen,
      so.nombre AS sucursal_origen,

      t.id_sucursal_destino,
      sd.codigo AS codigo_sucursal_destino,
      sd.nombre AS sucursal_destino,

      t.id_usuario_solicita,
      us.username AS usuario_solicita,

      t.id_usuario_confirma,
      uc.username AS usuario_confirma,

      t.fecha_solicitud,
      t.fecha_confirmacion,
      t.estado,
      t.observacion,
      t.created_at,
      t.updated_at

    FROM transferencias t

    INNER JOIN sucursales so
      ON so.id_sucursal = t.id_sucursal_origen

    INNER JOIN sucursales sd
      ON sd.id_sucursal = t.id_sucursal_destino

    INNER JOIN usuarios us
      ON us.id_usuario = t.id_usuario_solicita

    LEFT JOIN usuarios uc
      ON uc.id_usuario = t.id_usuario_confirma

    WHERE t.id_transferencia = ?
    `,
    [idTransferencia]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER TRANSFERENCIA CON BLOQUEO
// ============================================================

async function obtenerParaActualizar(connection, idTransferencia) {
  const [rows] = await connection.query(
    `
    SELECT
      id_transferencia,
      numero_transferencia,
      id_sucursal_origen,
      id_sucursal_destino,
      id_usuario_solicita,
      id_usuario_confirma,
      fecha_solicitud,
      fecha_confirmacion,
      estado,
      observacion

    FROM transferencias

    WHERE id_transferencia = ?

    FOR UPDATE
    `,
    [idTransferencia]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER SUCURSAL
// ============================================================

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

// ============================================================
// OBTENER PRODUCTO
// ============================================================

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

// ============================================================
// CREAR TRANSFERENCIA
// ============================================================

async function crearTransferencia(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO transferencias (
      numero_transferencia,
      id_sucursal_origen,
      id_sucursal_destino,
      id_usuario_solicita,
      estado,
      observacion
    )
    VALUES (?, ?, ?, ?, 'BORRADOR', ?)
    `,
    [
      datos.numero_transferencia,
      datos.id_sucursal_origen,
      datos.id_sucursal_destino,
      datos.id_usuario_solicita,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

// ============================================================
// CREAR DETALLE
// ============================================================

async function crearDetalle(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO detalle_transferencias (
      id_transferencia,
      id_producto,
      cantidad
    )
    VALUES (?, ?, ?)
    `,
    [
      datos.id_transferencia,
      datos.id_producto,
      datos.cantidad
    ]
  );

  return result.insertId;
}

// ============================================================
// ASOCIAR UNIDAD SERIALIZADA
// ============================================================

async function crearTransferenciaUnidad(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO transferencia_unidades (
      id_detalle_transferencia,
      id_unidad
    )
    VALUES (?, ?)
    `,
    [
      datos.id_detalle_transferencia,
      datos.id_unidad
    ]
  );

  return result.insertId;
}

// ============================================================
// OBTENER DETALLES
// ============================================================

async function obtenerDetalles(idTransferencia) {
  const [rows] = await pool.query(
    `
    SELECT
      dt.id_detalle_transferencia,
      dt.id_transferencia,
      dt.id_producto,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      dt.cantidad,
      dt.created_at

    FROM detalle_transferencias dt

    INNER JOIN productos p
      ON p.id_producto = dt.id_producto

    WHERE dt.id_transferencia = ?

    ORDER BY dt.id_detalle_transferencia
    `,
    [idTransferencia]
  );

  return rows;
}

// ============================================================
// OBTENER DETALLES CON BLOQUEO
// ============================================================

async function obtenerDetallesParaActualizar(
  connection,
  idTransferencia
) {
  const [rows] = await connection.query(
    `
    SELECT
      dt.id_detalle_transferencia,
      dt.id_transferencia,
      dt.id_producto,
      dt.cantidad,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      p.activo

    FROM detalle_transferencias dt

    INNER JOIN productos p
      ON p.id_producto = dt.id_producto

    WHERE dt.id_transferencia = ?

    ORDER BY dt.id_detalle_transferencia

    FOR UPDATE
    `,
    [idTransferencia]
  );

  return rows;
}

// ============================================================
// OBTENER UNIDADES DE UN DETALLE
// ============================================================

async function obtenerUnidadesDetalle(idDetalleTransferencia) {
  const [rows] = await pool.query(
    `
    SELECT
      tu.id_transferencia_unidad,
      tu.id_detalle_transferencia,
      tu.id_unidad,
      up.imei1,
      up.imei2,
      up.numero_serie,
      up.estado,
      up.id_sucursal_actual

    FROM transferencia_unidades tu

    INNER JOIN unidades_producto up
      ON up.id_unidad = tu.id_unidad

    WHERE tu.id_detalle_transferencia = ?

    ORDER BY tu.id_transferencia_unidad
    `,
    [idDetalleTransferencia]
  );

  return rows;
}

// ============================================================
// OBTENER UNIDADES CON BLOQUEO
// ============================================================

async function obtenerUnidadesDetalleParaActualizar(
  connection,
  idDetalleTransferencia
) {
  const [rows] = await connection.query(
    `
    SELECT
      tu.id_transferencia_unidad,
      tu.id_detalle_transferencia,
      tu.id_unidad,

      up.id_producto,
      up.id_sucursal_actual,
      up.imei1,
      up.imei2,
      up.numero_serie,
      up.estado

    FROM transferencia_unidades tu

    INNER JOIN unidades_producto up
      ON up.id_unidad = tu.id_unidad

    WHERE tu.id_detalle_transferencia = ?

    ORDER BY tu.id_unidad

    FOR UPDATE
    `,
    [idDetalleTransferencia]
  );

  return rows;
}

// ============================================================
// OBTENER UNIDAD PARA CREAR BORRADOR
// ============================================================

async function obtenerUnidad(connection, idUnidad) {
  const [rows] = await connection.query(
    `
    SELECT
      id_unidad,
      id_producto,
      id_sucursal_actual,
      imei1,
      imei2,
      numero_serie,
      estado

    FROM unidades_producto

    WHERE id_unidad = ?

    LIMIT 1
    `,
    [idUnidad]
  );

  return rows[0] || null;
}

// ============================================================
// STOCK CON BLOQUEO
// ============================================================

async function obtenerStock(
  connection,
  idSucursal,
  idProducto
) {
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

// ============================================================
// CREAR INVENTARIO DESTINO
// ============================================================

async function crearInventario(
  connection,
  idSucursal,
  idProducto
) {
  await connection.query(
    `
    INSERT INTO inventario_sucursal (
      id_sucursal,
      id_producto,
      stock_actual,
      stock_minimo
    )
    VALUES (?, ?, 0, 0)
    `,
    [idSucursal, idProducto]
  );
}

// ============================================================
// ACTUALIZAR STOCK
// ============================================================

async function actualizarStock(
  connection,
  idSucursal,
  idProducto,
  stockNuevo
) {
  const [result] = await connection.query(
    `
    UPDATE inventario_sucursal
    SET stock_actual = ?
    WHERE id_sucursal = ?
      AND id_producto = ?
    `,
    [
      stockNuevo,
      idSucursal,
      idProducto
    ]
  );

  return result.affectedRows;
}

// ============================================================
// MOVER UNIDAD SERIALIZADA
// ============================================================

async function moverUnidad(
  connection,
  idUnidad,
  idSucursalDestino
) {
  const [result] = await connection.query(
    `
    UPDATE unidades_producto
    SET
      id_sucursal_actual = ?,
      estado = 'DISPONIBLE'
    WHERE id_unidad = ?
    `,
    [
      idSucursalDestino,
      idUnidad
    ]
  );

  return result.affectedRows;
}

// ============================================================
// REGISTRAR MOVIMIENTO DE INVENTARIO
// ============================================================

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      datos.id_sucursal,
      datos.id_producto,
      datos.id_unidad || null,
      datos.id_usuario,
      datos.tipo,
      datos.cantidad,
      datos.stock_anterior,
      datos.stock_nuevo,
      'TRANSFERENCIA',
      datos.id_transferencia,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

// ============================================================
// CONFIRMAR TRANSFERENCIA
// ============================================================

async function confirmarTransferencia(
  connection,
  idTransferencia,
  idUsuario
) {
  const [result] = await connection.query(
    `
    UPDATE transferencias
    SET
      estado = 'CONFIRMADA',
      id_usuario_confirma = ?,
      fecha_confirmacion = NOW()
    WHERE id_transferencia = ?
      AND estado = 'BORRADOR'
    `,
    [
      idUsuario,
      idTransferencia
    ]
  );

  return result.affectedRows;
}

// ============================================================
// ANULAR TRANSFERENCIA
// ============================================================

async function anularTransferencia(
  connection,
  idTransferencia
) {
  const [result] = await connection.query(
    `
    UPDATE transferencias
    SET estado = 'ANULADA'
    WHERE id_transferencia = ?
      AND estado = 'BORRADOR'
    `,
    [idTransferencia]
  );

  return result.affectedRows;
}

module.exports = {
  pool,
  obtenerTodas,
  obtenerPorId,
  obtenerParaActualizar,
  obtenerSucursal,
  obtenerProducto,
  crearTransferencia,
  crearDetalle,
  crearTransferenciaUnidad,
  obtenerDetalles,
  obtenerDetallesParaActualizar,
  obtenerUnidadesDetalle,
  obtenerUnidadesDetalleParaActualizar,
  obtenerUnidad,
  obtenerStock,
  crearInventario,
  actualizarStock,
  moverUnidad,
  registrarMovimiento,
  confirmarTransferencia,
  anularTransferencia
};