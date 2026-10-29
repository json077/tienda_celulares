const jwt = require('jsonwebtoken');
const repository = require('../repositories/authRepository');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Token de acceso requerido' });
  }
  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    if (!decoded || !/^[1-9]\d*$/.test(String(decoded.id_usuario))) {
      throw new Error('Identidad inválida');
    }
  } catch (_) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
  try {
    const usuario = await repository.obtenerSesion(decoded.id_usuario);
    if (!usuario) {
      return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ ok: false, message: 'Usuario inactivo' });
    }
    // Nunca copiar claims del JWT ni credenciales a la sesión.
    const { id_usuario, username, email, nombres, apellidos, roles, permisos } = usuario;
    req.usuario = { id_usuario, username, email, nombres, apellidos, roles, permisos };
  } catch (_) {
    console.error('Error consultando sesión vigente');
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
  return next();
}

module.exports = { verificarToken };
