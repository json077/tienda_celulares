import React, { useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react'
import { cilUser } from '@coreui/icons'
import { useAuth } from '../../contexts/AuthContext'
import { useProfilePhoto } from '../../contexts/ProfileContext'
import { profileService } from '../../services/profileService'
import { apiErrorMessage } from '../../services/api'
import { PageHeading } from '../../components/management/ManagementUI'
import ProfileAvatar from '../../components/ProfileAvatar'
import { preparePhoto, validatePassword } from './profileModel'
import './profile.css'

const emptyPasswords = { actual: '', nueva: '', confirmacion: '' }
const MyProfile = () => {
  const { usuario } = useAuth()
  const photo = useProfilePhoto()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [passwords, setPasswords] = useState(emptyPasswords)
  const pending = useRef(false)
  const lifetime = useRef(null)
  const fileInput = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    profileService
      .get(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setProfile(response.data)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(apiErrorMessage(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision])
  const account = profile || usuario
  const fullName =
    [account?.nombres, account?.apellidos].filter(Boolean).join(' ').trim() ||
    account?.username ||
    'Usuario'
  const operate = async (name, action) => {
    if (pending.current || !lifetime.current || lifetime.current.signal.aborted) return
    pending.current = true
    setBusy(name)
    setNotice(null)
    try {
      const message = await action(lifetime.current.signal)
      if (!lifetime.current.signal.aborted) setNotice({ color: 'success', message })
    } catch (error) {
      if (!lifetime.current.signal.aborted)
        setNotice({ color: 'danger', message: apiErrorMessage(error) })
    } finally {
      pending.current = false
      if (!lifetime.current.signal.aborted) setBusy('')
    }
  }
  const upload = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void operate('photo', async (signal) => {
      const blob = await preparePhoto(file)
      if (signal.aborted) throw new DOMException('Operación cancelada', 'AbortError')
      await profileService.upload(blob, signal)
      const refreshed = await photo.refresh(signal)
      return refreshed
        ? 'Tu fotografía de perfil se actualizó correctamente.'
        : 'Fotografía guardada. No se pudo actualizar la vista; vuelve a cargar tu foto.'
    })
  }
  const changePassword = (event) => {
    event.preventDefault()
    if (pending.current) return
    const error = validatePassword(passwords)
    if (error) return setNotice({ color: 'danger', message: error })
    void operate('password', async (signal) => {
      const response = await profileService.password(passwords, signal)
      if (!signal.aborted) setPasswords(emptyPasswords)
      return response.message
    })
  }
  return (
    <div className="profile-view">
      <PageHeading
        title="Mi perfil"
        description="Tu información personal, fotografía y seguridad de acceso."
        icon={cilUser}
      />
      {notice && (
        <CAlert
          color={notice.color}
          role={notice.color === 'danger' ? 'alert' : 'status'}
          dismissible
          onClose={() => setNotice(null)}
        >
          {notice.message}
        </CAlert>
      )}
      <CCard className="management-panel profile-summary mb-4">
        <CCardBody className="d-flex flex-wrap align-items-center gap-4">
          <ProfileAvatar name={fullName} large />
          <div className="flex-grow-1">
            <h2 className="h4 mb-2">{fullName}</h2>
            <p className="text-body-secondary mb-2">@{account?.username || '—'}</p>
            <div className="d-flex flex-wrap gap-2">
              {account?.roles?.length ? (
                account.roles.map((role) => (
                  <CBadge key={role} color="primary">
                    {role}
                  </CBadge>
                ))
              ) : (
                <span className="text-body-secondary">Sin roles asignados</span>
              )}
            </div>
          </div>
          <div className="profile-photo-actions">
            <CFormLabel htmlFor="profile-photo" className="small d-block">
              Fotografía de perfil
            </CFormLabel>
            <input
              ref={fileInput}
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png"
              className="visually-hidden"
              disabled={!!busy}
              onChange={upload}
              aria-describedby="profile-photo-help"
              tabIndex={-1}
            />
            <div className="d-flex flex-wrap gap-2">
              <CButton color="primary" disabled={!!busy} onClick={() => fileInput.current?.click()}>
                {busy === 'photo' ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Guardando…
                  </>
                ) : photo.url ? (
                  'Cambiar fotografía'
                ) : (
                  'Subir fotografía'
                )}
              </CButton>
              <CButton
                color="secondary"
                variant="outline"
                disabled={!!busy || !photo.url}
                onClick={() =>
                  void operate('photo', async (signal) => {
                    await profileService.remove(signal)
                    const refreshed = await photo.refresh(signal)
                    return refreshed
                      ? 'Tu fotografía se eliminó correctamente.'
                      : 'Fotografía eliminada. Vuelve a cargar tu foto para actualizar la vista.'
                  })
                }
              >
                Eliminar fotografía
              </CButton>
            </div>
            <p id="profile-photo-help" className="small text-body-secondary mt-2 mb-0">
              JPEG o PNG · Hasta 5 MB. Se optimiza a 512 px.
            </p>
            {photo.loading && (
              <p className="small text-body-secondary mb-0" role="status">
                Cargando fotografía…
              </p>
            )}
            {photo.error && (
              <div className="small mt-2" role="alert">
                {photo.error}{' '}
                <CButton
                  color="primary"
                  variant="link"
                  size="sm"
                  disabled={!!busy || photo.loading}
                  onClick={() => void photo.refresh(lifetime.current?.signal)}
                >
                  Volver a cargar foto
                </CButton>
              </div>
            )}
          </div>
        </CCardBody>
      </CCard>
      <CRow className="g-4">
        <CCol xl={6}>
          <CCard className="management-panel h-100">
            <CCardBody>
              <h2 className="h5 mb-3">Información personal</h2>
              <p className="small text-body-secondary">
                Datos registrados de tu cuenta. Los roles y las sucursales son administrados por el
                personal autorizado.
              </p>
              {loading ? (
                <div className="py-4" role="status">
                  <CSpinner size="sm" className="me-2" />
                  Cargando tu información…
                </div>
              ) : loadError ? (
                <CAlert color="danger" role="alert">
                  {loadError}
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    className="ms-2"
                    disabled={!!busy}
                    onClick={() => {
                      setLoadError('')
                      setLoading(true)
                      setRevision((value) => value + 1)
                    }}
                  >
                    Reintentar
                  </CButton>
                </CAlert>
              ) : (
                <dl className="profile-information mb-0">
                  <dt>Nombre completo</dt>
                  <dd>{fullName}</dd>
                  <dt>Nombre de usuario</dt>
                  <dd>{account?.username || 'No registrado'}</dd>
                  <dt>Correo electrónico</dt>
                  <dd>{account?.email || 'No registrado'}</dd>
                  <dt>Roles asignados</dt>
                  <dd>{account?.roles?.join(', ') || 'Sin roles asignados'}</dd>
                  <dt>Sucursales asignadas</dt>
                  <dd>
                    {profile?.sucursales?.length
                      ? profile.sucursales.map((branch) => branch.nombre).join(', ')
                      : 'Sin sucursales asignadas'}
                  </dd>
                </dl>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xl={6}>
          <CCard className="management-panel h-100">
            <CCardBody>
              <h2 className="h5 mb-3">Seguridad</h2>
              <p className="small text-body-secondary" id="profile-password-help">
                Para cambiar tu contraseña, introduce la actual y confirma una nueva de al menos 12
                caracteres y hasta 72 bytes.
              </p>
              <CForm
                onSubmit={changePassword}
                aria-busy={busy === 'password'}
                aria-describedby="profile-password-help"
              >
                {[
                  ['actual', 'Contraseña actual', 'current-password'],
                  ['nueva', 'Nueva contraseña', 'new-password'],
                  ['confirmacion', 'Confirmar nueva contraseña', 'new-password'],
                ].map(([field, label, autoComplete]) => (
                  <div className="mb-3" key={field}>
                    <CFormLabel htmlFor={`profile-${field}`}>{label}</CFormLabel>
                    <CFormInput
                      id={`profile-${field}`}
                      type="password"
                      autoComplete={autoComplete}
                      required
                      minLength={field === 'actual' ? undefined : 12}
                      value={passwords[field]}
                      disabled={!!busy}
                      onChange={(event) =>
                        setPasswords((previous) => ({ ...previous, [field]: event.target.value }))
                      }
                    />
                  </div>
                ))}
                <CButton type="submit" color="primary" disabled={!!busy}>
                  {busy === 'password' && <CSpinner size="sm" className="me-2" />}
                  {busy === 'password' ? 'Actualizando…' : 'Cambiar contraseña'}
                </CButton>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}
export default MyProfile
