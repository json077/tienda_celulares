import { api, API_URL, TOKEN_KEY, reportAccessDenied } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })
async function photoRequest(method, body, signal) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token)
    throw Object.assign(new Error('Inicia sesión para consultar tu perfil.'), { status: 401 })
  let response
  try {
    response = await fetch(`${API_URL}/auth/profile/photo`, {
      method,
      signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'image/png' }) },
      ...(body && { body }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con el servidor para actualizar tu fotografía.')
  }
  if (method === 'GET' && response.status === 404) return null
  if (!response.ok) {
    if (response.status === 403) reportAccessDenied(token)
    const data = await response.json().catch(() => null)
    throw Object.assign(
      new Error(data?.message || 'No se pudo completar la operación de fotografía.'),
      { status: response.status },
    )
  }
  if (method !== 'GET') return response.json()
  if (!response.headers.get('Content-Type')?.startsWith('image/png'))
    throw new Error('La fotografía recibida no es válida.')
  const blob = await response.blob()
  if (!blob.size || blob.size > 2 * 1024 * 1024)
    throw new Error('La fotografía recibida no es válida.')
  return blob
}
export const profileService = {
  get: (signal) => api.get('/auth/profile', options(signal)),
  photo: (signal) => photoRequest('GET', null, signal),
  upload: (blob, signal) => photoRequest('PUT', blob, signal),
  remove: (signal) => api.delete('/auth/profile/photo', options(signal)),
  password: (values, signal) =>
    api.post(
      '/auth/profile/password',
      {
        actual: values.actual,
        nueva: values.nueva,
        confirmacion: values.confirmacion,
      },
      options(signal),
    ),
}
