import React from 'react'
import PropTypes from 'prop-types'
import { CBadge } from '@coreui/react'
import { money } from '../sales/saleModel'
import { dateTime } from './cashModel'

const CashDetail = ({ session }) => (
  <section aria-label="Detalle de sesión">
    <h4>
      Sesión #{session.id_sesion_caja} · {session.caja}{' '}
      <CBadge color={session.estado === 'ABIERTA' ? 'success' : 'secondary'}>
        {session.estado}
      </CBadge>
    </h4>
    <p>
      Sucursal: {session.sucursal} · Caja: {session.codigo_caja}
    </p>
    <p>
      Apertura: {dateTime(session.fecha_apertura)} · Usuario: {session.usuario_apertura} · Monto
      inicial: C$ {money(session.monto_apertura)}
    </p>
    {session.observacion_apertura && <p>Observación de apertura: {session.observacion_apertura}</p>}
    {session.estado === 'CERRADA' && (
      <>
        <p>
          Cierre: {dateTime(session.fecha_cierre)} · Usuario: {session.usuario_cierre}
        </p>
        <p>
          Monto esperado:{' '}
          {session.monto_cierre_sistema == null
            ? 'No disponible'
            : `C$ ${money(session.monto_cierre_sistema)}`}{' '}
          · Monto contado:{' '}
          {session.monto_cierre_real == null
            ? 'No disponible'
            : `C$ ${money(session.monto_cierre_real)}`}{' '}
          · Diferencia:{' '}
          {session.diferencia == null ? 'No disponible' : `C$ ${money(session.diferencia)}`}
        </p>
        {session.observacion_cierre && <p>Observación de cierre: {session.observacion_cierre}</p>}
      </>
    )}
    <p className="text-body-secondary">
      La API actual no expone movimientos ni totales de la sesión abierta. El monto esperado y la
      diferencia se reciben del servidor al cerrar.
    </p>
  </section>
)
CashDetail.propTypes = { session: PropTypes.object.isRequired }
export default CashDetail
