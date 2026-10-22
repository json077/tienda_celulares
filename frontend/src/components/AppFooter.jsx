import React from 'react'
import { CFooter } from '@coreui/react'

const AppFooter = () => (
  <CFooter className="px-4">
    <span>Tienda Celulares</span>
    <span className="ms-auto">Inventario y Facturación</span>
  </CFooter>
)

export default React.memo(AppFooter)
