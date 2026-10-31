import React from 'react'
import PropTypes from 'prop-types'
import { CIcon } from '@coreui/icons-react'
import { CCard, CCardBody, CCol, CRow } from '@coreui/react'
import './management.css'

export const managementNumber = (value, money = false) =>
  `${money ? 'C$ ' : ''}${Number(value).toLocaleString('es-NI', {
    minimumFractionDigits: money ? 2 : 0,
    maximumFractionDigits: 2,
  })}`

export const PageHeading = ({ title, description, icon }) => (
  <header className="management-heading mb-4">
    <span className="management-heading-icon">
      <CIcon icon={icon} size="xl" />
    </span>
    <div>
      <p className="management-eyebrow mb-1">TIENDA CELULARES · GESTIÓN</p>
      <h1 className="h3 mb-2">{title}</h1>
      <p className="text-body-secondary mb-0">{description}</p>
    </div>
  </header>
)
PageHeading.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.array.isRequired,
}

export const MetricCards = ({ items }) => (
  <CRow className="g-3 mb-4">
    {items.map((item, index) => (
      <CCol xs={12} sm={6} xl={3} key={item.label}>
        <CCard className={`management-metric management-accent-${index % 4} h-100`}>
          <CCardBody>
            <p className="small text-body-secondary mb-2">{item.label}</p>
            <p className="management-metric-value mb-1">
              {managementNumber(item.value, item.type === 'money')}
            </p>
            {item.note && <p className="small text-body-secondary mb-0">{item.note}</p>}
          </CCardBody>
        </CCard>
      </CCol>
    ))}
  </CRow>
)
MetricCards.propTypes = { items: PropTypes.array.isRequired }
