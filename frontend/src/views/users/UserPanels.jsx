import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CModalBody, CModalFooter } from '@coreui/react'
import { RoleChoices } from './UserForm'
import { roleNames } from './UserTable'
import { validateRoles } from './userModel'

export const UserDetail = ({ user }) => (
  <CModalBody>
    <dl className="row mb-0">
      {[
        ['Nombre', `${user.nombres} ${user.apellidos}`],
        ['Usuario', user.username],
        ['Correo', user.email],
        ['Estado', user.activo === 1 ? 'Activo' : 'Inactivo'],
        ['Roles asignados', roleNames(user)],
      ].map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="col-sm-4">{label}</dt>
          <dd className="col-sm-8">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  </CModalBody>
)
UserDetail.propTypes = { user: PropTypes.object.isRequired }

export const UserState = ({ user, saving, error, onConfirm, onCancel }) => (
  <>
    <CModalBody>
      {error && (
        <CAlert color="danger" role="alert">
          {error}
        </CAlert>
      )}
      <p>
        ¿Confirmas {user.activo === 1 ? 'desactivar' : 'activar'} a <strong>{user.username}</strong>
        ?
      </p>
      {user.activo === 1 && (
        <p>El usuario perderá el acceso al sistema en su siguiente solicitud.</p>
      )}
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" disabled={saving} onClick={onCancel}>
        Cancelar
      </CButton>
      <CButton
        color={user.activo === 1 ? 'danger' : 'success'}
        disabled={saving}
        onClick={() => onConfirm({})}
      >
        {saving
          ? 'Guardando...'
          : user.activo === 1
            ? 'Confirmar desactivación'
            : 'Confirmar activación'}
      </CButton>
    </CModalFooter>
  </>
)
UserState.propTypes = {
  user: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export const UserRoles = ({ user, catalog, saving, error, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState(
    user.roles.filter((r) => catalog.some((c) => c.id_rol === r.id_rol)).map((r) => r.id_rol),
  )
  const [confirming, setConfirming] = useState(false)
  const [validation, setValidation] = useState('')
  const confirm = () => {
    const message = validateRoles({ roles: selected }, catalog)
    setValidation(message)
    if (message) return
    if (!confirming) setConfirming(true)
    else onConfirm({ roles: selected })
  }
  return (
    <>
      <CModalBody>
        {(validation || error) && (
          <CAlert color="danger" role="alert">
            {validation || error}
          </CAlert>
        )}
        <p>
          Usuario: <strong>{user.username}</strong>
        </p>
        <p>Roles actuales: {roleNames(user)}</p>
        <RoleChoices
          catalog={catalog}
          selected={selected}
          onChange={setSelected}
          disabled={saving || confirming}
        />
        {user.roles.some((r) => !catalog.some((c) => c.id_rol === r.id_rol)) && (
          <CAlert color="warning">
            Los roles actuales que ya no están disponibles se retirarán al confirmar.
          </CAlert>
        )}
        {confirming && (
          <CAlert color="warning" role="status">
            Confirma los nuevos roles:{' '}
            {catalog
              .filter((r) => selected.includes(r.id_rol))
              .map((r) => r.nombre)
              .join(', ') || 'Sin roles'}
            . Esta selección reemplazará todos los roles asignados.
          </CAlert>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" disabled={saving} onClick={onCancel}>
          Cancelar
        </CButton>
        {confirming && (
          <CButton color="secondary" disabled={saving} onClick={() => setConfirming(false)}>
            Volver a seleccionar
          </CButton>
        )}
        <CButton color="primary" disabled={saving} onClick={confirm}>
          {saving ? 'Guardando...' : confirming ? 'Confirmar roles' : 'Revisar cambios'}
        </CButton>
      </CModalFooter>
    </>
  )
}
UserRoles.propTypes = { ...UserState.propTypes, catalog: PropTypes.array.isRequired }
