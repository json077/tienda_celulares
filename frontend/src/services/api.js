export const TOKEN_KEY = 'token'
const API_URL = 'http://localhost:3000/api'

const request = async (path, { body, token, ...options } = {}) => {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con el servidor. Inténtalo nuevamente.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.message || 'No se pudo completar la solicitud.')
    error.status = response.status
    error.errores =
      data?.errores ||
      (data?.errors || []).map((item) => ({ param: item.campo, msg: item.mensaje }))
    throw error
  }
  if (!data) throw new Error('El servidor devolvió una respuesta inválida.')
  return data
}

export const api = {
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

export const apiErrorMessage = (error) => {
  const context =
    error.status === 401
      ? 'Tu sesión no es válida o expiró. Cierra sesión e inicia sesión nuevamente.'
      : error.status === 403
        ? 'No tienes permisos para realizar esta operación.'
        : ''
  const details = (error.errores || []).map((item) => item.msg).filter(Boolean)
  return [context, error.message, ...new Set(details)].filter(Boolean).join(' ')
}
