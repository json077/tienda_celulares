import React from 'react'
import { modules } from './config/modules'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const ModulePlaceholder = React.lazy(() => import('./views/modules/ModulePlaceholder'))

export const routes = [
  { path: '/', name: 'Inicio' },
  ...modules.map(({ path, name }) => ({
    path,
    name,
    element: path === '/dashboard' ? Dashboard : ModulePlaceholder,
  })),
]

export default routes
