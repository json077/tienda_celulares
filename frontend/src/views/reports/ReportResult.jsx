import React from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'

export const reportValue = (value, type) =>
  ['number', 'money'].includes(type)
    ? Number(value).toLocaleString('es-NI', {
        minimumFractionDigits: type === 'money' ? 2 : 0,
        maximumFractionDigits: 2,
      })
    : value

const ReportResult = ({ data }) => (
  <section aria-label={data.title}>
    <h2 className="h5">{data.title}</h2>
    <CAlert color="info">{data.note}</CAlert>
    <p className="text-body-secondary">
      Generado: {new Date(data.generatedAt).toLocaleString('es-NI')} · Fechas del reporte según el
      registro de la base de datos.
    </p>
    <p>
      Filtros aplicados:{' '}
      {Object.entries(data.filters)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · ') || 'Todas las sucursales autorizadas, sin filtros adicionales'}
    </p>
    <dl className="d-flex flex-wrap gap-4">
      {data.totals.map((total) => (
        <div key={total.label}>
          <dt>{total.label}</dt>
          <dd>{reportValue(total.value, total.type)}</dd>
        </div>
      ))}
    </dl>
    <CTable responsive striped bordered>
      <CTableHead>
        <CTableRow>
          {data.columns.map((c) => (
            <CTableHeaderCell key={c.key}>{c.label}</CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {data.rows.map((row, index) => (
          <CTableRow key={index}>
            {data.columns.map((c) => (
              <CTableDataCell key={c.key}>{reportValue(row[c.key], c.type)}</CTableDataCell>
            ))}
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
    {!data.rows.length && <p>No hay resultados para los filtros y sucursales autorizadas.</p>}
  </section>
)
ReportResult.propTypes = { data: PropTypes.object.isRequired }
export default ReportResult
