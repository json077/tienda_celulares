require('dotenv').config();

const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function createRootUser() {
  let connection;

  try {
    connection = await pool.getConnection();

    const username = 'root';
    const email = 'root@tienda.local';
    const password = 'Root#2026';

    // Verificar si el usuario ya existe
    const [existingUsers] = await connection.query(
      `SELECT id_usuario
       FROM usuarios
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [username, email]
    );

    if (existingUsers.length > 0) {
      console.log('El usuario ROOT ya existe.');
      return;
    }

    // Buscar el rol ROOT
    const [roles] = await connection.query(
      `SELECT id_rol
       FROM roles
       WHERE nombre = 'ROOT'
       LIMIT 1`
    );

    if (roles.length === 0) {
      throw new Error('No existe el rol ROOT en la base de datos.');
    }

    // Buscar la sucursal inicial
    const [sucursales] = await connection.query(
      `SELECT id_sucursal
       FROM sucursales
       WHERE codigo = 'SUC-001'
       LIMIT 1`
    );

    if (sucursales.length === 0) {
      throw new Error('No existe la sucursal SUC-001.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO usuarios
       (username, email, nombres, apellidos, password_hash, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        username,
        email,
        'Usuario',
        'Root',
        passwordHash,
        1
      ]
    );

    const idUsuario = result.insertId;

    await connection.query(
      `INSERT INTO usuario_roles (id_usuario, id_rol)
       VALUES (?, ?)`,
      [idUsuario, roles[0].id_rol]
    );

    await connection.query(
      `INSERT INTO usuario_sucursales (id_usuario, id_sucursal)
       VALUES (?, ?)`,
      [idUsuario, sucursales[0].id_sucursal]
    );

    await connection.commit();

    console.log('=================================');
    console.log('Usuario ROOT creado correctamente');
    console.log('=================================');
    console.log(`Usuario: ${username}`);
    console.log(`Correo: ${email}`);
    console.log('Contraseña temporal configurada.');
    console.log('=================================');

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error('Error al crear usuario ROOT:');
    console.error(error.message);
  } finally {
    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

createRootUser();