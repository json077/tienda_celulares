const bcrypt = require('bcrypt');
const repository = require('../repositories/userRepository');

const permisosAdministrativos = ['USUARIO_VER', 'USUARIO_CREAR', 'USUARIO_EDITAR', 'USUARIO_ROLES', 'ROL_VER'];
const igual = (a, b) => String(a) === String(b);
function error(message, status = 400) { return Object.assign(new Error(message), { status }); }

function rolesUsuario(snapshot, id) {
  const ids = snapshot.usuarioRoles.filter(x => igual(x.id_usuario, id)).map(x => String(x.id_rol));
  return snapshot.roles.filter(r => ids.includes(String(r.id_rol)));
}

function privilegios(snapshot, id) {
  const roles = rolesUsuario(snapshot, id).filter(r => r.activo);
  const root = roles.some(r => r.nombre === 'ROOT');
  const ids = snapshot.rolPermisos.filter(rp => roles.some(r => igual(r.id_rol, rp.id_rol)))
    .map(rp => String(rp.id_permiso));
  return { root, permisos: snapshot.permisos.filter(p => ids.includes(String(p.id_permiso))).map(p => p.codigo) };
}

function autorizar(snapshot, actor, permiso) {
  const usuario = snapshot.usuarios.find(u => igual(u.id_usuario, actor));
  if (!usuario || !usuario.activo) throw error('Usuario no autorizado', 403);
  const privilegio = privilegios(snapshot, actor);
  if (!privilegio.root && !privilegio.permisos.includes(permiso)) throw error('No tiene permiso para realizar esta acción', 403);
  return privilegio;
}

function validarRoles(snapshot, ids) {
  if (ids.some(id => !snapshot.roles.some(r => igual(r.id_rol, id) && r.activo))) {
    throw error('Los roles deben existir y estar activos');
  }
}

function conservarAdministrador(snapshot, id, activo, nuevosRoles) {
  const usuarios = snapshot.usuarios.map(u => igual(u.id_usuario, id) ? { ...u, activo } : u);
  const usuarioRoles = nuevosRoles === undefined ? snapshot.usuarioRoles : [
    ...snapshot.usuarioRoles.filter(ur => !igual(ur.id_usuario, id)),
    ...nuevosRoles.map(id_rol => ({ id_usuario: id, id_rol }))
  ];
  const siguiente = { ...snapshot, usuarios, usuarioRoles };
  if (!usuarios.some(u => {
    if (!u.activo) return false;
    const p = privilegios(siguiente, u.id_usuario);
    return p.root || permisosAdministrativos.every(codigo => p.permisos.includes(codigo));
  })) throw error('Debe conservarse al menos un usuario activo con capacidad administrativa', 409);
}

async function obtener(id) {
  const usuario = await repository.detalle(id);
  if (!usuario) throw error('El usuario no existe', 404);
  return usuario;
}

async function mutar(tipo, id, datos, actor, ip) {
  // bcrypt fuera del bloqueo global; nunca se cambia contraseña mediante edición.
  const hash = tipo === 'CREAR' ? await bcrypt.hash(datos.password, 12) : null;
  try {
    return await repository.transaccion(async db => {
      const snapshot = await repository.bloquearSeguridad(db);
      const permiso = { CREAR: 'USUARIO_CREAR', EDITAR: 'USUARIO_EDITAR', ESTADO: 'USUARIO_EDITAR', ROLES: 'USUARIO_ROLES' }[tipo];
      const actual = autorizar(snapshot, actor, permiso);
      let destino = null;
      if (tipo !== 'CREAR') {
        destino = snapshot.usuarios.find(u => igual(u.id_usuario, id));
        if (!destino) throw error('El usuario no existe', 404);
      }
      const anteriores = destino ? rolesUsuario(snapshot, id) : [];
      const rootAnterior = anteriores.some(r => r.nombre === 'ROOT');
      const ids = datos.roles;
      if (tipo === 'CREAR' || tipo === 'ROLES') {
        if (tipo === 'CREAR') autorizar(snapshot, actor, 'USUARIO_ROLES');
        validarRoles(snapshot, ids);
        const rootNuevo = snapshot.roles.some(r => r.nombre === 'ROOT' && ids.some(x => igual(x, r.id_rol)));
        if (!actual.root && rootAnterior !== rootNuevo) throw error('Solo ROOT puede asignar o retirar el rol ROOT', 403);
      }
      if (!actual.root && rootAnterior && (tipo === 'ESTADO' || tipo === 'EDITAR')) {
        throw error('Solo ROOT puede modificar otro usuario ROOT', 403);
      }
      if (tipo === 'ESTADO' && !datos.activo && igual(actor, id)) {
        throw error('No puede desactivar su propio usuario', 409);
      }
      if (tipo === 'ESTADO' || tipo === 'ROLES') {
        conservarAdministrador(snapshot, id, tipo === 'ESTADO' ? datos.activo : destino.activo,
          tipo === 'ROLES' ? ids : undefined);
      }
      if (tipo === 'CREAR') {
        id = await repository.crear(db, datos, hash);
        await repository.asignarRoles(db, id, ids);
      } else if (tipo === 'EDITAR') {
        await repository.editar(db, id, datos);
      } else if (tipo === 'ESTADO') {
        await repository.estado(db, id, datos.activo);
      } else {
        await repository.asignarRoles(db, id, ids);
      }
      const resultado = await repository.detalle(id, db);
      const resumen = usuario => usuario ? {
        id_usuario: usuario.id_usuario, activo: Number(usuario.activo)
      } : null;
      const antes = resumen(destino), despues = resumen(resultado);
      // Solo IDs de roles y estado: sin nombres, correos, contraseñas ni hashes.
      if (antes) antes.roles = anteriores.map(r => String(r.id_rol));
      despues.roles = resultado.roles.map(r => String(r.id_rol));
      await repository.auditar(db, actor, id, tipo === 'ESTADO' ? (datos.activo ? 'ACTIVAR' : 'DESACTIVAR') : tipo,
        antes, despues, ip);
      return resultado;
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw error('Ya existe un usuario con ese nombre de usuario o correo', 409);
    throw err;
  }
}

async function rolesDisponibles(usuario) {
  const roles = await repository.rolesDisponibles();
  return usuario.roles.includes('ROOT') ? roles : roles.filter(r => r.nombre !== 'ROOT');
}

module.exports = { listar: repository.listar, rolesDisponibles, obtener, mutar };
