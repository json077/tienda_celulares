const { pool } = require('../config/database');

async function insertar(datos) {
  const [result] = await pool.query(
    `INSERT INTO auditoria (id_usuario, id_sucursal, modulo, accion, entidad,
       id_entidad, datos_anteriores, datos_nuevos, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.id_usuario, datos.id_sucursal, datos.modulo, datos.accion, datos.entidad,
      datos.id_entidad, datos.datos_anteriores, datos.datos_nuevos, datos.ip]
  );
  return result.insertId;
}

function construirFiltros(filtros) {
  const condiciones = [];
  const valores = [];
  // Nombres SQL controlados exclusivamente por el servidor.
  for (const campo of ['id_usuario', 'id_sucursal', 'modulo', 'accion', 'entidad', 'id_entidad']) {
    if (filtros[campo] !== undefined) {
      condiciones.push(`a.${campo} = ?`);
      valores.push(filtros[campo]);
    }
  }
  if (filtros.fecha_desde) {
    condiciones.push('a.fecha >= ?');
    valores.push(filtros.fecha_desde);
  }
  if (filtros.fecha_hasta) {
    condiciones.push('a.fecha < DATE_ADD(?, INTERVAL 1 DAY)');
    valores.push(filtros.fecha_hasta);
  }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', valores };
}

async function listar(filtros, limite, desplazamiento) {
  const { where, valores } = construirFiltros(filtros);
  const [rows] = await pool.query(
    `SELECT a.id_auditoria, a.id_usuario, u.username AS usuario,
       a.id_sucursal, s.nombre AS sucursal, a.modulo, a.accion, a.entidad,
       a.id_entidad, a.ip, a.fecha
     FROM auditoria a
     LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
     LEFT JOIN sucursales s ON s.id_sucursal = a.id_sucursal
     ${where} ORDER BY a.fecha DESC, a.id_auditoria DESC LIMIT ? OFFSET ?`,
    [...valores, limite, desplazamiento]
  );
  const [conteo] = await pool.query(
    `SELECT COUNT(*) AS total FROM auditoria a ${where}`, valores
  );
  return { registros: rows, total: Number(conteo[0].total) };
}

async function obtenerPorId(id) {
  const [rows] = await pool.query(
    `SELECT a.*, u.username AS usuario, s.nombre AS sucursal
     FROM auditoria a
     LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
     LEFT JOIN sucursales s ON s.id_sucursal = a.id_sucursal
     WHERE a.id_auditoria = ? LIMIT 1`, [id]
  );
  return rows[0] || null;
}

async function obtenerFiltros() {
  const [usuarios] = await pool.query(
    `SELECT u.id_usuario, u.username FROM usuarios u
     WHERE EXISTS (SELECT 1 FROM auditoria a WHERE a.id_usuario = u.id_usuario)
     ORDER BY u.username`
  );
  const [sucursales] = await pool.query(
    `SELECT s.id_sucursal, s.nombre FROM sucursales s
     WHERE EXISTS (SELECT 1 FROM auditoria a WHERE a.id_sucursal = s.id_sucursal)
     ORDER BY s.nombre`
  );
  return { usuarios, sucursales };
}

module.exports = { insertar, listar, obtenerPorId, obtenerFiltros };
