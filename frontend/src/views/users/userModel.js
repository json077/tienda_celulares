import { canAccess } from '../../auth/permissions'

export const sameId = (a, b) => String(a) === String(b)
export const isRoot = (actor) => actor?.roles?.includes('ROOT') === true
export const can = canAccess
export const hasRoot = (user) => user?.roles?.some((r) => r.nombre === 'ROOT') === true
export const canManage = (actor, user) => isRoot(actor) || !hasRoot(user)
export const canCreate = (actor) =>
  ['USUARIO_CREAR', 'USUARIO_ROLES', 'ROL_VER'].every((code) => can(actor, code))
export const canRoles = (actor, user) =>
  can(actor, 'USUARIO_ROLES') && can(actor, 'ROL_VER') && canManage(actor, user)
export const canState = (actor, user) =>
  can(actor, 'USUARIO_EDITAR') &&
  canManage(actor, user) &&
  !(Number(user.activo) === 1 && sameId(actor?.id_usuario, user.id_usuario))

const validId = (id) => /^[1-9]\d{0,19}$/.test(String(id))
export function publicUser(value, detail = false) {
  if (
    !value ||
    !validId(value.id_usuario) ||
    !['username', 'email', 'nombres', 'apellidos'].every((k) => typeof value[k] === 'string') ||
    ![0, 1, false, true].includes(value.activo) ||
    (detail && !Array.isArray(value.roles))
  )
    throw new Error('El servidor devolvió un usuario inválido.')
  return {
    id_usuario: value.id_usuario,
    username: value.username,
    email: value.email,
    nombres: value.nombres,
    apellidos: value.apellidos,
    activo: Number(value.activo),
    ultimo_acceso: value.ultimo_acceso ?? null,
    roles: detail ? roleCatalog(value.roles, true) : [],
  }
}

export function roleCatalog(value, assigned = false) {
  if (
    !Array.isArray(value) ||
    value.some((r) => !validId(r.id_rol) || typeof r.nombre !== 'string')
  )
    throw new Error('El servidor devolvió un catálogo de roles inválido.')
  return value.map((r) => ({
    id_rol: String(r.id_rol),
    nombre: r.nombre,
    activo: assigned ? Number(r.activo) : 1,
  }))
}

export const profilePayload = (values) =>
  Object.fromEntries(
    ['username', 'email', 'nombres', 'apellidos'].map((key) => [key, values[key].trim()]),
  )
export const rolePayload = (values) => ({ roles: values.roles.map(String) })
export const createPayload = (values) => ({
  ...profilePayload(values),
  password: values.password,
  ...rolePayload(values),
})

export function validateRoles(values, catalog, required = false) {
  if (
    !Array.isArray(values.roles) ||
    values.roles.length > 100 ||
    (required && !values.roles.length) ||
    new Set(values.roles.map(String)).size !== values.roles.length ||
    values.roles.some((id) => !catalog.some((r) => sameId(r.id_rol, id) && r.activo === 1))
  )
    return 'Selecciona roles disponibles y activos, sin duplicados.'
  return ''
}

export function validateUser(values, creating, catalog) {
  if (!/^[A-Za-z0-9_.-]{3,60}$/.test(values.username.trim()))
    return 'El usuario debe tener de 3 a 60 letras, números, puntos, guiones o guiones bajos.'
  if (values.email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    return 'Introduce un correo válido de hasta 150 caracteres.'
  if (['nombres', 'apellidos'].some((k) => !values[k].trim() || [...values[k].trim()].length > 100))
    return 'Nombres y apellidos son obligatorios y admiten hasta 100 caracteres.'
  if (!creating) return ''
  if (
    [...values.password].length < 12 ||
    new TextEncoder().encode(values.password).length > 72 ||
    values.password.includes('\0')
  )
    return 'La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes, sin caracteres nulos.'
  if (values.password !== values.confirmPassword) return 'Las contraseñas no coinciden.'
  return validateRoles(values, catalog, true)
}

export const roleSignature = (user) =>
  user.roles
    .map((r) => String(r.id_rol))
    .sort()
    .join(',')
export function assertOperation(type, actor, target) {
  if (!['create', 'edit', 'roles', 'state'].includes(type))
    throw new Error('Operación de usuario no válida.')
  const permitted =
    type === 'create'
      ? canCreate(actor)
      : type === 'roles'
        ? canRoles(actor, target)
        : type === 'state'
          ? canState(actor, target)
          : can(actor, 'USUARIO_EDITAR') && canManage(actor, target)
  if (!can(actor, 'USUARIO_VER') || !permitted)
    throw Object.assign(
      new Error('Ya no tienes permiso para esta operación. Actualiza tu sesión.'),
      {
        status: 403,
      },
    )
}

// La exclusión síncrona también protege dos clics antes del siguiente render.
export async function exclusive(pending, task) {
  if (pending.current) return
  pending.current = true
  try {
    return await task()
  } finally {
    pending.current = false
  }
}
