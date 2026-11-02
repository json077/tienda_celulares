import { API_URL, TOKEN_KEY, authorizeRequest, reportAccessDenied } from './api'

export const PRODUCT_PHOTO_MAX_BYTES = 2 * 1024 * 1024
export const PRODUCT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function request(id, method, body, signal) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token)
    throw Object.assign(new Error('Inicia sesión para consultar fotografías.'), { status: 401 })
  if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Producto inválido.')
  const path = `/productos/${id}/foto`
  authorizeRequest(path, method, token)
  if (
    body &&
    (!PRODUCT_PHOTO_TYPES.includes(body.type) || !body.size || body.size > PRODUCT_PHOTO_MAX_BYTES)
  )
    throw new Error('Selecciona JPG, PNG o WebP de hasta 2 MB.')
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': body.type }) },
      ...(body && { body }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con el servidor de fotografías.')
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
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'image/webp')
    throw new Error('Fotografía recibida inválida.')
  const blob = await response.blob()
  if (!blob.size || blob.size > PRODUCT_PHOTO_MAX_BYTES)
    throw new Error('Fotografía recibida inválida.')
  return blob
}

export const productPhotoService = {
  get: (id, signal) => request(id, 'GET', null, signal),
  upload: (id, file, signal) => request(id, 'PUT', file, signal),
  remove: (id, signal) => request(id, 'DELETE', null, signal),
}
