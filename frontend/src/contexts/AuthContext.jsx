import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { authService } from '../services/authService'
import { TOKEN_KEY } from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const loginPending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY)
        if (!token) return
        const data = await authService.me(token, controller.signal)
        if (!data.ok || !data.usuario) throw new Error('Sesión inválida')
        if (!controller.signal.aborted) setUsuario(data.usuario)
      } catch {
        if (!controller.signal.aborted) {
          localStorage.removeItem(TOKEN_KEY)
          setUsuario(null)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    restoreSession()
    return () => controller.abort()
  }, [])

  const login = async (username, password) => {
    if (loginPending.current) return
    loginPending.current = true
    try {
      const data = await authService.login(username, password)
      if (!data.ok || !data.token || !data.usuario) {
        throw new Error('El servidor devolvió una sesión inválida.')
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      setUsuario(data.usuario)
    } finally {
      loginPending.current = false
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, isAuthenticated: !!usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired }

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
