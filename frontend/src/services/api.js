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
    throw error
  }
  if (!data) throw new Error('El servidor devolvió una respuesta inválida.')
  return data
}

export const api = {
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  get: (path, options) => request(path, { ...options, method: 'GET' }),
}
