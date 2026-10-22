const { pool } = require('../config/database');

// ============================================================
// OBTENER MONEDA POR ID
// ============================================================

async function obtenerMonedaPorId(idMoneda) {
  const [rows] = await pool.query(
    `
      SELECT
        id_moneda,
        codigo,
        nombre,
        simbolo,
        activo
      FROM monedas
      WHERE id_moneda = ?
      LIMIT 1
    `,
    [idMoneda]
  );

  return rows[0] || null;
}

// ============================================================
// OBTENER ÚLTIMO TIPO DE CAMBIO DE UNA MONEDA
// ============================================================

async function obtenerUltimoPorMoneda(idMoneda) {
  const [rows] = await pool.query(
    `
      SELECT
        tc.id_tipo_cambio,
        tc.id_moneda,
        m.codigo AS moneda,
        m.nombre AS nombre_moneda,
        m.simbolo,
        tc.tasa,
        tc.fecha,
        tc.activo
      FROM tipos_cambio tc
      INNER JOIN monedas m
        ON m.id_moneda = tc.id_moneda
      WHERE tc.id_moneda = ?
        AND tc.activo = 1
      ORDER BY tc.fecha DESC, tc.id_tipo_cambio DESC
      LIMIT 1
    `,
    [idMoneda]
  );

  return rows[0] || null;
}

// ============================================================
// REGISTRAR TIPO DE CAMBIO
// ============================================================

async function crear(datos) {
  const [resultado] = await pool.query(
    `
      INSERT INTO tipos_cambio (
        id_moneda,
        tasa,
        fecha,
        activo
      )
      VALUES (?, ?, NOW(), 1)
    `,
    [
      datos.id_moneda,
      datos.tasa
    ]
  );

  return resultado.insertId;
}

// ============================================================
// OBTENER TIPO DE CAMBIO POR ID
// ============================================================

async function obtenerPorId(idTipoCambio) {
  const [rows] = await pool.query(
    `
      SELECT
        tc.id_tipo_cambio,
        tc.id_moneda,
        m.codigo AS moneda,
        m.nombre AS nombre_moneda,
        m.simbolo,
        tc.tasa,
        tc.fecha,
        tc.activo
      FROM tipos_cambio tc
      INNER JOIN monedas m
        ON m.id_moneda = tc.id_moneda
      WHERE tc.id_tipo_cambio = ?
      LIMIT 1
    `,
    [idTipoCambio]
  );

  return rows[0] || null;
}

module.exports = {
  obtenerMonedaPorId,
  obtenerUltimoPorMoneda,
  crear,
  obtenerPorId
};