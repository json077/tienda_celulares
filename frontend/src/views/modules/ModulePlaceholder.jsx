import React from 'react'
import { useLocation } from 'react-router-dom'
import { CCard, CCardBody } from '@coreui/react'
import { modules } from '../../config/modules'

const ModulePlaceholder = () => {
  const { pathname } = useLocation()
  const module = modules.find(({ path }) => path === pathname)

  return (
    <CCard className="mb-4">
      <CCardBody>
        <h1 className="h4">{module?.name}</h1>
        <p>
          Este módulo forma parte del sistema de control de inventario y facturación de Tienda
          Celulares.
        </p>
        <p className="text-body-secondary mb-0">Funcionalidad pendiente de implementación.</p>
      </CCardBody>
    </CCard>
  )
}

export default ModulePlaceholder
