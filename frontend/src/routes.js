import React from 'react'
import { modules } from './config/modules'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Products = React.lazy(() => import('./views/products/Products'))
const Inventory = React.lazy(() => import('./views/inventory/Inventory'))
const Customers = React.lazy(() => import('./views/customers/Customers'))
const Suppliers = React.lazy(() => import('./views/suppliers/Suppliers'))
const Purchases = React.lazy(() => import('./views/purchases/Purchases'))
const Sales = React.lazy(() => import('./views/sales/Sales'))
const Cash = React.lazy(() => import('./views/cash/Cash'))
const Credits = React.lazy(() => import('./views/credits/Credits'))
const Transfers = React.lazy(() => import('./views/transfers/Transfers'))
const Returns = React.lazy(() => import('./views/returns/Returns'))
const ModulePlaceholder = React.lazy(() => import('./views/modules/ModulePlaceholder'))

const pages = {
  '/dashboard': Dashboard,
  '/productos': Products,
  '/inventario': Inventory,
  '/clientes': Customers,
  '/proveedores': Suppliers,
  '/compras': Purchases,
  '/ventas': Sales,
  '/caja': Cash,
  '/creditos': Credits,
  '/transferencias': Transfers,
  '/devoluciones': Returns,
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
