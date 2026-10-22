import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'
import { routes } from '../routes'

const AppBreadcrumb = () => {
  const { pathname } = useLocation()
  const route = routes.find(({ path }) => path === pathname)

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem>
        <Link to="/dashboard">Inicio</Link>
      </CBreadcrumbItem>
      {pathname !== '/' && (
        <CBreadcrumbItem active>{route?.name || 'Página no encontrada'}</CBreadcrumbItem>
      )}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
