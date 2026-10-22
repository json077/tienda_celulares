const { pool } = require('../config/database');

async function obtenerTodos() {
  const [rows] = await pool.query(`
    SELECT
      id_proveedor,
      tipo_identificacion,
      identificacion,
      nombre,
      telefono,
      email,
      direccion,
      activo,
      created_at,
      updated_at
    FROM proveedores
    ORDER BY nombre ASC
  `);

  return rows;
}

async function obtenerPorId(idProveedor) {
  const [rows] = await pool.query(
    `
    SELECT
      id_proveedor,
      tipo_identificacion,
      identificacion,
      nombre,
      telefono,
      email,
      direccion,
      activo,
      created_at,
      updated_at
    FROM proveedores
    WHERE id_proveedor = ?
    LIMIT 1
    `,
    [idProveedor]
  );

  return rows[0] || null;
}

async function obtenerPorIdentificacion(identificacion) {
  const [rows] = await pool.query(
    `
    SELECT
      id_proveedor,
      tipo_identificacion,
      identificacion,
      nombre,
      telefono,
      email,
      direccion,
      activo
    FROM proveedores
    WHERE identificacion = ?
    LIMIT 1
    `,
    [identificacion]
  );

  return rows[0] || null;
}

async function crear(datos) {
  const [result] = await pool.query(
    `
    INSERT INTO proveedores (
      tipo_identificacion,
      identificacion,
      nombre,
      telefono,
      email,
      direccion,
      activo
    )
    VALUES (?, ?, ?, ?, ?, ?, 1)
    `,
    [
      datos.tipo_identificacion || null,
      datos.identificacion || null,
      datos.nombre,
      datos.telefono || null,
      datos.email || null,
      datos.direccion || null
    ]
  );

  return result.insertId;
}

async function actualizar(idProveedor, datos) {
  const [result] = await pool.query(
    `
    UPDATE proveedores
    SET
      tipo_identificacion = ?,
      identificacion = ?,
      nombre = ?,
      telefono = ?,
      email = ?,
      direccion = ?,
      activo = ?
    WHERE id_proveedor = ?
    `,
    [
      datos.tipo_identificacion || null,
      datos.identificacion || null,
      datos.nombre,
      datos.telefono || null,
      datos.email || null,
      datos.direccion || null,
      datos.activo ? 1 : 0,
      idProveedor
    ]
  );

  return result.affectedRows;
}

async function desactivar(idProveedor) {
  const [result] = await pool.query(
    `
    UPDATE proveedores
    SET activo = 0
    WHERE id_proveedor = ?
    `,
    [idProveedor]
  );

  return result.affectedRows;
}

module.exports = {
  obtenerTodos,
  obtenerPorId,
  obtenerPorIdentificacion,
  crear,
  actualizar,
  desactivar
};