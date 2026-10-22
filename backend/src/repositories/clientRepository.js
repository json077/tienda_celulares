const { pool } = require('../config/database');

async function obtenerTodos() {
  const [rows] = await pool.query(`
    SELECT
      id_cliente,
      tipo_identificacion,
      identificacion,
      nombres,
      apellidos,
      telefono,
      email,
      direccion,
      activo,
      created_at,
      updated_at
    FROM clientes
    ORDER BY id_cliente DESC
  `);

  return rows;
}

async function obtenerPorId(idCliente) {
  const [rows] = await pool.query(
    `
    SELECT
      id_cliente,
      tipo_identificacion,
      identificacion,
      nombres,
      apellidos,
      telefono,
      email,
      direccion,
      activo,
      created_at,
      updated_at
    FROM clientes
    WHERE id_cliente = ?
    LIMIT 1
    `,
    [idCliente]
  );

  return rows[0] || null;
}

async function obtenerPorIdentificacion(identificacion) {
  const [rows] = await pool.query(
    `
    SELECT
      id_cliente,
      tipo_identificacion,
      identificacion,
      nombres,
      apellidos,
      telefono,
      email,
      direccion,
      activo,
      created_at,
      updated_at
    FROM clientes
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
    INSERT INTO clientes (
      tipo_identificacion,
      identificacion,
      nombres,
      apellidos,
      telefono,
      email,
      direccion,
      activo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      datos.tipo_identificacion,
      datos.identificacion,
      datos.nombres,
      datos.apellidos || null,
      datos.telefono || null,
      datos.email || null,
      datos.direccion || null,
      datos.activo ?? 1
    ]
  );

  return result.insertId;
}

async function actualizar(idCliente, datos) {
  const [result] = await pool.query(
    `
    UPDATE clientes
    SET
      tipo_identificacion = ?,
      identificacion = ?,
      nombres = ?,
      apellidos = ?,
      telefono = ?,
      email = ?,
      direccion = ?,
      activo = ?
    WHERE id_cliente = ?
    `,
    [
      datos.tipo_identificacion,
      datos.identificacion,
      datos.nombres,
      datos.apellidos || null,
      datos.telefono || null,
      datos.email || null,
      datos.direccion || null,
      datos.activo,
      idCliente
    ]
  );

  return result.affectedRows;
}

async function desactivar(idCliente) {
  const [result] = await pool.query(
    `
    UPDATE clientes
    SET activo = 0
    WHERE id_cliente = ?
      AND activo = 1
    `,
    [idCliente]
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