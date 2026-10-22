const { pool } = require('../config/database');

// ============================================================
// OBTENER VENTA PARA REGISTRAR PAGO
// ============================================================

async function obtenerVentaParaPago(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      v.id_venta,
      v.numero_venta,
      v.id_sucursal,
      v.tipo_venta,
      v.total,
      v.estado
    FROM ventas v
    WHERE v.id_venta = ?
    FOR UPDATE
    `,
    [idVenta]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER MONEDA
// ============================================================

async function obtenerMoneda(connection, idMoneda) {
  const [rows] = await connection.query(
    `
    SELECT
      id_moneda,
      codigo,
      nombre,
      simbolo,
      activo
    FROM monedas
    WHERE id_moneda = ?
    `,
    [idMoneda]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER ÚLTIMO TIPO DE CAMBIO ACTIVO
// ============================================================

async function obtenerUltimoTipoCambio(connection, idMoneda) {
  const [rows] = await connection.query(
    `
    SELECT
      id_tipo_cambio,
      id_moneda,
      tasa,
      fecha,
      activo
    FROM tipos_cambio
    WHERE id_moneda = ?
      AND activo = 1
    ORDER BY fecha DESC, id_tipo_cambio DESC
    LIMIT 1
    `,
    [idMoneda]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER SESIÓN DE CAJA
// ============================================================

async function obtenerSesionCaja(connection, idSesionCaja) {
  const [rows] = await connection.query(
    `
    SELECT
      sc.id_sesion_caja,
      sc.id_caja,
      sc.estado,
      c.id_sucursal,
      c.codigo AS codigo_caja,
      c.nombre AS caja,
      c.activo AS caja_activa
    FROM sesiones_caja sc
    INNER JOIN cajas c
      ON c.id_caja = sc.id_caja
    WHERE sc.id_sesion_caja = ?
    FOR UPDATE
    `,
    [idSesionCaja]
  );

  return rows[0] || null;
}

// ============================================================
// TOTAL PAGADO EN MONEDA BASE
// ============================================================

async function obtenerTotalPagado(connection, idVenta) {
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

// ============================================================
// REGISTRAR PAGO
// ============================================================

async function crearPago(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO pagos (
      id_venta,
      id_moneda,
      id_sesion_caja,
      id_usuario,
      metodo,
      monto,
      tipo_cambio,
      monto_base,
      referencia,
      estado
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APLICADO')
    `,
    [
      datos.id_venta,
      datos.id_moneda,
      datos.id_sesion_caja || null,
      datos.id_usuario,
      datos.metodo,
      datos.monto,
      datos.tipo_cambio,
      datos.monto_base,
      datos.referencia || null
    ]
  );

  return result.insertId;
}

// ============================================================
// REGISTRAR MOVIMIENTO DE CAJA
// ============================================================

async function registrarMovimientoCaja(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO movimientos_caja (
      id_sesion_caja,
      id_usuario,
      tipo,
      monto,
      tipo_referencia,
      id_referencia,
      concepto
    )
    VALUES (?, ?, 'VENTA', ?, 'PAGO', ?, ?)
    `,
    [
      datos.id_sesion_caja,
      datos.id_usuario,
      datos.monto,
      datos.id_pago,
      datos.concepto
    ]
  );

  return result.insertId;
}

// ============================================================
// OBTENER PAGO POR ID
// ============================================================

async function obtenerPagoPorId(idPago) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id_pago,
      p.id_venta,
      v.numero_venta,
      p.id_moneda,
      m.codigo AS moneda,
      m.simbolo,
      p.id_sesion_caja,
      p.id_usuario,
      u.username AS usuario,
      p.metodo,
      p.monto,
      p.tipo_cambio,
      p.monto_base,
      p.referencia,
      p.fecha,
      p.estado
    FROM pagos p
    INNER JOIN ventas v
      ON v.id_venta = p.id_venta
    INNER JOIN monedas m
      ON m.id_moneda = p.id_moneda
    INNER JOIN usuarios u
      ON u.id_usuario = p.id_usuario
    WHERE p.id_pago = ?
    `,
    [idPago]
  );

  return rows[0] || null;
}

// ============================================================
// LISTAR PAGOS DE UNA VENTA
// ============================================================

async function obtenerPagosPorVenta(idVenta) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id_pago,
      p.id_venta,
      p.id_moneda,
      m.codigo AS moneda,
      m.simbolo,
      p.id_sesion_caja,
      p.id_usuario,
      u.username AS usuario,
      p.metodo,
      p.monto,
      p.tipo_cambio,
      p.monto_base,
      p.referencia,
      p.fecha,
      p.estado
    FROM pagos p
    INNER JOIN monedas m
      ON m.id_moneda = p.id_moneda
    INNER JOIN usuarios u
      ON u.id_usuario = p.id_usuario
    WHERE p.id_venta = ?
    ORDER BY p.fecha, p.id_pago
    `,
    [idVenta]
  );

  return rows;
}

// ============================================================
// OBTENER PAGO PARA ANULACIÓN CON BLOQUEO
// ============================================================

async function obtenerPagoParaAnular(connection, idPago) {
  const [rows] = await connection.query(
    `
    SELECT
      p.id_pago,
      p.id_venta,
      p.id_moneda,
      p.id_sesion_caja,
      p.id_usuario,
      p.metodo,
      p.monto,
      p.tipo_cambio,
      p.monto_base,
      p.referencia,
      p.fecha,
      p.estado,
      v.numero_venta,
      v.id_sucursal
    FROM pagos p
    INNER JOIN ventas v
      ON v.id_venta = p.id_venta
    WHERE p.id_pago = ?
    FOR UPDATE
    `,
    [idPago]
  );

  return rows[0] || null;
}

// ============================================================
// ANULAR PAGO
// ============================================================

async function anularPago(connection, idPago) {
  const [result] = await connection.query(
    `
    UPDATE pagos
    SET estado = 'ANULADO'
    WHERE id_pago = ?
      AND estado = 'APLICADO'
    `,
    [idPago]
  );

  return result.affectedRows;
}

// ============================================================
// REGISTRAR REVERSIÓN EN CAJA
// ============================================================

async function registrarAnulacionCaja(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO movimientos_caja (
      id_sesion_caja,
      id_usuario,
      tipo,
      monto,
      tipo_referencia,
      id_referencia,
      concepto
    )
    VALUES (?, ?, 'ANULACION', ?, 'PAGO', ?, ?)
    `,
    [
      datos.id_sesion_caja,
      datos.id_usuario,
      datos.monto,
      datos.id_pago,
      datos.concepto
    ]
  );

  return result.insertId;
}

module.exports = {
  pool,
  obtenerVentaParaPago,
  obtenerMoneda,
  obtenerUltimoTipoCambio,
  obtenerSesionCaja,
  obtenerTotalPagado,
  crearPago,
  registrarMovimientoCaja,
  obtenerPagoPorId,
  obtenerPagosPorVenta,
  obtenerPagoParaAnular,
  anularPago,
  registrarAnulacionCaja
};