import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import { cilAccountLogout, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../contexts/AuthContext'

const AppHeaderDropdown = () => {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const fullName = [usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ').trim()
  const name = fullName || usuario?.username || 'Usuario'
  const roles = usuario?.roles?.join(', ') || 'Sin roles asignados'

  const handleLogout = () => {
    logout()
    navigate('/authentication/login', { replace: true })
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle aria-label={`Menú de usuario: ${name}`}>
        <CIcon icon={cilUser} className="me-2" />
        <span className="d-none d-md-inline">{usuario?.username || name}</span>
      </CDropdownToggle>
      <CDropdownMenu placement="bottom-end">
        <CDropdownHeader className="text-wrap" style={{ maxWidth: '18rem' }}>
          <div className="fw-semibold">{name}</div>
          {fullName && <div className="small text-body-secondary">{usuario?.username}</div>}
          <div className="small text-body-secondary">Roles: {roles}</div>
        </CDropdownHeader>
        <CDropdownDivider />
        <CDropdownItem as="button" type="button" onClick={handleLogout}>
          <CIcon icon={cilAccountLogout} className="me-2" />
          Cerrar sesión
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown
