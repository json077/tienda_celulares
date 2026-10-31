import { api, authorizeRequest, reportAccessDenied, TOKEN_KEY } from './api'

export function backupId(value) {
  const id = String(value)
  if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
    throw new Error('Selecciona una copia de seguridad válida.')
  return id
}
const session = () => ({ token: localStorage.getItem(TOKEN_KEY) })
export const backupService = {
  list: (signal) => api.get('/respaldos', { ...session(), signal }),
  create: () => api.post('/respaldos', undefined, session()),
  restore: (id) => api.post(`/respaldos/${backupId(id)}/restaurar`, undefined, session()),
  download: async (id) => {
    const path = `/respaldos/${backupId(id)}/descargar`
    const token = localStorage.getItem(TOKEN_KEY)
    authorizeRequest(path, 'GET', token)
    const response = await fetch(`http://localhost:3000/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      if (response.status === 403) reportAccessDenied(token)
      const body = await response.json().catch(() => null)
      throw Object.assign(new Error(body?.message || 'No se pudo descargar la copia.'), {
        status: response.status,
      })
    }
    if (!response.headers.get('Content-Type')?.includes('application/sql'))
      throw new Error('El servidor no devolvió una copia SQL válida.')
    return response.blob()
  },
}
