const { pool } = require('../config/database');

async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT
      id_marca,
      nombre,
      descripcion,
      activo
    FROM marcas
    ORDER BY nombre ASC
  `);

  return rows;
}

async function obtenerPorId(idMarca) {
  const [rows] = await pool.query(
    `SELECT
       id_marca,
       nombre,
       descripcion,
       activo
     FROM marcas
     WHERE id_marca = ?
     LIMIT 1`,
    [idMarca]
  );

  return rows[0] || null;
}

async function obtenerPorNombre(nombre) {
  const [rows] = await pool.query(
    `SELECT
       id_marca,
       nombre,
       descripcion,
       activo
     FROM marcas
     WHERE nombre = ?
     LIMIT 1`,
    [nombre]
  );

  return rows[0] || null;
}

async function crear({ nombre, descripcion }) {
  const [result] = await pool.query(
    `INSERT INTO marcas (nombre, descripcion, activo)
     VALUES (?, ?, 1)`,
    [nombre, descripcion || null]
  );

  return result.insertId;
}

async function actualizar(idMarca, { nombre, descripcion, activo }) {
  const [result] = await pool.query(
    `UPDATE marcas
     SET nombre = ?,
         descripcion = ?,
         activo = ?
     WHERE id_marca = ?`,
    [nombre, descripcion || null, activo, idMarca]
  );

  return result.affectedRows;
}

async function desactivar(idMarca) {
  const [result] = await pool.query(
    `UPDATE marcas
     SET activo = 0
     WHERE id_marca = ?`,
    [idMarca]
  );

  return result.affectedRows;
}

module.exports = {
  obtenerTodas,
  obtenerPorId,
  obtenerPorNombre,
  crear,
  actualizar,
  desactivar
};