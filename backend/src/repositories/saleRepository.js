const { pool } = require('../config/database');

async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT
      v.id_venta,
      v.id_cliente,
      CONCAT(c.nombres, ' ', COALESCE(c.apellidos, '')) AS cliente,
      c.identificacion AS identificacion_cliente,
      v.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      v.id_usuario,
      u.username AS usuario,
      v.numero_venta,
      v.fecha,
      v.tipo_venta,
      v.subtotal,
      v.descuento,
      v.impuesto,
      v.total,
      v.estado,
      v.observacion,
      v.created_at,
      v.updated_at
    FROM ventas v
    INNER JOIN clientes c
      ON c.id_cliente = v.id_cliente
    INNER JOIN sucursales s
      ON s.id_sucursal = v.id_sucursal
    INNER JOIN usuarios u
      ON u.id_usuario = v.id_usuario
    ORDER BY v.id_venta DESC
  `);

  return rows;
}

async function obtenerPorId(idVenta) {
  const [rows] = await pool.query(
    `
    SELECT
      v.id_venta,
      v.id_cliente,
      CONCAT(c.nombres, ' ', COALESCE(c.apellidos, '')) AS cliente,
      c.identificacion AS identificacion_cliente,
      c.direccion AS direccion_cliente,
      v.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      v.id_usuario,
      u.username AS usuario,
      v.numero_venta,
      v.fecha,
      v.tipo_venta,
      v.subtotal,
      v.descuento,
      v.impuesto,
      v.total,
      v.estado,
      v.observacion,
      v.created_at,
      v.updated_at
    FROM ventas v
    INNER JOIN clientes c
      ON c.id_cliente = v.id_cliente
    INNER JOIN sucursales s
      ON s.id_sucursal = v.id_sucursal
    INNER JOIN usuarios u
      ON u.id_usuario = v.id_usuario
    WHERE v.id_venta = ?
    LIMIT 1
    `,
    [idVenta]
  );

  return rows[0] || null;
}

async function obtenerDetalles(idVenta) {
  const [rows] = await pool.query(
    `
    SELECT
      dv.id_detalle_venta,
      dv.id_venta,
      dv.id_producto,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      dv.cantidad,
      dv.costo_unitario,
      dv.precio_unitario,
      dv.descuento,
      dv.impuesto,
      dv.subtotal,
      dv.dias_garantia
    FROM detalle_ventas dv
    INNER JOIN productos p
      ON p.id_producto = dv.id_producto
    WHERE dv.id_venta = ?
    ORDER BY dv.id_detalle_venta ASC
    `,
    [idVenta]
  );

  return rows;
}

async function obtenerCliente(connection, idCliente) {
  const [rows] = await connection.query(
    `
    SELECT
      id_cliente,
      tipo_identificacion,
      identificacion,
      nombres,
      apellidos,
      direccion,
      activo
    FROM clientes
    WHERE id_cliente = ?
    LIMIT 1
    `,
    [idCliente]
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
      precio_venta,
      permite_descuento,
      porcentaje_descuento_maximo,
      dias_garantia,
      activo
    FROM productos
    WHERE id_producto = ?
    LIMIT 1
    `,
    [idProducto]
  );

  return rows[0] || null;
}

async function crearVenta(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO ventas (
      id_cliente,
      id_sucursal,
      id_usuario,
      numero_venta,
      tipo_venta,
      subtotal,
      descuento,
      impuesto,
      total,
      estado,
      observacion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BORRADOR', ?)
    `,
    [
      datos.id_cliente,
      datos.id_sucursal,
      datos.id_usuario,
      datos.numero_venta,
      datos.tipo_venta,
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
    INSERT INTO detalle_ventas (
      id_venta,
      id_producto,
      cantidad,
      costo_unitario,
      precio_unitario,
      descuento,
      impuesto,
      subtotal,
      dias_garantia
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      datos.id_venta,
      datos.id_producto,
      datos.cantidad,
      datos.costo_unitario,
      datos.precio_unitario,
      datos.descuento,
      datos.impuesto,
      datos.subtotal,
      datos.dias_garantia
    ]
  );

  return result.insertId;
}

async function obtenerVentaParaActualizar(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      v.id_venta,
      v.id_cliente,
      v.id_sucursal,
      v.id_usuario,
      v.numero_venta,
      v.tipo_venta,
      v.subtotal,
      v.descuento,
      v.impuesto,
      v.total,
      v.estado,
      v.observacion,

      c.nombres,
      c.apellidos,
      c.identificacion,
      c.direccion

    FROM ventas v

    INNER JOIN clientes c
      ON c.id_cliente = v.id_cliente

    WHERE v.id_venta = ?

    FOR UPDATE
    `,
    [idVenta]
  );

  return rows[0] || null;
}

async function obtenerDetallesParaConfirmar(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      dv.id_detalle_venta,
      dv.id_venta,
      dv.id_producto,
      p.sku,
      p.nombre AS producto,
      p.tipo_control,
      p.activo,
      dv.cantidad,
      dv.costo_unitario,
      dv.precio_unitario,
      dv.descuento,
      dv.impuesto,
      dv.subtotal,
      dv.dias_garantia
    FROM detalle_ventas dv
    INNER JOIN productos p
      ON p.id_producto = dv.id_producto
    WHERE dv.id_venta = ?
    ORDER BY dv.id_detalle_venta ASC
    `,
    [idVenta]
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
    VALUES (?, ?, ?, ?, 'VENTA', ?, ?, ?, 'VENTA', ?, ?)
    `,
    [
      datos.id_sucursal,
      datos.id_producto,
      datos.id_unidad || null,
      datos.id_usuario,
      datos.cantidad,
      datos.stock_anterior,
      datos.stock_nuevo,
      datos.id_venta,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

async function confirmarVenta(connection, idVenta) {
  const [result] = await connection.query(
    `
    UPDATE ventas
    SET estado = 'CONFIRMADA'
    WHERE id_venta = ?
      AND estado = 'BORRADOR'
    `,
    [idVenta]
  );

  return result.affectedRows;
}

async function obtenerUnidadParaVenta(connection, idUnidad) {
  const [rows] = await connection.query(
    `
    SELECT
      up.id_unidad,
      up.id_producto,
      up.id_sucursal_actual,
      up.id_detalle_compra,
      up.imei1,
      up.imei2,
      up.numero_serie,
      up.estado
    FROM unidades_producto up
    WHERE up.id_unidad = ?
    FOR UPDATE
    `,
    [idUnidad]
  );

  return rows[0] || null;
}

async function unidadYaAsignadaAVenta(connection, idUnidad) {
  const [rows] = await connection.query(
    `
    SELECT
      dvu.id_detalle_venta,
      dvu.id_unidad
    FROM detalle_venta_unidades dvu
    INNER JOIN detalle_ventas dv
      ON dv.id_detalle_venta = dvu.id_detalle_venta
    INNER JOIN ventas v
      ON v.id_venta = dv.id_venta
    WHERE dvu.id_unidad = ?
      AND v.estado = 'CONFIRMADA'
    LIMIT 1
    `,
    [idUnidad]
  );

  return rows[0] || null;
}

async function asignarUnidadAVenta(
  connection,
  idDetalleVenta,
  idUnidad
) {
  await connection.query(
    `
    INSERT INTO detalle_venta_unidades (
      id_detalle_venta,
      id_unidad
    )
    VALUES (?, ?)
    `,
    [idDetalleVenta, idUnidad]
  );
}

async function marcarUnidadVendida(connection, idUnidad) {
  const [result] = await connection.query(
    `
    UPDATE unidades_producto
    SET estado = 'VENDIDO'
    WHERE id_unidad = ?
      AND estado = 'DISPONIBLE'
    `,
    [idUnidad]
  );

  return result.affectedRows;
}

async function obtenerUltimoCostoProducto(connection, idProducto) {
  const [rows] = await connection.query(
    `
    SELECT
      dc.costo_unitario
    FROM detalle_compras dc
    INNER JOIN compras c
      ON c.id_compra = dc.id_compra
    WHERE dc.id_producto = ?
      AND c.estado = 'CONFIRMADA'
    ORDER BY c.fecha DESC, c.id_compra DESC
    LIMIT 1
    `,
    [idProducto]
  );

  return rows[0]
    ? Number(rows[0].costo_unitario)
    : 0;
}

async function obtenerCostoUnidad(connection, idUnidad) {
  const [rows] = await connection.query(
    `
    SELECT
      dc.costo_unitario
    FROM unidades_producto up
    INNER JOIN detalle_compras dc
      ON dc.id_detalle_compra = up.id_detalle_compra
    INNER JOIN compras c
      ON c.id_compra = dc.id_compra
    WHERE up.id_unidad = ?
      AND c.estado = 'CONFIRMADA'
    LIMIT 1
    `,
    [idUnidad]
  );

  return rows[0]
    ? Number(rows[0].costo_unitario)
    : null;
}

async function actualizarCostoDetalle(
  connection,
  idDetalleVenta,
  costoUnitario
) {
  await connection.query(
    `
    UPDATE detalle_ventas
    SET costo_unitario = ?
    WHERE id_detalle_venta = ?
    `,
    [costoUnitario, idDetalleVenta]
  );
}

async function obtenerFacturaPorVenta(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      id_factura,
      id_venta,
      numero_factura,
      serie,
      fecha_emision,
      estado,
      nombre_cliente,
      identificacion_cliente,
      direccion_cliente,
      subtotal,
      descuento,
      impuesto,
      total
    FROM facturas
    WHERE id_venta = ?
    LIMIT 1
    `,
    [idVenta]
  );

  return rows[0] || null;
}

async function crearFactura(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO facturas (
      id_venta,
      numero_factura,
      serie,
      nombre_cliente,
      identificacion_cliente,
      direccion_cliente,
      subtotal,
      descuento,
      impuesto,
      total
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      datos.id_venta,
      datos.numero_factura,
      datos.serie,
      datos.nombre_cliente,
      datos.identificacion_cliente,
      datos.direccion_cliente,
      datos.subtotal,
      datos.descuento,
      datos.impuesto,
      datos.total
    ]
  );

  return result.insertId;
}

async function obtenerFacturaCompleta(idVenta) {
  const [rows] = await pool.query(
    `
    SELECT
      f.id_factura,
      f.id_venta,
      f.numero_factura,
      f.serie,
      f.fecha_emision,
      f.estado,

      f.nombre_cliente,
      f.identificacion_cliente,
      f.direccion_cliente,

      f.subtotal,
      f.descuento,
      f.impuesto,
      f.total,

      v.numero_venta,
      v.tipo_venta,
      v.fecha AS fecha_venta,

      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      s.direccion AS direccion_sucursal,
      s.telefono AS telefono_sucursal,

      u.username AS usuario

    FROM facturas f

    INNER JOIN ventas v
      ON v.id_venta = f.id_venta

    INNER JOIN sucursales s
      ON s.id_sucursal = v.id_sucursal

    INNER JOIN usuarios u
      ON u.id_usuario = v.id_usuario

    WHERE f.id_venta = ?

    LIMIT 1
    `,
    [idVenta]
  );

  return rows[0] || null;
}

async function obtenerUnidadesVendidas(idDetalleVenta) {
  const [rows] = await pool.query(
    `
    SELECT
      up.id_unidad,
      up.imei1,
      up.imei2,
      up.numero_serie
    FROM detalle_venta_unidades dvu
    INNER JOIN unidades_producto up
      ON up.id_unidad = dvu.id_unidad
    WHERE dvu.id_detalle_venta = ?
    ORDER BY up.id_unidad
    `,
    [idDetalleVenta]
  );

  return rows;
}

// ============================================================
// OBTENER UNIDADES DE UN DETALLE PARA ANULACIÓN
// ============================================================

async function obtenerUnidadesParaAnular(
  connection,
  idDetalleVenta
) {
  const [rows] = await connection.query(
    `
    SELECT
      up.id_unidad,
      up.id_producto,
      up.id_sucursal_actual,
      up.imei1,
      up.imei2,
      up.numero_serie,
      up.estado
    FROM detalle_venta_unidades dvu
    INNER JOIN unidades_producto up
      ON up.id_unidad = dvu.id_unidad
    WHERE dvu.id_detalle_venta = ?
    ORDER BY up.id_unidad
    FOR UPDATE
    `,
    [idDetalleVenta]
  );

  return rows;
}

// ============================================================
// DEVOLVER UNIDAD VENDIDA A DISPONIBLE
// ============================================================

async function marcarUnidadDisponible(connection, idUnidad) {
  const [result] = await connection.query(
    `
    UPDATE unidades_producto
    SET estado = 'DISPONIBLE'
    WHERE id_unidad = ?
      AND estado = 'VENDIDO'
    `,
    [idUnidad]
  );

  return result.affectedRows;
}

// ============================================================
// REGISTRAR MOVIMIENTO POR ANULACIÓN DE VENTA
// ============================================================

async function registrarMovimientoAnulacion(connection, datos) {
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
    VALUES (?, ?, ?, ?, 'ANULACION', ?, ?, ?, 'VENTA', ?, ?)
    `,
    [
      datos.id_sucursal,
      datos.id_producto,
      datos.id_unidad || null,
      datos.id_usuario,
      datos.cantidad,
      datos.stock_anterior,
      datos.stock_nuevo,
      datos.id_venta,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

// ============================================================
// ANULAR VENTA CONFIRMADA
// ============================================================

async function anularVenta(connection, idVenta) {
  const [result] = await connection.query(
    `
    UPDATE ventas
    SET estado = 'ANULADA'
    WHERE id_venta = ?
      AND estado = 'CONFIRMADA'
    `,
    [idVenta]
  );

  return result.affectedRows;
}

// ============================================================
// ANULAR FACTURA DE LA VENTA
// ============================================================

async function anularFactura(connection, idVenta) {
  const [result] = await connection.query(
    `
    UPDATE facturas
    SET estado = 'ANULADA'
    WHERE id_venta = ?
      AND estado <> 'ANULADA'
    `,
    [idVenta]
  );

  return result.affectedRows;
}

// ============================================================
// OBTENER TOTAL DE PAGOS APLICADOS DE UNA VENTA
// ============================================================

async function tieneDevolucionesConfirmadas(connection, idVenta) {
  // Lectura actual: ve confirmaciones que terminaron mientras se esperaba
  // el bloqueo de la venta, incluso bajo REPEATABLE READ.
  const [rows] = await connection.query(
    `SELECT id_devolucion FROM devoluciones
     WHERE id_venta = ? AND estado = 'CONFIRMADA'
     LIMIT 1 FOR UPDATE`,
    [idVenta]
  );

  return rows.length > 0;
}

async function obtenerTotalPagosAplicados(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      COALESCE(SUM(monto_base), 0) AS total_pagado
    FROM pagos
    WHERE id_venta = ?
      AND estado = 'APLICADO'
    `,
    [idVenta]
  );

  return Number(rows[0].total_pagado || 0);
}

module.exports = {
  pool,

  obtenerTodas,
  obtenerPorId,
  obtenerDetalles,

  obtenerCliente,
  obtenerSucursal,
  obtenerProducto,

  crearVenta,
  crearDetalle,

  obtenerVentaParaActualizar,
  obtenerDetallesParaConfirmar,
  obtenerStock,
  actualizarStock,
  registrarMovimiento,
  confirmarVenta,

  obtenerUnidadParaVenta,
  unidadYaAsignadaAVenta,
  asignarUnidadAVenta,
  marcarUnidadVendida,

  obtenerUltimoCostoProducto,
  obtenerCostoUnidad,
  actualizarCostoDetalle,

  obtenerFacturaPorVenta,
  crearFactura,
  obtenerFacturaCompleta,
  obtenerUnidadesVendidas,

  obtenerUnidadesParaAnular,
  marcarUnidadDisponible,
  registrarMovimientoAnulacion,
  anularVenta,
  anularFactura,
  obtenerTotalPagosAplicados,
  tieneDevolucionesConfirmadas
};
