const { pool } = require('../config/database');

async function buscarCredenciales(username) {
  const [filas] = await pool.query(
    'SELECT id_usuario, password_hash, activo FROM usuarios WHERE username = ? LIMIT 1', [username]);
  return filas[0] || null;
}

// Una consulta obtiene el estado vigente para esta solicitud, incluido ROOT.
async function obtenerSesion(idUsuario) {
  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.username, u.email, u.nombres, u.apellidos, u.activo,
            r.nombre AS rol, p.codigo AS permiso
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.id_usuario = u.id_usuario
     LEFT JOIN roles r ON r.id_rol = ur.id_rol AND r.activo = 1
     LEFT JOIN rol_permisos rp ON rp.id_rol = r.id_rol AND r.nombre <> 'ROOT'
     LEFT JOIN permisos p ON (p.id_permiso = rp.id_permiso OR r.nombre = 'ROOT')
     WHERE u.id_usuario = ?`, [idUsuario]);
  if (!filas.length) return null;
  const { id_usuario, username, email, nombres, apellidos, activo } = filas[0];
  return {
    id_usuario, username, email, nombres, apellidos, activo,
    roles: [...new Set(filas.map(f => f.rol).filter(Boolean))],
    permisos: [...new Set(filas.map(f => f.permiso).filter(Boolean))]
  };
}

async function registrarAcceso(idUsuario) {
  await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?', [idUsuario]);
}

module.exports = { buscarCredenciales, obtenerSesion, registrarAcceso };
