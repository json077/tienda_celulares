import React from 'react'
import PropTypes from 'prop-types'
import {
  CBadge,
  CButton,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { can, canManage, canRoles, canState, sameId } from './userModel'

export const roleNames = (user) =>
  user.roles.map((r) => `${r.nombre}${r.activo === 1 ? '' : ' (inactivo)'}`).join(', ') ||
  'Sin roles'

const UserTable = ({ users, actor, busy, onOpen }) => (
  <CTable responsive hover align="middle">
    <CTableHead>
      <CTableRow>
        {['Nombre', 'Usuario', 'Correo', 'Estado', 'Roles asignados', 'Acciones'].map((text) => (
          <CTableHeaderCell scope="col" key={text}>
            {text}
          </CTableHeaderCell>
        ))}
      </CTableRow>
    </CTableHead>
    <CTableBody>
      {users.map((user) => (
        <CTableRow key={user.id_usuario}>
          <CTableDataCell>{`${user.nombres} ${user.apellidos}`}</CTableDataCell>
          <CTableDataCell>
            {user.username}
            {sameId(actor.id_usuario, user.id_usuario) && (
              <div className="small text-body-secondary">Tu usuario</div>
            )}
          </CTableDataCell>
          <CTableDataCell>{user.email}</CTableDataCell>
          <CTableDataCell>
            <CBadge color={user.activo === 1 ? 'success' : 'secondary'}>
              {user.activo === 1 ? 'Activo' : 'Inactivo'}
            </CBadge>
          </CTableDataCell>
          <CTableDataCell>{roleNames(user)}</CTableDataCell>
          <CTableDataCell>
            <div className="d-flex flex-wrap gap-2">
              <CButton
                size="sm"
                color="primary"
                variant="outline"
                disabled={busy}
                onClick={() => onOpen('detail', user)}
              >
                Ver detalle
              </CButton>
              {can(actor, 'USUARIO_EDITAR') && canManage(actor, user) && (
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onOpen('edit', user)}
                >
                  Editar
                </CButton>
              )}
              {canRoles(actor, user) && (
                <CButton
                  size="sm"
                  color="primary"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onOpen('roles', user)}
                >
                  Asignar roles
                </CButton>
              )}
              {canState(actor, user) && (
                <CButton
                  size="sm"
                  color={user.activo === 1 ? 'danger' : 'success'}
                  variant="outline"
                  disabled={busy}
                  onClick={() => onOpen('state', user)}
                >
                  {user.activo === 1 ? 'Desactivar' : 'Activar'}
                </CButton>
              )}
            </div>
          </CTableDataCell>
        </CTableRow>
      ))}
      {!users.length && (
        <CTableRow>
          <CTableDataCell colSpan={6} className="text-center py-4">
            No hay usuarios para estos filtros.
          </CTableDataCell>
        </CTableRow>
      )}
    </CTableBody>
  </CTable>
)
UserTable.propTypes = {
  users: PropTypes.array.isRequired,
  actor: PropTypes.object.isRequired,
  busy: PropTypes.bool.isRequired,
  onOpen: PropTypes.func.isRequired,
}
export default UserTable
