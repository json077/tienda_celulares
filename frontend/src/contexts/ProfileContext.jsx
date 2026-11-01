import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useAuth } from './AuthContext'
import { profileService } from '../services/profileService'
import { TOKEN_KEY } from '../services/api'

const ProfileContext = createContext({
  url: null,
  loading: false,
  error: '',
  refresh: async () => false,
})
export const ProfileProvider = ({ children }) => {
  const { usuario } = useAuth()
  const id = usuario?.id_usuario
  const [photo, setPhoto] = useState({ id: null, url: null, loading: false, error: '' })
  const version = useRef(0)
  const objectUrl = useRef(null)
  const refresh = useCallback(
    async (signal) => {
      if (!id) return false
      const current = ++version.current
      const token = localStorage.getItem(TOKEN_KEY)
      setPhoto((previous) => ({
        id,
        url: previous.id === id ? previous.url : null,
        loading: true,
        error: '',
      }))
      try {
        const blob = await profileService.photo(signal)
        if (current !== version.current) return false
        if (signal?.aborted || localStorage.getItem(TOKEN_KEY) !== token) {
          setPhoto((previous) => ({ ...previous, loading: false }))
          return false
        }
        const url = blob ? URL.createObjectURL(blob) : null
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = url
        setPhoto({ id, url, loading: false, error: '' })
        return true
      } catch (error) {
        if (current !== version.current) return false
        if (signal?.aborted) {
          setPhoto((previous) => ({ ...previous, loading: false }))
          return false
        }
        setPhoto((previous) => ({
          ...previous,
          id,
          loading: false,
          error: 'No se pudo cargar tu fotografía. Puedes volver a intentarlo.',
        }))
        return false
      }
    },
    [id],
  )
  const invalidate = useCallback(() => {
    version.current++
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void refresh(controller.signal)
    })
    return () => {
      controller.abort()
      invalidate()
    }
  }, [refresh, invalidate])
  const current = photo.id === id ? photo : { url: null, loading: !!id, error: '' }
  return (
    <ProfileContext.Provider value={{ ...current, refresh }}>{children}</ProfileContext.Provider>
  )
}
ProfileProvider.propTypes = { children: PropTypes.node.isRequired }
export const useProfilePhoto = () => useContext(ProfileContext)
