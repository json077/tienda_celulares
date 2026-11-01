const { pool } = require('../config/database');

async function sucursales(id) {
  const [rows] = await pool.query(
    `SELECT s.id_sucursal, s.nombre FROM usuario_sucursales us
     INNER JOIN sucursales s ON s.id_sucursal = us.id_sucursal
     WHERE us.id_usuario = ? ORDER BY s.nombre`, [id]);
  return rows;
}
async function credencial(id) {
  const [rows] = await pool.query(
    'SELECT password_hash FROM usuarios WHERE id_usuario = ? AND activo = 1', [id]);
  return rows[0] || null;
}
async function cambiarPassword(id, anterior, siguiente) {
  const [result] = await pool.query(
    'UPDATE usuarios SET password_hash = ? WHERE id_usuario = ? AND password_hash = ? AND activo = 1',
    [siguiente, id, anterior]);
  return result.affectedRows === 1;
}
module.exports = { sucursales, credencial, cambiarPassword };
