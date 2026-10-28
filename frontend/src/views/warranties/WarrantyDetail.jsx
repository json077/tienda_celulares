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
import { creditDate } from '../credits/creditModel'
import { dateTime } from '../cash/cashModel'
import { claimTransitions } from './warrantyModel'

export const WarrantyNotice = () => (
  <p className="text-body-secondary">
    Garantías y reclamos no mueven inventario, no cambian el estado de los dispositivos ni generan
    reembolsos o ajustes de crédito.
  </p>
)

export const ClaimDetail = ({ claim }) => (
  <section aria-label="Detalle del reclamo">
    <h3 className="h6">
      Reclamo {claim.numero_reclamo} · {claim.estado}
    </h3>
    <p>
      Referencia #{claim.id_reclamo} · Garantía #{claim.id_garantia} · Sucursal de recepción #
      {claim.id_sucursal}
    </p>
    <p>
      Recibido: {dateTime(claim.fecha_recepcion)} · Usuario receptor #{claim.id_usuario_recibe}
    </p>
    <p>Motivo: {claim.motivo}</p>
    <p>Diagnóstico: {claim.diagnostico || 'Sin diagnóstico'}</p>
    <p>Solución: {claim.solucion || 'Sin solución'}</p>
    {claim.observacion && <p>Observación: {claim.observacion}</p>}
    {claim.fecha_resolucion && (
      <p>
        Resuelto: {dateTime(claim.fecha_resolucion)} · Usuario responsable #
        {claim.id_usuario_resuelve}
      </p>
    )}
  </section>
)
ClaimDetail.propTypes = { claim: PropTypes.object.isRequired }

const WarrantyDetail = ({
  warranty,
  context,
  warning,
  claims,
  busy,
  canClaim,
  canResolve,
  onClaim,
  onSelectClaim,
}) => {
  const line = context?.lines.find(
    (d) => Number(d.id_detalle_venta) === Number(warranty.id_detalle_venta),
  )
  const unit = line?.units.find((u) => Number(u.id_unidad) === Number(warranty.id_unidad))
  return (
    <section aria-label="Detalle de garantía">
      <h2 className="h5">
        Garantía #{warranty.id_garantia}{' '}
        <CBadge color={warranty.estado === 'VIGENTE' ? 'success' : 'secondary'}>
          {warranty.estado}
        </CBadge>
      </h2>
      <p>
        Venta: {context?.sale.numero_venta || `Referencia #${warranty.id_venta}`} ·{' '}
        {context?.sale.cliente || 'Cliente no incluido en la respuesta de garantía'}
      </p>
      <p>
        Artículo:{' '}
        {line
          ? `${line.producto} · ${line.sku}`
          : `Detalle vendido #${warranty.id_detalle_venta} · Producto #${warranty.id_producto}`}
      </p>
      {warranty.id_unidad != null ? (
        <p>
          {unit
            ? `IMEI 1: ${unit.imei1 || '—'} · IMEI 2: ${unit.imei2 || '—'} · Serie: ${unit.numero_serie || '—'}`
            : `Dispositivo asociado #${warranty.id_unidad}. IMEI histórico no disponible en esta consulta.`}
        </p>
      ) : (
        <p>
          Cobertura del detalle por cantidad{line ? `: ${line.cantidad} unidades vendidas` : ''},
          sin identificación individual.
        </p>
      )}
      <p>
        Inicio: {creditDate(warranty.fecha_inicio)} · Fin: {creditDate(warranty.fecha_fin)} · Días
        históricos: {warranty.dias_garantia}
      </p>
      <p className="small text-body-secondary">
        Las fechas y el estado los determina MySQL. El servidor comprueba el intervalo inclusivo de
        cobertura al registrar un reclamo.
      </p>
      {warning && <p role="status">{warning}</p>}
      {context?.warning && <p role="status">{context.warning}</p>}
      <WarrantyNotice />
      <h3 className="h6">Reclamos de esta garantía</h3>
      {claims === null ? (
        <p>No se pudo verificar la lista de reclamos. Actualiza antes de registrar otro.</p>
      ) : (
        <>
          <CTable responsive hover>
            <CTableHead>
              <CTableRow>
                {['Número', 'Recepción', 'Motivo', 'Estado / solución', 'Acción'].map((h) => (
                  <CTableHeaderCell key={h} scope="col">
                    {h}
                  </CTableHeaderCell>
                ))}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {claims.map((c) => (
                <CTableRow key={c.id_reclamo}>
                  <CTableDataCell>{c.numero_reclamo}</CTableDataCell>
                  <CTableDataCell>{dateTime(c.fecha_recepcion)}</CTableDataCell>
                  <CTableDataCell>{c.motivo}</CTableDataCell>
                  <CTableDataCell>
                    {c.estado} · {c.solucion || 'Sin solución'}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton
                      color="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => onSelectClaim(c)}
                    >
                      Consultar
                      {canResolve && claimTransitions[c.estado]?.length ? ' / procesar' : ''}
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {!claims.length && (
                <CTableRow>
                  <CTableDataCell colSpan={5}>No hay reclamos registrados.</CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </>
      )}
      <CButton color="primary" disabled={busy || !canClaim} onClick={onClaim}>
        Registrar reclamo
      </CButton>
    </section>
  )
}
WarrantyDetail.propTypes = {
  warranty: PropTypes.object.isRequired,
  context: PropTypes.object,
  warning: PropTypes.string,
  claims: PropTypes.array,
  busy: PropTypes.bool.isRequired,
  canClaim: PropTypes.bool.isRequired,
  canResolve: PropTypes.bool.isRequired,
  onClaim: PropTypes.func.isRequired,
  onSelectClaim: PropTypes.func.isRequired,
}
export default WarrantyDetail
