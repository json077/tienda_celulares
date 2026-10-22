const { pool } = require('../config/database');

async function obtenerTodas() {
  const [rows] = await pool.query(`
    SELECT
      id_categoria,
      nombre,
      descripcion,
      activo
    FROM categorias
    ORDER BY nombre ASC
  `);

  return rows;
}

async function obtenerPorId(idCategoria) {
  const [rows] = await pool.query(
    `SELECT
       id_categoria,
       nombre,
       descripcion,
       activo
     FROM categorias
     WHERE id_categoria = ?
     LIMIT 1`,
    [idCategoria]
  );

  return rows[0] || null;
}

async function obtenerPorNombre(nombre) {
  const [rows] = await pool.query(
    `SELECT
       id_categoria,
       nombre,
       descripcion,
       activo
     FROM categorias
     WHERE nombre = ?
     LIMIT 1`,
    [nombre]
  );

  return rows[0] || null;
}

async function crear({ nombre, descripcion }) {
  const [result] = await pool.query(
    `INSERT INTO categorias
       (nombre, descripcion, activo)
     VALUES (?, ?, 1)`,
    [nombre, descripcion || null]
  );

  return result.insertId;
}

async function actualizar(idCategoria, { nombre, descripcion, activo }) {
  const [result] = await pool.query(
    `UPDATE categorias
     SET nombre = ?,
         descripcion = ?,
         activo = ?
     WHERE id_categoria = ?`,
    [
      nombre,
      descripcion || null,
      activo,
      idCategoria
    ]
  );

  return result.affectedRows;
}

async function desactivar(idCategoria) {
  const [result] = await pool.query(
    `UPDATE categorias
     SET activo = 0
     WHERE id_categoria = ?`,
    [idCategoria]
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