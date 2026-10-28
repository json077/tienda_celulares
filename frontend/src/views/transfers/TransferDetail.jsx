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

const TransferDetail = ({ record }) => (
  <section aria-label="Detalle de transferencia">
    <h2 className="h5">
      {record.numero_transferencia}{' '}
      <CBadge
        color={
          record.estado === 'CONFIRMADA'
            ? 'success'
            : record.estado === 'BORRADOR'
              ? 'warning'
              : 'secondary'
        }
      >
        {record.estado}
      </CBadge>
    </h2>
    <p>
      {record.sucursal_origen} → {record.sucursal_destino} · Referencia #{record.id_transferencia}
    </p>
    <p>
      Solicitada: {dateTime(record.fecha_solicitud)} · {record.usuario_solicita}
    </p>
    {record.fecha_confirmacion && (
      <p>
        Confirmada: {dateTime(record.fecha_confirmacion)} · {record.usuario_confirma}
      </p>
    )}
    {record.observacion && <p>Observación: {record.observacion}</p>}
    <p>
      {record.detalles.length} productos ·{' '}
      {record.detalles.reduce((n, d) => n + Number(d.cantidad), 0)} unidades
    </p>
    <CTable responsive striped>
      <CTableHead>
        <CTableRow>
          {['Producto / SKU', 'Control', 'Cantidad', 'Dispositivos seleccionados'].map((h) => (
            <CTableHeaderCell scope="col" key={h}>
              {h}
            </CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {record.detalles.map((d) => (
          <CTableRow key={d.id_detalle_transferencia || d.id_producto}>
            <CTableDataCell>
              {d.producto} · {d.sku}
            </CTableDataCell>
            <CTableDataCell>{d.tipo_control}</CTableDataCell>
            <CTableDataCell>{d.cantidad}</CTableDataCell>
            <CTableDataCell>
              {d.tipo_control === 'SERIALIZADO' ? (
                <ul className="mb-0">
                  {d.unidades.map((u) => (
                    <li key={u.id_unidad}>
                      IMEI 1: {u.imei1 || '—'} · IMEI 2: {u.imei2 || '—'} · Serie:{' '}
                      {u.numero_serie || '—'} · {u.estado} · Ubicación actual (ID):{' '}
                      {u.id_sucursal_actual}
                    </li>
                  ))}
                </ul>
              ) : (
                'Sin dispositivos serializados'
              )}
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
    <p className="small text-body-secondary">
      El estado y la ubicación de cada dispositivo corresponden a la consulta actual, no a una
      fotografía histórica.
    </p>
  </section>
)
TransferDetail.propTypes = { record: PropTypes.object.isRequired }
export default TransferDetail
