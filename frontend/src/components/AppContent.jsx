/**
 * AppContent Component
 *
 * Main content area that renders routes defined in routes.js.
 * Handles lazy loading with Suspense and provides a loading spinner
 * while components are being loaded.
 *
 * Features:
 * - Dynamic route rendering from routes configuration
 * - Suspense boundary for lazy-loaded components
 * - Automatic redirect from root to dashboard
 * - Loading spinner fallback during component load
 *
 * @component
 * @example
 * return (
 *   <AppContent />
 * )
 */

import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CAlert, CButton, CContainer, CSpinner } from '@coreui/react'
import ProtectedRoute from './auth/ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'

// routes config
import { routes } from '../routes'

/**
 * AppContent functional component
 *
 * Renders all application routes within a container with:
 * - Suspense for lazy-loaded route components
 * - Spinner shown during component loading
 * - Default redirect to dashboard
 *
 * Memoized to prevent unnecessary re-renders when parent updates.
 *
 * @returns {React.ReactElement} Content container with routed views
 */
const AppContent = () => {
  const { usuario, accessNotice, refreshSession } = useAuth()
  // Dispose open forms and cached records when effective authorization changes.
  const accessKey = JSON.stringify([usuario?.id_usuario, usuario?.roles, usuario?.permisos])
  return (
    <CContainer className="px-4" lg>
      {accessNotice && (
        <CAlert color="warning" role="alert">
          {accessNotice}
          <CButton color="secondary" size="sm" className="ms-2" onClick={refreshSession}>
            Actualizar acceso
          </CButton>
        </CAlert>
      )}
      <Suspense fallback={<CSpinner color="primary" aria-label="Cargando página" />}>
        <Routes>
          {routes.map((route, idx) => {
            return (
              route.element && (
                <Route
                  key={idx}
                  path={route.path}
                  exact={route.exact}
                  name={route.name}
                  element={
                    <ProtectedRoute module={route}>
                      <route.element key={accessKey} />
                    </ProtectedRoute>
                  }
                />
              )
            )
          })}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="*"
            element={
              <div className="py-4">
                <h1 className="h4">Página no encontrada</h1>
                <p>Selecciona un módulo del menú para continuar.</p>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
