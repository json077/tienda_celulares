import { api, apiErrorMessage, TOKEN_KEY } from './api'
import { authService } from './authService'
import {
  assertOperation,
  createPayload,
  profilePayload,
  publicUser,
  roleCatalog,
  rolePayload,
  roleSignature,
  sameId,
  validateRoles,
  validateUser,
} from '../views/users/userModel'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
const check = (signal) => {
  if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError')
}
const detail = async (id, signal) => {
  const response = await api.get(`/usuarios/${encodeURIComponent(id)}`, options(signal))
  const user = publicUser(response.data, true)
  if (!sameId(id, user.id_usuario))
    throw new Error('El detalle no corresponde al usuario solicitado.')
  return user
}
const roles = async (signal) =>
  roleCatalog((await api.get('/usuarios/roles', options(signal))).data)
const me = async (signal) => {
  const response = await authService.me(options(signal).token, signal)
  const actor = response.usuario
  if (!actor?.id_usuario || !Array.isArray(actor.roles) || !Array.isArray(actor.permisos))
    throw new Error('No se pudieron obtener los permisos vigentes. Inicia sesión nuevamente.')
  return actor
}

export const userService = {
  me,
  detail,
  roles,
  async list(filters, signal) {
    const query = new URLSearchParams()
    for (const key of ['buscar', 'activo', 'id_rol', 'pagina', 'limite'])
      if (filters[key] !== '' && filters[key] !== undefined) query.set(key, filters[key])
    const response = await api.get(`/usuarios?${query}`, options(signal))
    const { registros, paginacion } = response.data || {}
    if (
      !Array.isArray(registros) ||
      !paginacion ||
      !['pagina', 'limite', 'total', 'total_paginas'].every((k) =>
        Number.isSafeInteger(paginacion[k]),
      ) ||
      paginacion.pagina < 1 ||
      paginacion.limite < 1 ||
      paginacion.limite > 100 ||
      registros.length > paginacion.limite ||
      paginacion.total < 0 ||
      paginacion.total_paginas < 0
    )
      throw new Error('El servidor devolvió un listado inválido.')
    const users = []
    // El listado real no incluye roles; máximo cuatro detalles simultáneos.
    for (let start = 0; start < registros.length; start += 4) {
      check(signal)
      const batch = await Promise.all(
        registros.slice(start, start + 4).map((row) => detail(publicUser(row).id_usuario, signal)),
      )
      users.push(...batch)
    }
    return { users, pagination: paginacion }
  },
  async commit(type, original, values, signal, onIdentity = () => {}) {
    const actor = await me(signal)
    onIdentity(actor)
    const current = original ? await detail(original.id_usuario, signal) : null
    assertOperation(type, actor, current)
    if (
      current &&
      (roleSignature(current) !== roleSignature(original) || current.activo !== original.activo)
    )
      throw new Error('El estado o los roles cambiaron. Cierra la ventana y vuelve a consultar.')
    let payload
    if (type === 'create' || type === 'roles') {
      const catalog = await roles(signal)
      const message =
        type === 'create' ? validateUser(values, true, catalog) : validateRoles(values, catalog)
      if (message) throw new Error(message)
      payload = type === 'create' ? createPayload(values) : rolePayload(values)
    } else if (type === 'edit') {
      const message = validateUser(values, false, [])
      if (message) throw new Error(message)
      payload = profilePayload(values)
    } else payload = { activo: current.activo !== 1 }
    check(signal)
    let response
    if (type === 'create') {
      const sending = api.post('/usuarios', payload, options(signal))
      // fetch ya serializó el cuerpo. No conservar la contraseña mientras esperamos.
      payload.password = ''
      values.password = ''
      values.confirmPassword = ''
      response = await sending
    } else if (type === 'edit')
      response = await api.put(`/usuarios/${current.id_usuario}`, payload, options(signal))
    else if (type === 'roles')
      response = await api.put(`/usuarios/${current.id_usuario}/roles`, payload, options(signal))
    else
      response = await api.patch(`/usuarios/${current.id_usuario}/estado`, payload, options(signal))
    return publicUser(response.data, true)
  },
}

export const userErrorMessage = (error) =>
  apiErrorMessage({
    status: error.status,
    message: error.message,
    errores: (error.errores || []).map((item) => ({ msg: item.mensaje || item.msg })),
  })
