import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CModalBody,
  CModalFooter,
  CRow,
  CSpinner,
} from '@coreui/react'
import { validateUser } from './userModel'

export const RoleChoices = ({ catalog, selected, onChange, disabled }) => (
  <fieldset disabled={disabled} className="mt-3">
    <legend className="h6">Roles disponibles</legend>
    {!catalog.length && <p>No hay roles disponibles para asignar.</p>}
    {catalog.map((role) => (
      <CFormCheck
        key={role.id_rol}
        id={`user-role-${role.id_rol}`}
        label={role.nombre}
        checked={selected.includes(String(role.id_rol))}
        onChange={(event) =>
          onChange(
            event.target.checked
              ? [...selected, String(role.id_rol)]
              : selected.filter((id) => id !== String(role.id_rol)),
          )
        }
      />
    ))}
  </fieldset>
)
RoleChoices.propTypes = {
  catalog: PropTypes.array.isRequired,
  selected: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool.isRequired,
}

const UserForm = ({ user, catalog, saving, error, onSave, onCancel }) => {
  const creating = !user
  const [values, setValues] = useState({
    username: user?.username || '',
    email: user?.email || '',
    nombres: user?.nombres || '',
    apellidos: user?.apellidos || '',
    password: '',
    confirmPassword: '',
    roles: [],
  })
  const [validation, setValidation] = useState('')
  const change = (event) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = (event) => {
    event.preventDefault()
    if (saving) return
    const message = validateUser(values, creating, catalog)
    setValidation(message)
    if (message) return
    const submitted = { ...values, roles: [...values.roles] }
    // Se limpian antes de iniciar la solicitud, también si la API la rechaza.
    setValues((current) => ({ ...current, password: '', confirmPassword: '' }))
    onSave(submitted)
  }
  return (
    <CForm onSubmit={submit} aria-busy={saving}>
      <CModalBody>
        {(validation || error) && (
          <CAlert color="danger" role="alert">
            {validation || error}
          </CAlert>
        )}
        <fieldset disabled={saving}>
          <CRow className="g-3">
            {[
              ['nombres', 'Nombres', 100],
              ['apellidos', 'Apellidos', 100],
              ['username', 'Usuario', 60],
              ['email', 'Correo', 150],
            ].map(([name, label, max]) => (
              <CCol md={6} key={name}>
                <CFormLabel htmlFor={`user-${name}`}>{label} *</CFormLabel>
                <CFormInput
                  id={`user-${name}`}
                  name={name}
                  type={name === 'email' ? 'email' : 'text'}
                  required
                  maxLength={max}
                  value={values[name]}
                  onChange={change}
                  autoComplete="off"
                />
              </CCol>
            ))}
            {creating &&
              ['password', 'confirmPassword'].map((name) => (
                <CCol md={6} key={name}>
                  <CFormLabel htmlFor={`user-${name}`}>
                    {name === 'password' ? 'Contraseña' : 'Confirmar contraseña'} *
                  </CFormLabel>
                  <CFormInput
                    id={`user-${name}`}
                    name={name}
                    type="password"
                    autoComplete="new-password"
                    required
                    value={values[name]}
                    onChange={change}
                  />
                </CCol>
              ))}
          </CRow>
          {creating && (
            <>
              <p className="small text-body-secondary mt-2">
                Contraseña: mínimo 12 caracteres y máximo 72 bytes. El usuario se creará activo.
              </p>
              <RoleChoices
                catalog={catalog}
                selected={values.roles}
                disabled={saving}
                onChange={(roles) => setValues((current) => ({ ...current, roles }))}
              />
            </>
          )}
        </fieldset>
        {!creating && (
          <p className="small text-body-secondary mt-3">
            El estado y los roles se administran desde sus acciones del listado.
          </p>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </CButton>
        <CButton type="submit" color="primary" disabled={saving || (creating && !catalog.length)}>
          {saving && <CSpinner size="sm" className="me-2" />}
          {saving ? 'Guardando...' : creating ? 'Crear usuario' : 'Guardar cambios'}
        </CButton>
      </CModalFooter>
    </CForm>
  )
}
UserForm.propTypes = {
  user: PropTypes.object,
  catalog: PropTypes.array.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}
export default UserForm
