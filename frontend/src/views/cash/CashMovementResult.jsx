import React from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { dateTime } from './cashModel'
import { money } from '../sales/saleModel'

const CashMovementResult = ({ result }) => {
  const m = result.movimiento
  return (
    <section aria-label="Último movimiento manual registrado">
      <h3 className="h6">Último movimiento manual registrado</h3>
      <CTable responsive>
        <CTableHead>
          <CTableRow>
            {['Fecha', 'Tipo / sentido', 'Concepto', 'Referencia', 'Monto NIO', 'Usuario'].map(
              (h) => (
                <CTableHeaderCell scope="col" key={h}>
                  {h}
                </CTableHeaderCell>
              ),
            )}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow>
            <CTableDataCell>{dateTime(m.fecha)}</CTableDataCell>
            <CTableDataCell>
              <CBadge color={m.tipo === 'INGRESO' ? 'success' : 'warning'}>
                {m.tipo === 'INGRESO' ? 'ENTRADA / INGRESO' : 'SALIDA / EGRESO'}
              </CBadge>
            </CTableDataCell>
            <CTableDataCell className="text-break">{m.concepto}</CTableDataCell>
            <CTableDataCell>
              {m.tipo_referencia || '—'}
              {m.id_referencia != null ? ` · ${m.id_referencia}` : ''}
            </CTableDataCell>
            <CTableDataCell>C$ {money(m.monto)}</CTableDataCell>
            <CTableDataCell>{m.usuario}</CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
      <CAlert color="info">
        Saldo anterior: C$ {money(result.saldo_anterior)} · Saldo posterior según servidor: C${' '}
        {money(result.saldo_actual)}. Corresponde al instante de ese movimiento; no es un saldo
        actualizado ni un historial completo.
      </CAlert>
    </section>
  )
}
CashMovementResult.propTypes = { result: PropTypes.object.isRequired }
export default CashMovementResult
