// Browser-only fixture: real layout/components, simulated session and reports, no API access.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../src/contexts/AuthContext'
import store from '../../src/store'
import DefaultLayout from '../../src/layout/DefaultLayout'
import { reportService } from '../../src/services/reportService'
import '../../src/scss/style.scss'

const rows = {
  ventas: [
    { fecha: '2026-10-02 12:00:00', estado: 'CONFIRMADA', total: '1250.50' },
    { fecha: '2026-10-03 12:00:00', estado: 'ANULADA', total: '500' },
  ],
  ranking: [{ producto: 'Producto de prueba', sku: 'PRUEBA', cantidad: '5' }],
  existencias: [{ stock_actual: '12' }],
}
window.fetch = () => {
  throw new Error('La prueba no permite conexiones a APIs')
}
reportService.catalog = async () => ({ data: { branches: [{ id_sucursal: 1, nombre: 'Prueba' }] } })
reportService.read = async (type) => ({ data: { rows: rows[type] } })

function Preview() {
  const [restricted, setRestricted] = useState(false)
  window.sidebarPreview = { setRestricted }
  return (
    <Provider store={store}>
      <AuthContext.Provider
        value={{
          can: () => !restricted,
          usuario: { id_usuario: 1, username: 'prueba', roles: ['ROOT'], permisos: [] },
          isAuthenticated: true,
          loading: false,
          logout: () => {
            window.sidebarLoggedOut = true
          },
        }}
      >
        <MemoryRouter initialEntries={['/dashboard']}>
          <DefaultLayout />
        </MemoryRouter>
      </AuthContext.Provider>
    </Provider>
  )
}
createRoot(document.getElementById('root')).render(<Preview />)
