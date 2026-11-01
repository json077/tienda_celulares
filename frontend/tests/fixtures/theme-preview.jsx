// Isolated visual fixtures. All reads are simulated and every write/network call is blocked.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Chart } from 'chart.js'
import { AuthContext } from '../../src/contexts/AuthContext'
import { api } from '../../src/services/api'
import store from '../../src/store'
import DefaultLayout from '../../src/layout/DefaultLayout'
import Login from '../../src/views/authentication/login/Login'
import ModalMotionPreview from './ModalMotionPreview'
import '../../src/scss/style.scss'

const product = {
  id_producto: 1,
  sku: 'PRUEBA',
  nombre: 'Teléfono de prueba',
  categoria: 'Teléfonos',
  id_categoria: 1,
  marca: 'Prueba',
  id_marca: 1,
  tipo_control: 'CANTIDAD',
  precio_venta: '1250.50',
  activo: 1,
  dias_garantia: 30,
  permite_descuento: 0,
}
const supplier = {
  id_proveedor: 1,
  nombre: 'Distribuidora de prueba',
  activo: 1,
  identificacion: 'TEST-001',
  tipo_identificacion: 'RUC',
  telefono: '8888-0000',
  email: 'prueba@example.com',
  direccion: 'Managua',
}
const sale = {
  id_venta: 1,
  numero_venta: 'TEST-001',
  fecha: '2026-10-02 12:00:00',
  id_sucursal: 1,
  sucursal: 'Central de prueba',
  cliente: 'Cliente de prueba',
  tipo_venta: 'CONTADO',
  estado: 'CONFIRMADA',
  total: '1250.50',
}
const reportColumns = [
  { key: 'fecha', label: 'Fecha', type: 'text' },
  { key: 'estado', label: 'Estado', type: 'text' },
  { key: 'total', label: 'Importe (C$)', type: 'money' },
]
const branches = [{ id_sucursal: 1, nombre: 'Central de prueba' }]
const reports = [{ id: 'ventas', title: 'Ventas', dates: true, states: ['CONFIRMADA', 'ANULADA'] }]
const ranking = [
  { producto: product.nombre, sku: product.sku, cantidad: '5' },
  { producto: 'Cable de prueba', sku: 'CABLE', cantidad: '2' },
]
const stock = [
  {
    id_sucursal: 1,
    sucursal: 'Central de prueba',
    id_producto: 1,
    producto: product.nombre,
    sku: product.sku,
    tipo_control: 'CANTIDAD',
    stock_actual: 12,
    stock_minimo: 2,
    stock_bajo: 0,
  },
]
const records = {
  '/productos': [product],
  '/categorias': [{ id_categoria: 1, nombre: 'Teléfonos', activo: 1 }],
  '/marcas': [{ id_marca: 1, nombre: 'Prueba', activo: 1 }],
  '/proveedores': [supplier],
  '/clientes': [{ id_cliente: 1, nombres: 'Cliente', apellidos: 'de prueba', activo: 1 }],
  '/ventas': [
    sale,
    { ...sale, id_venta: 2, numero_venta: 'TEST-002', estado: 'ANULADA', total: 500 },
  ],
  '/compras': [
    {
      id_compra: 1,
      id_sucursal: 1,
      sucursal: 'Central de prueba',
      proveedor: supplier.nombre,
      numero_documento: 'COMPRA-TEST',
      estado: 'BORRADOR',
      fecha: '2026-10-01 12:00:00',
      total: 1000,
    },
  ],
  '/inventario': stock,
  '/unidades': [],
  '/inventario/movimientos': [],
  '/respaldos': [
    {
      id_respaldo: 1,
      nombre_archivo: 'copia-prueba.sql',
      fecha_creacion: '2026-10-01 12:00:00',
      tamano_bytes: 2048,
      estado: 'COMPLETADO',
    },
  ],
  '/reportes': { branches, reports, products: [{ id_producto: 1, nombre: product.nombre }] },
  '/reportes/ranking': { rows: ranking },
  '/reportes/existencias': { rows: stock },
  '/reportes/ventas': {
    id: 'ventas',
    title: 'Ventas',
    note: 'Datos simulados para revisión visual.',
    filters: {},
    generatedAt: '2026-10-31T18:00:00Z',
    columns: reportColumns,
    totals: [],
    rows: [sale, { ...sale, fecha: '2026-10-03 12:00:00', estado: 'ANULADA', total: 500 }],
  },
}
let failReads = false
let loadingReads = false
api.get = async (request) => {
  if (loadingReads) return new Promise(() => {})
  if (failReads) throw new Error('Error de consulta simulado para revisar el contraste.')
  const pathname = request.split('?')[0]
  if (!(pathname in records)) throw new Error(`Lectura no preparada: ${pathname}`)
  return { ok: true, data: structuredClone(records[pathname]) }
}
window.fetch = () => {
  throw new Error('Las pruebas visuales no acceden a APIs reales')
}
for (const method of ['post', 'put', 'delete']) {
  api[method] = () => {
    throw new Error('Las pruebas visuales no permiten escrituras')
  }
}

function Preview() {
  const navigate = useNavigate()
  const location = useLocation()
  const [restricted, setRestricted] = useState(false)
  const loginPage = location.pathname === '/authentication/login'
  window.sidebarPreview = { setRestricted }
  window.themePreview = {
    navigate,
    charts: () => Object.values(Chart.instances),
    fail: (value) => {
      failReads = value
    },
    loading: (value) => {
      loadingReads = value
    },
  }
  return (
    <AuthContext.Provider
      value={{
        can: () => !restricted,
        usuario: { id_usuario: 1, username: 'prueba', roles: ['ROOT'], permisos: [] },
        isAuthenticated: !loginPage,
        loading: false,
        login: async () => {
          throw new Error('Credenciales de prueba no válidas.')
        },
        logout: () => {
          window.sidebarLoggedOut = true
        },
      }}
    >
      <Routes>
        <Route path="/authentication/login" element={<Login />} />
        <Route path="*" element={<DefaultLayout />} />
      </Routes>
      <ModalMotionPreview />
    </AuthContext.Provider>
  )
}
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={['/dashboard']}>
      <Preview />
    </MemoryRouter>
  </Provider>,
)
