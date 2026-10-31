import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { authService } from '../services/authService'
import { bindAuthorization, TOKEN_KEY } from '../services/api'
import { canAccess, endpointPermission } from '../auth/permissions'

export const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const loginPending = useRef(false)
  const session = useRef(null)
  const sessionReady = useRef(false)
  const [permissionsReady, setPermissionsReady] = useState(false)
  const refreshing = useRef(null)
  const [accessNotice, setAccessNotice] = useState('')
  const replaceSession = useCallback((current) => {
    session.current = current
    sessionReady.current = !!current
    setPermissionsReady(!!current)
    setUsuario(current)
  }, [])
  const can = useCallback(
    (code) => permissionsReady && canAccess(usuario, code),
    [usuario, permissionsReady],
  )
  const refreshSession = useCallback(async () => {
    if (refreshing.current) return refreshing.current
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    const pending = (async () => {
      try {
        const data = await authService.me(token)
        if (localStorage.getItem(TOKEN_KEY) !== token) return
        if (!data.ok || !data.usuario) throw new Error('Sesión inválida')
        replaceSession(data.usuario)
      } catch (error) {
        if (localStorage.getItem(TOKEN_KEY) !== token) return
        sessionReady.current = false
        setPermissionsReady(false)
        if ([401, 403].includes(error.status)) {
          localStorage.removeItem(TOKEN_KEY)
          replaceSession(null)
        }
        setAccessNotice(
          'No se pudo validar el acceso vigente. Actualiza la sesión antes de continuar.',
        )
      }
    })()
    refreshing.current = pending
    try {
      await pending
    } finally {
      refreshing.current = null
    }
  }, [replaceSession])

  useEffect(() => {
    const unbind = bindAuthorization({
      permissionFor: endpointPermission,
      can: (code) => sessionReady.current && canAccess(session.current, code),
      onDenied: (token) => {
        if (localStorage.getItem(TOKEN_KEY) !== token) return
        sessionReady.current = false
        setPermissionsReady(false)
        setAccessNotice(
          'Acceso denegado por el servidor. Revisa las opciones disponibles o actualiza tu acceso.',
        )
        // /auth/me can also return 403 for an inactive user; avoid a refresh loop.
        if (!refreshing.current) void refreshSession()
      },
    })
    const onFocus = () => {
      if (session.current) void refreshSession()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      unbind()
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshSession])

  useEffect(() => {
    const controller = new AbortController()
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY)
        if (!token) return
        const data = await authService.me(token, controller.signal)
        if (!data.ok || !data.usuario) throw new Error('Sesión inválida')
        if (!controller.signal.aborted) replaceSession(data.usuario)
      } catch {
        if (!controller.signal.aborted) {
          localStorage.removeItem(TOKEN_KEY)
          replaceSession(null)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    restoreSession()
    return () => controller.abort()
  }, [replaceSession])

  const login = async (username, password) => {
    if (loginPending.current) return
    loginPending.current = true
    try {
      const data = await authService.login(username, password)
      if (!data.ok || !data.token || !data.usuario) {
        throw new Error('El servidor devolvió una sesión inválida.')
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      // Validate the effective session via /auth/me before exposing protected UI.
      try {
        const current = await authService.me(data.token)
        if (!current.ok || !current.usuario) throw new Error('Sesión inválida')
        replaceSession(current.usuario)
        setAccessNotice('')
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY)
        replaceSession(null)
        throw error
      }
    } finally {
      loginPending.current = false
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    replaceSession(null)
    setAccessNotice('')
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        isAuthenticated: !!usuario,
        can,
        refreshSession,
        accessNotice,
        login,
        logout,
      }}
    >
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
