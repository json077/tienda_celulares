// Real profile UI with isolated in-memory HTTP responses. Never contacts an API or writes data.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../src/contexts/AuthContext'
import { api } from '../../src/services/api'
import DefaultLayout from '../../src/layout/DefaultLayout'
import store from '../../src/store'
import '../../src/scss/style.scss'

const own = {
  id_usuario: 1,
  nombres: 'Ana',
  apellidos: 'Prueba',
  username: 'cuenta-propia',
  email: 'ana@example.com',
  roles: ['VENDEDOR'],
  permisos: [],
}
const simulation = { photo: null, uploads: 0, deletions: 0, passwords: 0, fail: false, delay: 0 }
localStorage.setItem('token', 'isolated-profile-test')
api.get = async (path) => {
  if (path !== '/auth/profile') throw new Error('Lectura fuera del perfil no permitida')
  if (simulation.delay) await new Promise((resolve) => setTimeout(resolve, simulation.delay))
  if (simulation.fail) throw new Error('Error de consulta simulado.')
  return {
    ok: true,
    data: { ...own, sucursales: [{ id_sucursal: 7, nombre: 'Central de prueba' }] },
  }
}
window.fetch = async (url, options = {}) => {
  if (url !== 'http://localhost:3000/api/auth/profile/photo') throw new Error('API real bloqueada')
  if (options.headers.Authorization !== 'Bearer isolated-profile-test')
    throw new Error('Identidad de prueba ausente')
  if (options.method === 'PUT') {
    simulation.uploads++
    await new Promise((resolve) => setTimeout(resolve, 120))
    simulation.photo = options.body
    return Response.json({ ok: true, message: 'Foto actualizada.' })
  }
  return simulation.photo
    ? new Response(simulation.photo, { headers: { 'Content-Type': 'image/png' } })
    : Response.json({ ok: false }, { status: 404 })
}
api.delete = async (path) => {
  if (path !== '/auth/profile/photo') throw new Error('Escritura fuera del perfil no permitida')
  simulation.deletions++
  simulation.photo = null
  return { ok: true }
}
api.post = async (path, body) => {
  if (path !== '/auth/profile/password') throw new Error('Escritura fuera del perfil no permitida')
  simulation.passwords++
  await new Promise((resolve) => setTimeout(resolve, 120))
  if (body.actual !== 'Actual-prueba-123') throw new Error('La contraseña actual no es correcta.')
  return { ok: true, message: 'Tu contraseña se actualizó correctamente.' }
}
api.put = () => {
  throw new Error('Escritura fuera del perfil no permitida')
}
window.profilePreview = simulation
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <AuthContext.Provider
      value={{ usuario: own, can: () => false, loading: false, isAuthenticated: true, logout() {} }}
    >
      <MemoryRouter initialEntries={['/mi-perfil']}>
        <DefaultLayout />
      </MemoryRouter>
    </AuthContext.Provider>
  </Provider>,
)
