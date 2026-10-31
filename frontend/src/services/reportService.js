import { api, authorizeRequest, reportAccessDenied, TOKEN_KEY } from './api'

export const reportQuery = (filters) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== undefined) params.set(key, value)
  })
  return params.size ? `?${params}` : ''
}

export const reportService = {
  catalog: (signal) => api.get('/reportes', { token: localStorage.getItem(TOKEN_KEY), signal }),
  read: (type, filters, signal) =>
    api.get(`/reportes/${type}${reportQuery(filters)}`, {
      token: localStorage.getItem(TOKEN_KEY),
      signal,
    }),
  export: async (type, filters, signal) => {
    const token = localStorage.getItem(TOKEN_KEY)
    const path = `/reportes/${type}/excel${reportQuery(filters)}`
    authorizeRequest(path, 'GET', token)
    const response = await fetch(`http://localhost:3000/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
    if (!response.ok) {
      if (response.status === 403) reportAccessDenied(token)
      const body = await response.json().catch(() => null)
      throw Object.assign(new Error(body?.message || 'No se pudo exportar el reporte.'), {
        status: response.status,
      })
    }
    if (!response.headers.get('Content-Type')?.includes('spreadsheetml.sheet'))
      throw new Error('El servidor no devolvió un archivo Excel válido.')
    return response.blob()
  },
}
