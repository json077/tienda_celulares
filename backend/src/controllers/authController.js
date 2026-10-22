const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario y contraseña son obligatorios'
      });
    }

    const [users] = await pool.query(
      `SELECT id_usuario, username, email, nombres, apellidos,
              password_hash, activo
       FROM usuarios
       WHERE username = ?
       LIMIT 1`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales incorrectas'
      });
    }

    const user = users[0];

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

    const [roles] = await pool.query(
      `SELECT r.id_rol, r.nombre
       FROM roles r
       INNER JOIN usuario_roles ur ON ur.id_rol = r.id_rol
       WHERE ur.id_usuario = ?`,
      [user.id_usuario]
    );

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        username: user.username,
        roles: roles.map(role => role.nombre)
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await pool.query(
      `UPDATE usuarios
       SET ultimo_acceso = NOW()
       WHERE id_usuario = ?`,
      [user.id_usuario]
    );

    return res.status(200).json({
      ok: true,
      message: 'Inicio de sesión correcto',
      token,
      usuario: {
        id_usuario: user.id_usuario,
        username: user.username,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        roles: roles.map(role => role.nombre)
      }
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