import React, { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useAuth } from '../../../contexts/AuthContext'

const Login = () => {
  const { login, loading, isAuthenticated } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (pending.current || loading) return
    pending.current = true
    setSubmitting(true)
    setError('')
    try {
      await login(username.trim(), password)
    } catch (error) {
      setError(error.message || 'No se pudo iniciar sesión.')
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center" role="status">
        <CSpinner color="primary" />
        <span className="visually-hidden">Validando sesión...</span>
      </div>
    )
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8} lg={6} xl={5}>
            <CCard className="p-4">
              <CCardBody>
                <h1 className="h4 text-center">Iniciar sesión</h1>
                <p className="text-body-secondary text-center">
                  Control de inventario y facturación
                </p>
                {error && (
                  <CAlert color="danger" role="alert">
                    {error}
                  </CAlert>
                )}
                <CForm className="row gy-3" onSubmit={handleSubmit} aria-busy={submitting}>
                  <CCol xs={12}>
                    <CFormLabel htmlFor="username">Usuario</CFormLabel>
                    <CFormInput
                      id="username"
                      name="username"
                      autoComplete="username"
                      placeholder="Nombre de usuario"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      disabled={submitting}
                      required
                    />
                  </CCol>
                  <CCol xs={12}>
                    <CFormLabel htmlFor="password">Contraseña</CFormLabel>
                    <CInputGroup>
                      <CFormInput
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={submitting}
                        required
                      />
                      <CButton
                        type="button"
                        color="secondary"
                        variant="outline"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? 'Ocultar' : 'Mostrar'}
                      </CButton>
                    </CInputGroup>
                  </CCol>
                  <CCol xs={12}>
                    <CButton color="primary" type="submit" className="w-100" disabled={submitting}>
                      {submitting && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
                      {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </CButton>
                  </CCol>
                </CForm>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
