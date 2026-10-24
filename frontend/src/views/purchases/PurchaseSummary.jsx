import React from 'react'
import PropTypes from 'prop-types'
import {
  CBadge,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  formatAmount,
  formatPurchaseDate,
  purchaseStateColor,
  purchaseStateLabel,
} from './purchaseModel'

const PurchaseSummary = ({ purchase }) => (
  <>
    <CRow className="g-3 mb-3">
      <CCol sm={6}>
        <strong>Documento:</strong> {purchase.numero_documento}
      </CCol>
      <CCol sm={6}>
        {purchase.estado && (
          <CBadge color={purchaseStateColor(purchase.estado)}>
            {purchaseStateLabel(purchase.estado)}
          </CBadge>
        )}
      </CCol>
      <CCol sm={6}>
        <strong>Proveedor:</strong> {purchase.proveedor}
      </CCol>
      <CCol sm={6}>
        <strong>Sucursal:</strong> {purchase.sucursal || `ID ${purchase.id_sucursal}`}
      </CCol>
      {purchase.fecha && (
        <CCol sm={6}>
          <strong>Fecha:</strong> {formatPurchaseDate(purchase.fecha)}
        </CCol>
      )}
      {purchase.usuario && (
        <CCol sm={6}>
          <strong>Usuario:</strong> {purchase.usuario}
        </CCol>
      )}
    </CRow>
    <CTable responsive bordered align="middle">
      <CTableHead>
        <CTableRow>
          {[
            'Producto / SKU',
            'Control',
            'Cantidad',
            'Costo unitario',
            'Descuento',
            'Impuesto',
            'Subtotal',
          ].map((label) => (
            <CTableHeaderCell scope="col" key={label}>
              {label}
            </CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {purchase.detalles.map((line, index) => (
          <CTableRow key={line.id_detalle_compra ?? index}>
            <CTableDataCell>
              {line.producto}
              <div className="small text-body-secondary">{line.sku}</div>
            </CTableDataCell>
            <CTableDataCell>
              {line.tipo_control === 'SERIALIZADO' ? 'Serializado' : 'Cantidad'}
            </CTableDataCell>
            <CTableDataCell>{line.cantidad}</CTableDataCell>
            <CTableDataCell>{formatAmount(line.costo_unitario)}</CTableDataCell>
            <CTableDataCell>{formatAmount(line.descuento)}</CTableDataCell>
            <CTableDataCell>{formatAmount(line.impuesto)}</CTableDataCell>
            <CTableDataCell>{formatAmount(line.subtotal)}</CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
    <div className="d-flex flex-wrap justify-content-end gap-4 my-3" aria-live="polite">
      <span>Bruto: {formatAmount(purchase.subtotal)}</span>
      <span>Descuento: {formatAmount(purchase.descuento)}</span>
      <span>Impuesto: {formatAmount(purchase.impuesto)}</span>
      <strong>Total: {formatAmount(purchase.total)}</strong>
    </div>
    {purchase.observacion && (
      <p className="text-break">
        <strong>Observación:</strong> {purchase.observacion}
      </p>
    )}
  </>
)

PurchaseSummary.propTypes = { purchase: PropTypes.object.isRequired }

export default PurchaseSummary
