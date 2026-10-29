const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repository = require('../repositories/authRepository');

async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario y contraseña son obligatorios'
      });
    }

    const user = await repository.buscarCredenciales(username);

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        ok: false,
        message: 'Usuario inactivo'
      });
    }

    const passwordCorrecta = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    const sesion = await repository.obtenerSesion(user.id_usuario);
    if (!sesion || !sesion.activo) {
      return res.status(403).json({ ok: false, message: 'Usuario inactivo' });
    }
    const { id_usuario, username: nombreUsuario, email, nombres, apellidos, roles, permisos } = sesion;
    const usuario = { id_usuario, username: nombreUsuario, email, nombres, apellidos, roles, permisos };

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        username: usuario.username,
        roles: usuario.roles
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await repository.registrarAcceso(user.id_usuario);

    return res.status(200).json({
      ok: true,
      message: 'Inicio de sesión correcto',
      token,
      usuario
    });

  } catch (error) {
    console.error('Error en login:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
}

module.exports = { login };