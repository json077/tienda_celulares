const { pool } = require('../config/database');

async function sucursalAutorizada(idUsuario, idSucursal) {
  const [rows] = await pool.query(
    `SELECT 1 AS autorizada
     FROM usuario_sucursales us
     INNER JOIN usuarios actor ON actor.id_usuario = us.id_usuario AND actor.activo = 1
     INNER JOIN sucursales s ON s.id_sucursal = us.id_sucursal AND s.activo = 1
     WHERE us.id_usuario = ? AND us.id_sucursal = ? LIMIT 1`,
    [idUsuario, idSucursal]
  );
  return rows.length > 0;
}

async function obtenerDisponibles(idUsuario, idProducto, idSucursal) {
  const [rows] = await pool.query(
    `SELECT u.id_unidad, u.id_producto, u.id_sucursal_actual,
            u.imei1, u.imei2, u.numero_serie
     FROM unidades_producto u
     INNER JOIN productos p ON p.id_producto = u.id_producto
       AND p.activo = 1 AND p.tipo_control = 'SERIALIZADO'
     INNER JOIN sucursales s ON s.id_sucursal = u.id_sucursal_actual AND s.activo = 1
     INNER JOIN usuario_sucursales us ON us.id_sucursal = s.id_sucursal AND us.id_usuario = ?
     INNER JOIN usuarios actor ON actor.id_usuario = us.id_usuario AND actor.activo = 1
     WHERE u.id_producto = ? AND u.id_sucursal_actual = ? AND u.estado = 'DISPONIBLE'
     ORDER BY u.id_unidad`,
    [idUsuario, idProducto, idSucursal]
  );
  return rows;
}

/**
 * Obtiene una unidad serializada por su ID.
 */
async function obtenerPorId(idUnidad) {
  const [rows] = await pool.query(
    `
    SELECT
      u.id_unidad,
      u.id_producto,
      p.sku,
      p.nombre AS producto,
      u.id_sucursal_actual,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      u.id_detalle_compra,
      u.imei1,
      u.imei2,
      u.numero_serie,
      u.estado,
      u.created_at,
      u.updated_at
    FROM unidades_producto u
    INNER JOIN productos p
      ON p.id_producto = u.id_producto
    INNER JOIN sucursales s
      ON s.id_sucursal = u.id_sucursal_actual
    WHERE u.id_unidad = ?
    LIMIT 1
    `,
    [idUnidad]
  );

  return rows[0] || null;
}

/**
 * Lista todas las unidades serializadas.
 */
async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT
      u.id_unidad,
      u.id_producto,
      p.sku,
      p.nombre AS producto,
      u.id_sucursal_actual,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      u.id_detalle_compra,
      u.imei1,
      u.imei2,
      u.numero_serie,
      u.estado,
      u.created_at,
      u.updated_at
    FROM unidades_producto u
    INNER JOIN productos p
      ON p.id_producto = u.id_producto
    INNER JOIN sucursales s
      ON s.id_sucursal = u.id_sucursal_actual
    ORDER BY u.id_unidad DESC
  `);

  return rows;
}

/**
 * Busca si un IMEI ya está registrado como IMEI1 o IMEI2.
 */
async function buscarPorImei(connection, imei) {
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

/**
 * Busca si un número de serie ya está registrado.
 */
async function buscarPorNumeroSerie(connection, numeroSerie) {
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

/**
 * Obtiene un producto bloqueándolo mientras dura la transacción.
 */
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
    FOR UPDATE
    `,
    [idProducto]
  );

  return rows[0] || null;
}

/**
 * Obtiene la sucursal.
 */
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

/**
 * Crea una unidad física serializada.
 */
async function crearUnidad(connection, datos) {
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
      datos.id_detalle_compra || null,
      datos.imei1,
      datos.imei2 || null,
      datos.numero_serie || null
    ]
  );

  return result.insertId;
}

/**
 * Obtiene el registro de inventario de una sucursal/producto.
 * FOR UPDATE evita modificaciones simultáneas durante la transacción.
 */
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

/**
 * Crea el registro de inventario cuando todavía no existe.
 */
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

/**
 * Actualiza el stock total del producto en la sucursal.
 */
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

/**
 * Registra el movimiento correspondiente a la unidad serializada.
 */
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
      datos.id_unidad,
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

module.exports = {
  sucursalAutorizada,
  obtenerDisponibles,
  pool,
  obtenerPorId,
  obtenerTodas,
  buscarPorImei,
  buscarPorNumeroSerie,
  obtenerProducto,
  obtenerSucursal,
  crearUnidad,
  obtenerStock,
  crearInventario,
  actualizarStock,
  registrarMovimiento
};
