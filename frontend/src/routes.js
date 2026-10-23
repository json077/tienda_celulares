import React from 'react'
import { modules } from './config/modules'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Products = React.lazy(() => import('./views/products/Products'))
const Inventory = React.lazy(() => import('./views/inventory/Inventory'))
const Customers = React.lazy(() => import('./views/customers/Customers'))
const Suppliers = React.lazy(() => import('./views/suppliers/Suppliers'))
const ModulePlaceholder = React.lazy(() => import('./views/modules/ModulePlaceholder'))

const pages = {
  '/dashboard': Dashboard,
  '/productos': Products,
  '/inventario': Inventory,
  '/clientes': Customers,
  '/proveedores': Suppliers,
}

export const routes = [
  { path: '/', name: 'Inicio' },
  ...modules.map(({ path, name }) => ({
    path,
    name,
    element: pages[path] || ModulePlaceholder,
  })),
]

export default routes
