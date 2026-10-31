import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { CAlert, CSpinner } from '@coreui/react'
import PropTypes from 'prop-types'
import { useAuth } from '../../contexts/AuthContext'
import { canAccessModule } from '../../auth/permissions'

const ProtectedRoute = ({ children, module }) => {
  const { loading, isAuthenticated, can } = useAuth()
  if (loading) {
    return (
      <div className="pt-3 text-center" role="status">
        <CSpinner color="primary" />
        <span className="visually-hidden">Validando sesión...</span>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/authentication/login" replace />
  if (module && !canAccessModule(can, module)) {
    return (
      <CAlert color="warning" role="alert">
        Acceso denegado. No tienes permiso para consultar este módulo.
      </CAlert>
    )
  }
  return children || <Outlet />
}

ProtectedRoute.propTypes = { children: PropTypes.node, module: PropTypes.object }

export default ProtectedRoute
