import React from 'react'
import PropTypes from 'prop-types'
import {
  CBadge,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { dateTime } from '../cash/cashModel'
import { money } from '../sales/saleModel'

export const ReturnFinancialNotice = () => (
  <p className="text-body-secondary">
    Esta devolución no reembolsa dinero ni ajusta pagos, caja, saldo de crédito o cuotas. El total
    devuelto es una valoración del servidor, no un reembolso confirmado.
  </p>
)

const ReturnDetail = ({ record, header = {} }) => (
  <section aria-label="Detalle de devolución">
    <h2 className="h5">
      {record.numero_devolucion}{' '}
      <CBadge
        color={
          record.estado === 'BORRADOR'
            ? 'warning'
            : record.estado === 'CONFIRMADA'
              ? 'success'
              : 'secondary'
        }
      >
        {record.estado}
      </CBadge>
    </h2>
    <p>
      Venta: {header.numero_venta || `Referencia #${record.id_venta}`} · Sucursal:{' '}
      {header.sucursal || `Referencia #${record.id_sucursal}`} · Devolución #{record.id_devolucion}
    </p>
    <p>
      {dateTime(record.fecha)}
      {header.usuario && ` · Registrada por ${header.usuario}`}
    </p>
    <p>Motivo: {record.motivo}</p>
    {record.observacion && <p>Observación: {record.observacion}</p>}
    <p>
      Valoración histórica NIO C$ {money(record.total_devuelto)} (precio unitario vendido ×
      cantidad, sin recalcular descuentos ni impuestos).
    </p>
    <CTable responsive striped>
      <CTableHead>
        <CTableRow>
          {[
            'Producto',
            'Cantidad / IMEI',
            'Condición',
            'Reintegra stock',
            'Precio / subtotal NIO',
            'Motivo del artículo',
          ].map((h) => (
            <CTableHeaderCell scope="col" key={h}>
              {h}
            </CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {record.detalles.map((d, i) => (
          <CTableRow key={d.id_detalle_devolucion || i}>
            <CTableDataCell>
              {d.producto} · {d.tipo_control}
            </CTableDataCell>
            <CTableDataCell>
              {d.cantidad}
              {d.id_unidad != null && (
                <div>
                  IMEI 1: {d.imei1 || '—'} · IMEI 2: {d.imei2 || '—'} · Serie:{' '}
                  {d.numero_serie || '—'}
                </div>
              )}
            </CTableDataCell>
            <CTableDataCell>{d.condicion}</CTableDataCell>
            <CTableDataCell>
              {record.estado === 'ANULADA'
                ? 'No aplicado (anulada)'
                : Number(d.reintegra_inventario) === 1
                  ? record.estado === 'CONFIRMADA'
                    ? 'Sí'
                    : 'Previsto al confirmar'
                  : 'No'}
            </CTableDataCell>
            <CTableDataCell>
              C$ {money(d.precio_unitario)} / C$ {money(d.subtotal)}
            </CTableDataCell>
            <CTableDataCell>{d.motivo || '—'}</CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
    <ReturnFinancialNotice />
  </section>
)
ReturnDetail.propTypes = { record: PropTypes.object.isRequired, header: PropTypes.object }
export default ReturnDetail
