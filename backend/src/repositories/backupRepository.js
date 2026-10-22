const { pool } = require('../config/database');

async function obtenerTodas() {
  const [rows] = await pool.query('SELECT * FROM respaldos ORDER BY fecha_creacion DESC, id_respaldo DESC');
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await pool.query('SELECT * FROM respaldos WHERE id_respaldo = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function crear(datos) {
  const [result] = await pool.query(
    `INSERT INTO respaldos (id_usuario, nombre_archivo, ruta_archivo, tamano_bytes)
     VALUES (?, ?, ?, ?)`,
    [datos.id_usuario, datos.nombre_archivo, datos.ruta_archivo, datos.tamano_bytes]
  );
  return obtenerPorId(result.insertId);
}

// El dump puede haber eliminado el registro que identificaba su propio archivo.
// No reutilizar un ID que ahora pueda pertenecer a otro respaldo.
async function registrarRestauracion(datos) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT id_respaldo FROM respaldos WHERE nombre_archivo = ? AND ruta_archivo = ? LIMIT 1 FOR UPDATE',
      [datos.nombre_archivo, datos.ruta_archivo]
    );
    let id = rows[0]?.id_respaldo;
    if (id) {
      await connection.query(
        "UPDATE respaldos SET estado = 'RESTAURADO', fecha_restauracion = CURRENT_TIMESTAMP WHERE id_respaldo = ?", [id]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO respaldos
         (id_usuario, nombre_archivo, ruta_archivo, tamano_bytes, estado, fecha_creacion, fecha_restauracion, observacion)
         VALUES (?, ?, ?, ?, 'RESTAURADO', ?, CURRENT_TIMESTAMP, ?)`,
        [datos.id_usuario, datos.nombre_archivo, datos.ruta_archivo, datos.tamano_bytes,
          datos.fecha_creacion, 'Registro recuperado despues de restaurar el respaldo']
      );
      id = result.insertId;
    }
    const [result] = await connection.query('SELECT * FROM respaldos WHERE id_respaldo = ?', [id]);
    await connection.commit();
    return result[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { obtenerTodas, obtenerPorId, crear, registrarRestauracion };
