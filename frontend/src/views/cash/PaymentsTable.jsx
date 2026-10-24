import React from 'react'
import PropTypes from 'prop-types'
import {
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { money } from '../sales/saleModel'
import { dateTime, paymentBalance } from './cashModel'

const PaymentsTable = ({ payments, sale }) => {
  const balance = paymentBalance(sale, payments)
  if (payments === null) return <p>Pagos no consultados. No se puede determinar el saldo.</p>
  return (
    <>
      <CTable responsive hover>
        <CTableHead>
          <CTableRow>
            {[
              'ID / Fecha',
              'Método / referencia',
              'Moneda',
              'Monto original',
              'Tipo de cambio histórico',
              'Monto base NIO',
              'Estado / sesión / usuario',
            ].map((h) => (
              <CTableHeaderCell key={h}>{h}</CTableHeaderCell>
            ))}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {payments.map((p) => (
            <CTableRow key={p.id_pago}>
              <CTableDataCell>
                {p.id_pago} · {dateTime(p.fecha)}
              </CTableDataCell>
              <CTableDataCell>
                {p.metodo} · {p.referencia || '—'}
              </CTableDataCell>
              <CTableDataCell>{p.moneda}</CTableDataCell>
              <CTableDataCell>{money(p.monto)}</CTableDataCell>
              <CTableDataCell>{p.tipo_cambio}</CTableDataCell>
              <CTableDataCell>{money(p.monto_base)}</CTableDataCell>
              <CTableDataCell>
                {p.estado} · {p.id_sesion_caja || '—'} · {p.usuario}
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
      {!payments.length && <p>No hay pagos registrados.</p>}
      {balance && (
        <p>
          Pagado aplicado: C$ {money(balance.paid)} · Saldo pendiente según pagos consultados: C${' '}
          {money(balance.pending)}. El servidor valida el saldo definitivo.
        </p>
      )}
    </>
  )
}
PaymentsTable.propTypes = { payments: PropTypes.array, sale: PropTypes.object }
export default PaymentsTable
