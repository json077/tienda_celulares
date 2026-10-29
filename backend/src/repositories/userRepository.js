const { pool } = require('../config/database');

const campos = 'id_usuario, username, email, nombres, apellidos, activo, ultimo_acceso, created_at, updated_at';

async function detalle(id, db = pool) {
  const [usuarios] = await db.query(`SELECT ${campos} FROM usuarios WHERE id_usuario = ?`, [id]);
  if (!usuarios.length) return null;
  const [roles] = await db.query(
    `SELECT r.id_rol, r.nombre, r.activo FROM roles r
     INNER JOIN usuario_roles ur ON ur.id_rol = r.id_rol
     WHERE ur.id_usuario = ? ORDER BY r.id_rol`, [id]);
  return { ...usuarios[0], roles };
}

async function listar({ buscar, activo, id_rol, pagina, limite }) {
  const condiciones = [], valores = [];
  if (buscar) {
    condiciones.push('(username LIKE ? OR email LIKE ? OR nombres LIKE ? OR apellidos LIKE ?)');
    valores.push(...Array(4).fill(`%${buscar}%`));
  }
  if (activo !== undefined) { condiciones.push('activo = ?'); valores.push(activo); }
  if (id_rol) {
    condiciones.push('EXISTS (SELECT 1 FROM usuario_roles ur WHERE ur.id_usuario = usuarios.id_usuario AND ur.id_rol = ?)');
    valores.push(id_rol);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [registros] = await pool.query(
    `SELECT ${campos} FROM usuarios ${where} ORDER BY id_usuario LIMIT ? OFFSET ?`,
    [...valores, limite, (pagina - 1) * limite]);
  const [conteo] = await pool.query(`SELECT COUNT(*) AS total FROM usuarios ${where}`, valores);
  const total = Number(conteo[0].total);
  return { registros, paginacion: { pagina, limite, total, total_paginas: Math.ceil(total / limite) } };
}

async function rolesDisponibles() {
  const [roles] = await pool.query('SELECT id_rol, nombre, descripcion FROM roles WHERE activo = 1 ORDER BY id_rol');
  return roles;
}

async function transaccion(operacion) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const resultado = await operacion(db);
    await db.commit();
    return resultado;
  } catch (error) {
    try { await db.rollback(); } catch (_) { /* No registrar SQL ni parámetros. */ }
    throw error;
  } finally { db.release(); }
}

// Orden global para serializar cambios administrativos y evitar perder al último
// administrador por dos solicitudes concurrentes. Solo tablas de seguridad.
async function bloquearSeguridad(db) {
  const [roles] = await db.query('SELECT id_rol, nombre, activo FROM roles ORDER BY id_rol FOR UPDATE');
  const [permisos] = await db.query('SELECT id_permiso, codigo FROM permisos ORDER BY id_permiso FOR UPDATE');
  const [rolPermisos] = await db.query('SELECT id_rol, id_permiso FROM rol_permisos ORDER BY id_rol, id_permiso FOR UPDATE');
  const [usuarios] = await db.query(`SELECT ${campos} FROM usuarios ORDER BY id_usuario FOR UPDATE`);
  const [usuarioRoles] = await db.query('SELECT id_usuario, id_rol FROM usuario_roles ORDER BY id_usuario, id_rol FOR UPDATE');
  return { roles, permisos, rolPermisos, usuarios, usuarioRoles };
}

async function crear(db, datos, hash) {
  const [resultado] = await db.query(
    `INSERT INTO usuarios (username, email, nombres, apellidos, password_hash, activo)
     VALUES (?, ?, ?, ?, ?, 1)`, [datos.username, datos.email, datos.nombres, datos.apellidos, hash]);
  return resultado.insertId;
}

async function editar(db, id, datos) {
  await db.query('UPDATE usuarios SET username = ?, email = ?, nombres = ?, apellidos = ? WHERE id_usuario = ?',
    [datos.username, datos.email, datos.nombres, datos.apellidos, id]);
}

async function estado(db, id, activo) {
  await db.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo ? 1 : 0, id]);
}

async function asignarRoles(db, id, roles) {
  await db.query('DELETE FROM usuario_roles WHERE id_usuario = ?', [id]);
  for (const rol of roles) {
    await db.query('INSERT INTO usuario_roles (id_usuario, id_rol) VALUES (?, ?)', [id, rol]);
  }
}

async function auditar(db, actor, id, accion, antes, despues, ip) {
  // Registro atómico y cerrado: nunca recibe el cuerpo HTTP ni credenciales.
  await db.query(
    `INSERT INTO auditoria (id_usuario, modulo, accion, entidad, id_entidad,
       datos_anteriores, datos_nuevos, ip) VALUES (?, 'USUARIOS', ?, 'usuarios', ?, ?, ?, ?)`,
    [actor, accion, id, JSON.stringify(antes), JSON.stringify(despues), ip || null]);
}

module.exports = { detalle, listar, rolesDisponibles, transaccion, bloquearSeguridad,
  crear, editar, estado, asignarRoles, auditar };
