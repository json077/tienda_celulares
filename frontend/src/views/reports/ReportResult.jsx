import React from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CCard,
  CCardBody,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { MetricCards } from '../../components/management/ManagementUI'

export const reportValue = (value, type) =>
  ['number', 'money'].includes(type)
    ? Number(value).toLocaleString('es-NI', {
        minimumFractionDigits: type === 'money' ? 2 : 0,
        maximumFractionDigits: 2,
      })
    : value

const ReportResult = ({ data }) => (
  <section aria-label={data.title}>
    <MetricCards items={data.totals} />
    <CCard className="management-panel mb-4">
      <CCardBody>
        <h2 className="h5 mb-3">{data.title}</h2>
        <CAlert color="info">{data.note}</CAlert>
        <p className="text-body-secondary">
          Generado: {new Date(data.generatedAt).toLocaleString('es-NI')} · Fechas del reporte según
          el registro de la base de datos.
        </p>
        <p>
          Filtros aplicados:{' '}
          {Object.entries(data.filters)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' · ') || 'Todas las sucursales autorizadas, sin filtros adicionales'}
        </p>
        <CTable responsive striped hover className="management-table mb-0">
          <CTableHead>
            <CTableRow>
              {data.columns.map((c) => (
                <CTableHeaderCell key={c.key} scope="col">
                  {c.label}
                </CTableHeaderCell>
              ))}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {data.rows.map((row, index) => (
              <CTableRow key={index}>
                {data.columns.map((c) => (
                  <CTableDataCell
                    key={c.key}
                    className={['money', 'number'].includes(c.type) ? 'text-end text-nowrap' : ''}
                  >
                    {reportValue(row[c.key], c.type)}
                  </CTableDataCell>
                ))}
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
        {!data.rows.length && (
          <div className="management-empty mt-3">
            <p className="fw-semibold mb-1">
              No hay resultados para los filtros y sucursales autorizadas.
            </p>
            <p className="small text-body-secondary mb-0">
              Revisa el período o selecciona otra sucursal autorizada y vuelve a consultar.
            </p>
          </div>
        )}
      </CCardBody>
    </CCard>
  </section>
)
ReportResult.propTypes = { data: PropTypes.object.isRequired }
export default ReportResult
