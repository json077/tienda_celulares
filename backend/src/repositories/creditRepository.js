const { pool } = require('../config/database');

// ============================================================
// LISTAR CRÉDITOS
// ============================================================

async function obtenerTodos() {
  const [rows] = await pool.query(`
    SELECT
      c.id_credito,
      c.id_venta,
      v.numero_venta,
      c.id_cliente,
      CONCAT_WS(' ', cl.nombres, cl.apellidos) AS cliente,
      cl.identificacion,
      c.monto_financiado,
      c.tasa_interes,
      c.numero_cuotas,
      c.monto_interes,
      c.monto_total,
      c.saldo_pendiente,
      c.frecuencia,
      c.fecha_inicio,
      c.estado,
      c.observacion,
      c.created_at,
      c.updated_at
    FROM creditos c
    INNER JOIN ventas v
      ON v.id_venta = c.id_venta
    INNER JOIN clientes cl
      ON cl.id_cliente = c.id_cliente
    ORDER BY c.id_credito DESC
  `);

  return rows;
}

// ============================================================
// OBTENER CRÉDITO POR ID
// ============================================================

async function obtenerPorId(idCredito) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id_credito,
      c.id_venta,
      v.numero_venta,
      v.tipo_venta,
      v.total AS total_venta,
      v.estado AS estado_venta,
      c.id_cliente,
      CONCAT_WS(' ', cl.nombres, cl.apellidos) AS cliente,
      cl.identificacion,
      c.monto_financiado,
      c.tasa_interes,
      c.numero_cuotas,
      c.monto_interes,
      c.monto_total,
      c.saldo_pendiente,
      c.frecuencia,
      c.fecha_inicio,
      c.estado,
      c.observacion,
      c.created_at,
      c.updated_at
    FROM creditos c
    INNER JOIN ventas v
      ON v.id_venta = c.id_venta
    INNER JOIN clientes cl
      ON cl.id_cliente = c.id_cliente
    WHERE c.id_credito = ?
    `,
    [idCredito]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER CRÉDITO PARA ACTUALIZAR
// ============================================================

async function obtenerCreditoParaActualizar(connection, idCredito) {
  const [rows] = await connection.query(
    `
    SELECT
      id_credito,
      id_venta,
      id_cliente,
      monto_financiado,
      tasa_interes,
      numero_cuotas,
      monto_interes,
      monto_total,
      saldo_pendiente,
      frecuencia,
      fecha_inicio,
      estado
    FROM creditos
    WHERE id_credito = ?
    FOR UPDATE
    `,
    [idCredito]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER VENTA PARA CREAR CRÉDITO
// ============================================================

async function obtenerVentaParaCredito(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      v.id_venta,
      v.id_cliente,
      v.id_sucursal,
      v.numero_venta,
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
// COMPROBAR SI LA VENTA YA TIENE CRÉDITO
// ============================================================

async function obtenerCreditoPorVenta(connection, idVenta) {
  const [rows] = await connection.query(
    `
    SELECT
      id_credito,
      estado
    FROM creditos
    WHERE id_venta = ?
    LIMIT 1
    FOR UPDATE
    `,
    [idVenta]
  );

  return rows[0] || null;
}

// ============================================================
// TOTAL PAGADO DE LA VENTA
// ============================================================

async function obtenerTotalPagadoVenta(connection, idVenta) {
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
// CREAR CRÉDITO
// ============================================================

async function crearCredito(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO creditos (
      id_venta,
      id_cliente,
      monto_financiado,
      tasa_interes,
      numero_cuotas,
      monto_interes,
      monto_total,
      saldo_pendiente,
      frecuencia,
      fecha_inicio,
      estado,
      observacion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?)
    `,
    [
      datos.id_venta,
      datos.id_cliente,
      datos.monto_financiado,
      datos.tasa_interes,
      datos.numero_cuotas,
      datos.monto_interes,
      datos.monto_total,
      datos.saldo_pendiente,
      datos.frecuencia,
      datos.fecha_inicio,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

// ============================================================
// CREAR CUOTA
// ============================================================

async function crearCuota(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO cuotas_credito (
      id_credito,
      numero_cuota,
      fecha_vencimiento,
      monto_cuota,
      monto_pagado,
      saldo_cuota,
      estado
    )
    VALUES (?, ?, ?, ?, 0, ?, 'PENDIENTE')
    `,
    [
      datos.id_credito,
      datos.numero_cuota,
      datos.fecha_vencimiento,
      datos.monto_cuota,
      datos.monto_cuota
    ]
  );

  return result.insertId;
}

// ============================================================
// OBTENER CUOTAS DEL CRÉDITO
// ============================================================

async function obtenerCuotasPorCredito(idCredito) {
  const [rows] = await pool.query(
    `
    SELECT
      id_cuota,
      id_credito,
      numero_cuota,
      fecha_vencimiento,
      monto_cuota,
      monto_pagado,
      saldo_cuota,
      estado,
      created_at,
      updated_at
    FROM cuotas_credito
    WHERE id_credito = ?
    ORDER BY numero_cuota
    `,
    [idCredito]
  );

  return rows;
}

// ============================================================
// OBTENER CUOTA PARA PAGO Y BLOQUEARLA
// ============================================================

async function obtenerCuotaParaPago(connection, idCuota) {
  const [rows] = await connection.query(
    `
    SELECT
      cc.id_cuota,
      cc.id_credito,
      cc.numero_cuota,
      cc.fecha_vencimiento,
      cc.monto_cuota,
      cc.monto_pagado,
      cc.saldo_cuota,
      cc.estado,
      c.id_venta,
      c.id_cliente,
      c.saldo_pendiente AS saldo_credito,
      c.estado AS estado_credito,
      v.numero_venta,
      v.id_sucursal,
      v.estado AS estado_venta
    FROM cuotas_credito cc
    INNER JOIN creditos c
      ON c.id_credito = cc.id_credito
    INNER JOIN ventas v
      ON v.id_venta = c.id_venta
    WHERE cc.id_cuota = ?
    FOR UPDATE
    `,
    [idCuota]
  );

  return rows[0] || null;
}

// ============================================================
// REGISTRAR RELACIÓN PAGO - CUOTA
// ============================================================

async function crearPagoCuota(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO pago_cuotas (
      id_cuota,
      id_pago,
      monto_aplicado
    )
    VALUES (?, ?, ?)
    `,
    [
      datos.id_cuota,
      datos.id_pago,
      datos.monto_aplicado
    ]
  );

  return result.insertId;
}

// ============================================================
// ACTUALIZAR CUOTA DESPUÉS DE UN PAGO
// ============================================================

async function actualizarCuotaPago(
  connection,
  idCuota,
  montoPagado,
  saldoCuota,
  estado
) {
  const [result] = await connection.query(
    `
    UPDATE cuotas_credito
    SET
      monto_pagado = ?,
      saldo_cuota = ?,
      estado = ?
    WHERE id_cuota = ?
    `,
    [
      montoPagado,
      saldoCuota,
      estado,
      idCuota
    ]
  );

  return result.affectedRows;
}

// ============================================================
// ACTUALIZAR SALDO Y ESTADO DEL CRÉDITO
// ============================================================

async function actualizarSaldoCredito(
  connection,
  idCredito,
  saldoPendiente,
  estado
) {
  const [result] = await connection.query(
    `
    UPDATE creditos
    SET
      saldo_pendiente = ?,
      estado = ?
    WHERE id_credito = ?
    `,
    [
      saldoPendiente,
      estado,
      idCredito
    ]
  );

  return result.affectedRows;
}

// ============================================================
// TOTAL DE PAGOS APLICADOS AL CRÉDITO
// ============================================================

async function obtenerTotalPagadoCredito(connection, idCredito) {
  const [rows] = await connection.query(
    `
    SELECT
      COALESCE(SUM(pc.monto_aplicado), 0) AS total_pagado
    FROM pago_cuotas pc
    INNER JOIN cuotas_credito cc
      ON cc.id_cuota = pc.id_cuota
    INNER JOIN pagos p
      ON p.id_pago = pc.id_pago
    WHERE cc.id_credito = ?
      AND p.estado = 'APLICADO'
    `,
    [idCredito]
  );

  return Number(rows[0].total_pagado || 0);
}

// ============================================================
// COMPROBAR SI UN PAGO PERTENECE A UNA CUOTA DE CRÉDITO
// Se utilizará para proteger la anulación normal de pagos.
// ============================================================

async function obtenerAplicacionPorPago(connection, idPago) {
  const [rows] = await connection.query(
    `
    SELECT
      pc.id_pago_cuota,
      pc.id_cuota,
      pc.id_pago,
      pc.monto_aplicado,
      cc.id_credito,
      cc.numero_cuota,
      cc.monto_pagado,
      cc.saldo_cuota,
      cc.estado AS estado_cuota,
      c.saldo_pendiente AS saldo_credito,
      c.estado AS estado_credito
    FROM pago_cuotas pc
    INNER JOIN cuotas_credito cc
      ON cc.id_cuota = pc.id_cuota
    INNER JOIN creditos c
      ON c.id_credito = cc.id_credito
    WHERE pc.id_pago = ?
    LIMIT 1
    `,
    [idPago]
  );

  return rows[0] || null;
}

// ============================================================
// ANULAR CUOTAS PENDIENTES
// ============================================================

async function anularCuotas(connection, idCredito) {
  const [result] = await connection.query(
    `
    UPDATE cuotas_credito
    SET estado = 'ANULADA'
    WHERE id_credito = ?
      AND estado IN ('PENDIENTE', 'VENCIDA')
    `,
    [idCredito]
  );

  return result.affectedRows;
}

// ============================================================
// ANULAR CRÉDITO
// ============================================================

async function anularCredito(connection, idCredito) {
  const [result] = await connection.query(
    `
    UPDATE creditos
    SET estado = 'ANULADO'
    WHERE id_credito = ?
      AND estado = 'ACTIVO'
    `,
    [idCredito]
  );

  return result.affectedRows;
}

module.exports = {
  pool,
  obtenerTodos,
  obtenerPorId,
  obtenerCreditoParaActualizar,
  obtenerVentaParaCredito,
  obtenerCreditoPorVenta,
  obtenerTotalPagadoVenta,
  crearCredito,
  crearCuota,
  obtenerCuotasPorCredito,
  obtenerCuotaParaPago,
  crearPagoCuota,
  actualizarCuotaPago,
  actualizarSaldoCredito,
  obtenerTotalPagadoCredito,
  obtenerAplicacionPorPago,
  anularCuotas,
  anularCredito
};
