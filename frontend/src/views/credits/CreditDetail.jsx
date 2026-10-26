import React from 'react'
import PropTypes from 'prop-types'
import {
  CBadge,
  CButton,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { money, creditDate, stateColor, canPay } from './creditModel'

export const CreditTable = ({ rows, busy, onOpen }) => (
  <CTable responsive hover align="middle">
    <CTableHead>
      <CTableRow>
        {[
          'Cliente / venta',
          'Financiado',
          'Interés',
          'Total',
          'Saldo',
          'Plan / inicio',
          'Estado',
          'Acciones',
        ].map((h) => (
          <CTableHeaderCell scope="col" key={h}>
            {h}
          </CTableHeaderCell>
        ))}
      </CTableRow>
    </CTableHead>
    <CTableBody>
      {rows.map((c) => (
        <CTableRow key={c.id_credito}>
          <CTableDataCell>
            <div>{c.cliente}</div>
            <div className="small text-body-secondary">
              {c.numero_venta} · {c.identificacion || 'Sin identificación'}
            </div>
          </CTableDataCell>
          <CTableDataCell>{money(c.monto_financiado)}</CTableDataCell>
          <CTableDataCell>
            {c.tasa_interes}% · {money(c.monto_interes)}
          </CTableDataCell>
          <CTableDataCell>{money(c.monto_total)}</CTableDataCell>
          <CTableDataCell>{money(c.saldo_pendiente)}</CTableDataCell>
          <CTableDataCell>
            {c.numero_cuotas} cuotas · {c.frecuencia}
            <div>{creditDate(c.fecha_inicio)}</div>
          </CTableDataCell>
          <CTableDataCell>
            <CBadge color={stateColor(c.estado)}>{c.estado}</CBadge>
          </CTableDataCell>
          <CTableDataCell>
            <CButton
              size="sm"
              color="primary"
              variant="outline"
              disabled={busy}
              onClick={() => onOpen(c)}
              aria-label={`Ver crédito de ${c.cliente}, venta ${c.numero_venta}`}
            >
              Ver detalle
            </CButton>
          </CTableDataCell>
        </CTableRow>
      ))}
      {!rows.length && (
        <CTableRow>
          <CTableDataCell colSpan={8}>No hay créditos para mostrar.</CTableDataCell>
        </CTableRow>
      )}
    </CTableBody>
  </CTable>
)
CreditTable.propTypes = {
  rows: PropTypes.array.isRequired,
  busy: PropTypes.bool.isRequired,
  onOpen: PropTypes.func.isRequired,
}

const CreditDetail = ({ credit, payments, historyError, busy, onPay }) => (
  <>
    <h2 className="h5">
      {credit.cliente} · {credit.numero_venta}
    </h2>
    <p>
      {credit.identificacion || 'Sin identificación'} · Venta {credit.tipo_venta} /{' '}
      {credit.estado_venta} · <CBadge color={stateColor(credit.estado)}>{credit.estado}</CBadge>
    </p>
    <p>
      Financiado: {money(credit.monto_financiado)} · Interés: {credit.tasa_interes}% (
      {money(credit.monto_interes)})
    </p>
    <p>
      Total crédito: {money(credit.monto_total)} · Saldo pendiente:{' '}
      <strong>{money(credit.saldo_pendiente)}</strong> · Total venta: {money(credit.total_venta)}
    </p>
    <p>
      {credit.numero_cuotas} cuotas · {credit.frecuencia} · Inicio:{' '}
      {creditDate(credit.fecha_inicio)} · Registrado: {creditDate(credit.created_at)}
    </p>
    {credit.observacion && <p className="text-break">{credit.observacion}</p>}
    <h3 className="h6">Cuotas</h3>
    <CTable responsive align="middle">
      <CTableHead>
        <CTableRow>
          {['Cuota', 'Vencimiento', 'Monto', 'Pagado', 'Saldo', 'Estado', 'Acción'].map((h) => (
            <CTableHeaderCell scope="col" key={h}>
              {h}
            </CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {credit.cuotas.map((q) => (
          <CTableRow key={q.id_cuota}>
            <CTableDataCell>{q.numero_cuota}</CTableDataCell>
            <CTableDataCell>{creditDate(q.fecha_vencimiento)}</CTableDataCell>
            <CTableDataCell>{money(q.monto_cuota)}</CTableDataCell>
            <CTableDataCell>{money(q.monto_pagado)}</CTableDataCell>
            <CTableDataCell>{money(q.saldo_cuota)}</CTableDataCell>
            <CTableDataCell>
              <CBadge color={stateColor(q.estado)}>{q.estado}</CBadge>
            </CTableDataCell>
            <CTableDataCell>
              {canPay(credit, q) && (
                <CButton color="primary" size="sm" disabled={busy} onClick={() => onPay(q)}>
                  Abonar cuota {q.numero_cuota}
                </CButton>
              )}
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
    {!credit.cuotas.length && <p>No hay cuotas disponibles.</p>}
    <h3 className="h6">Pagos de la venta asociada</h3>
    <p className="small text-body-secondary">
      Incluye los pagos de la venta. La API no identifica aquí la cuota de cada abono; el saldo del
      crédito es el informado arriba por el servidor.
    </p>
    {historyError && (
      <p role="alert" className="text-danger">
        {historyError}
      </p>
    )}
    {payments === null ? (
      <p>Historial no disponible.</p>
    ) : (
      <>
        <CTable responsive>
          <CTableHead>
            <CTableRow>
              {[
                'Fecha',
                'Método / referencia',
                'Monto original',
                'Tasa histórica',
                'Monto NIO',
                'Estado / usuario',
              ].map((h) => (
                <CTableHeaderCell key={h} scope="col">
                  {h}
                </CTableHeaderCell>
              ))}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {payments.map((p) => (
              <CTableRow key={p.id_pago}>
                <CTableDataCell>{creditDate(p.fecha)}</CTableDataCell>
                <CTableDataCell>
                  {p.metodo} · {p.referencia || '—'}
                </CTableDataCell>
                <CTableDataCell>
                  {p.moneda} {Number(p.monto).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                </CTableDataCell>
                <CTableDataCell>{p.tipo_cambio}</CTableDataCell>
                <CTableDataCell>{money(p.monto_base)}</CTableDataCell>
                <CTableDataCell>
                  {p.estado} · {p.usuario}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
        {!payments.length && <p>No hay pagos registrados en la venta.</p>}
      </>
    )}
  </>
)
CreditDetail.propTypes = {
  credit: PropTypes.object.isRequired,
  payments: PropTypes.array,
  historyError: PropTypes.string.isRequired,
  busy: PropTypes.bool.isRequired,
  onPay: PropTypes.func.isRequired,
}
export default CreditDetail
