import React from 'react'
import CIcon from '@coreui/icons-react'
import { CNavItem } from '@coreui/react'
import { modules } from './config/modules'
import { canAccessModule } from './auth/permissions'

export const navigationFor = (can) =>
  modules
    .filter((module) => canAccessModule(can, module))
    .map(({ path, name, icon }) => ({
      component: CNavItem,
      name,
      to: path,
      icon: <CIcon icon={icon} customClassName="nav-icon" />,
    }))

export default navigationFor
