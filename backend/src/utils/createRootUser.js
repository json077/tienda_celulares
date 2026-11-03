// Explicit provisioning for a NEW database only. Importing this module performs no I/O.
function readSettings(env, args) {
  const index = args.indexOf('--database');
  const database = index >= 0 ? args[index + 1] : undefined;
  if (!args.includes('--provision-new') || !database || !/^[A-Za-z0-9_]+$/.test(database) ||
      database.toLowerCase() === 'tienda_celulares' || database !== env.DB_NAME) {
    throw new Error('Indica --provision-new --database BASE_NUEVA coincidente con DB_NAME. La base tienda_celulares está protegida.');
  }
  const { ROOT_USERNAME: username, ROOT_EMAIL: email, ROOT_PASSWORD: password } = env;
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,60}$/.test(username) ||
      typeof email !== 'string' || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Configura ROOT_USERNAME y ROOT_EMAIL válidos.');
  }
  if (typeof password !== 'string' || [...password].length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72 || password.includes('\0')) {
    throw new Error('ROOT_PASSWORD requiere al menos 12 caracteres, hasta 72 bytes y ningún carácter nulo.');
  }
  const branch = env.ROOT_BRANCH_CODE || 'SUC-001';
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(branch)) throw new Error('ROOT_BRANCH_CODE inválido.');
  return { database, username, email, password, branch };
}

async function provisionRoot(pool, settings, hashPassword) {
  // Defend even when invoked programmatically, before opening a connection.
  settings = readSettings({ DB_NAME: settings.database, ROOT_USERNAME: settings.username,
    ROOT_EMAIL: settings.email, ROOT_PASSWORD: settings.password, ROOT_BRANCH_CODE: settings.branch },
  ['--provision-new', '--database', settings.database]);
  const connection = await pool.getConnection();
  let transaction = false;
  try {
    const [[target]] = await connection.query('SELECT DATABASE() AS database_name');
    if (target.database_name !== settings.database) throw new Error('La conexión no apunta a la base nueva solicitada.');
    await connection.beginTransaction();
    transaction = true;
    const [[users]] = await connection.query('SELECT COUNT(*) AS total FROM usuarios');
    if (Number(users.total) !== 0) throw new Error('La base ya contiene usuarios. No se crean, actualizan ni restablecen cuentas existentes.');
    const [roles] = await connection.query("SELECT id_rol FROM roles WHERE nombre='ROOT' AND activo=1");
    const [branches] = await connection.query('SELECT id_sucursal FROM sucursales WHERE codigo=? AND activo=1', [settings.branch]);
    if (roles.length !== 1 || branches.length !== 1) throw new Error('Falta el rol ROOT activo o la sucursal inicial activa. Ejecuta primero los catálogos en la base nueva.');
    const passwordHash = await hashPassword(settings.password, 12);
    const [result] = await connection.query(
      `INSERT INTO usuarios (username, email, nombres, apellidos, password_hash, activo)
       VALUES (?, ?, 'Administrador', 'Inicial', ?, 1)`,
      [settings.username, settings.email, passwordHash]);
    await connection.query('INSERT INTO usuario_roles (id_usuario, id_rol) VALUES (?, ?)', [result.insertId, roles[0].id_rol]);
    await connection.query('INSERT INTO usuario_sucursales (id_usuario, id_sucursal) VALUES (?, ?)', [result.insertId, branches[0].id_sucursal]);
    await connection.commit();
    transaction = false;
  } catch (error) {
    if (transaction) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  require('dotenv').config({ quiet: true });
  let pool;
  try {
    // Validate before loading the pool; the default .env cannot provision the active DB.
    const settings = readSettings(process.env, process.argv.slice(2));
    pool = require('../config/database').pool;
    await provisionRoot(pool, settings, require('bcrypt').hash);
    console.log('Administrador inicial creado. No se muestran credenciales.');
  } catch (error) {
    // Driver errors may contain SQL values or password hashes: never print them.
    console.error(error.code ? 'No se pudo aprovisionar el administrador. Revisa la configuración y la base nueva.' : error.message);
    process.exitCode = 1;
  } finally {
    delete process.env.ROOT_PASSWORD;
    if (pool) await pool.end();
  }
}

if (require.main === module) main();
module.exports = { readSettings, provisionRoot };
