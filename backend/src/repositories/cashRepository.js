const { pool } = require('../config/database');

// ============================================================
// OBTENER CAJAS
// ============================================================

async function obtenerCajas() {
  const [rows] = await pool.query(`
    SELECT
      c.id_caja,
      c.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,
      c.codigo,
      c.nombre,
      c.activo,
      c.created_at,
      c.updated_at
    FROM cajas c
    INNER JOIN sucursales s
      ON s.id_sucursal = c.id_sucursal
    ORDER BY c.id_caja
  `);

  return rows;
}

// ============================================================
// OBTENER CAJA POR ID
// ============================================================

async function obtenerCajaPorId(connection, idCaja) {
  const [rows] = await connection.query(
    `
    SELECT
      c.id_caja,
      c.id_sucursal,
      c.codigo,
      c.nombre,
      c.activo
    FROM cajas c
    WHERE c.id_caja = ?
    `,
    [idCaja]
  );

  return rows[0] || null;
}

// ============================================================
// BUSCAR SESIÓN ABIERTA DE UNA CAJA
// ============================================================

async function obtenerSesionAbiertaPorCaja(connection, idCaja) {
  const [rows] = await connection.query(
    `
    SELECT
      sc.*
    FROM sesiones_caja sc
    WHERE sc.id_caja = ?
      AND sc.estado = 'ABIERTA'
    ORDER BY sc.id_sesion_caja DESC
    LIMIT 1
    FOR UPDATE
    `,
    [idCaja]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER SESIÓN POR ID CON BLOQUEO
// ============================================================

async function obtenerSesionPorIdParaActualizar(
  connection,
  idSesionCaja
) {
  const [rows] = await connection.query(
    `
    SELECT
      sc.*,
      c.id_sucursal,
      c.codigo AS codigo_caja,
      c.nombre AS caja
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
// CREAR SESIÓN DE CAJA
// ============================================================

async function crearSesion(connection, datos) {
  const [result] = await connection.query(
    `
    INSERT INTO sesiones_caja (
      id_caja,
      id_usuario_apertura,
      monto_apertura,
      estado,
      observacion_apertura
    )
    VALUES (?, ?, ?, 'ABIERTA', ?)
    `,
    [
      datos.id_caja,
      datos.id_usuario,
      datos.monto_apertura,
      datos.observacion || null
    ]
  );

  return result.insertId;
}

// ============================================================
// REGISTRAR MOVIMIENTO DE CAJA
// ============================================================

async function registrarMovimiento(connection, datos) {
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
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      datos.id_sesion_caja,
      datos.id_usuario,
      datos.tipo,
      datos.monto,
      datos.tipo_referencia || null,
      datos.id_referencia || null,
      datos.concepto
    ]
  );

  return result.insertId;
}

// ============================================================
// CALCULAR MONTO DEL SISTEMA PARA EL CIERRE
// ============================================================

async function calcularMontoSistema(connection, idSesionCaja) {
  const [rows] = await connection.query(
    `
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN tipo IN ('APERTURA', 'VENTA', 'INGRESO')
              THEN monto
            WHEN tipo IN ('EGRESO', 'ANULACION')
              THEN -monto
            ELSE 0
          END
        ),
        0
      ) AS monto_sistema
    FROM movimientos_caja
    WHERE id_sesion_caja = ?
    `,
    [idSesionCaja]
  );

  return Number(rows[0].monto_sistema);
}

// ============================================================
// CERRAR SESIÓN DE CAJA
// ============================================================

async function cerrarSesion(connection, datos) {
  await connection.query(
    `
    UPDATE sesiones_caja
    SET
      id_usuario_cierre = ?,
      fecha_cierre = NOW(),
      monto_cierre_sistema = ?,
      monto_cierre_real = ?,
      diferencia = ?,
      estado = 'CERRADA',
      observacion_cierre = ?
    WHERE id_sesion_caja = ?
      AND estado = 'ABIERTA'
    `,
    [
      datos.id_usuario,
      datos.monto_cierre_sistema,
      datos.monto_cierre_real,
      datos.diferencia,
      datos.observacion || null,
      datos.id_sesion_caja
    ]
  );
}

// ============================================================
// OBTENER SESIÓN POR ID
// ============================================================

async function obtenerSesionPorId(idSesionCaja) {
  const [rows] = await pool.query(
    `
    SELECT
      sc.id_sesion_caja,
      sc.id_caja,
      c.codigo AS codigo_caja,
      c.nombre AS caja,
      c.id_sucursal,
      s.codigo AS codigo_sucursal,
      s.nombre AS sucursal,

      sc.id_usuario_apertura,
      ua.username AS usuario_apertura,

      sc.id_usuario_cierre,
      uc.username AS usuario_cierre,

      sc.fecha_apertura,
      sc.fecha_cierre,
      sc.monto_apertura,
      sc.monto_cierre_sistema,
      sc.monto_cierre_real,
      sc.diferencia,
      sc.estado,
      sc.observacion_apertura,
      sc.observacion_cierre

    FROM sesiones_caja sc

    INNER JOIN cajas c
      ON c.id_caja = sc.id_caja

    INNER JOIN sucursales s
      ON s.id_sucursal = c.id_sucursal

    INNER JOIN usuarios ua
      ON ua.id_usuario = sc.id_usuario_apertura

    LEFT JOIN usuarios uc
      ON uc.id_usuario = sc.id_usuario_cierre

    WHERE sc.id_sesion_caja = ?
    `,
    [idSesionCaja]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER MOVIMIENTO DE CAJA POR ID
// ============================================================

async function obtenerMovimientoPorId(idMovimientoCaja) {
  const [rows] = await pool.query(
    `
    SELECT
      mc.id_movimiento_caja,
      mc.id_sesion_caja,
      mc.id_usuario,
      u.username AS usuario,
      mc.tipo,
      mc.monto,
      mc.tipo_referencia,
      mc.id_referencia,
      mc.concepto,
      mc.fecha
    FROM movimientos_caja mc
    INNER JOIN usuarios u
      ON u.id_usuario = mc.id_usuario
    WHERE mc.id_movimiento_caja = ?
    `,
    [idMovimientoCaja]
  );

  return rows[0] || null;
}

module.exports = {
  pool,
  obtenerCajas,
  obtenerCajaPorId,
  obtenerSesionAbiertaPorCaja,
  obtenerSesionPorIdParaActualizar,
  crearSesion,
  registrarMovimiento,
  calcularMontoSistema,
  cerrarSesion,
  obtenerSesionPorId,
  obtenerMovimientoPorId
};