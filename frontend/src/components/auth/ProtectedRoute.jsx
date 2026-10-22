import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { CSpinner } from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'

const ProtectedRoute = () => {
  const { loading, isAuthenticated } = useAuth()
  if (loading) {
    return (
      <div className="pt-3 text-center" role="status">
        <CSpinner color="primary" />
        <span className="visually-hidden">Validando sesión...</span>
      </div>
    )
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/authentication/login" replace />
}

export default ProtectedRoute
