import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CBadge,
  CButton,
  CFormInput,
  CFormSelect,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { dateTime } from './cashModel'
import { money } from '../sales/saleModel'
import { filterCashSessions } from './cashSessionModel'

const CashSessions = ({ sessions, busy, onSelect }) => {
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const filtered = filterCashSessions(sessions, query, state)
  return (
    <section aria-label="Sesiones consultadas">
      <h3 className="h5">Sesiones consultadas durante esta visita</h3>
      <p className="small text-body-secondary">
        Solo incluye sesiones abiertas o consultadas aquí. La API no permite listar el historial
        completo ni detectar automáticamente tu sesión actual. Se pierde al recargar la página.
      </p>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <CFormInput
          id="cash-session-search"
          label="Buscar caja, sucursal, cajero o sesión"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <CFormSelect
          id="cash-session-state"
          label="Estado de sesiones consultadas"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">Todas</option>
          <option>ABIERTA</option>
          <option>CERRADA</option>
        </CFormSelect>
        <CButton
          size="sm"
          color="secondary"
          variant="outline"
          onClick={() => {
            setQuery('')
            setState('')
          }}
        >
          Limpiar filtros de sesiones
        </CButton>
      </div>
      <CTable responsive hover align="middle">
        <CTableHead>
          <CTableRow>
            {[
              'Caja / sucursal',
              'Apertura / cajero',
              'Estado',
              'Inicial NIO',
              'Cierre / cajero',
              'Esperado / contado / diferencia NIO',
              'Acción',
            ].map((h) => (
              <CTableHeaderCell scope="col" key={h}>
                {h}
              </CTableHeaderCell>
            ))}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {filtered.map((s) => (
            <CTableRow key={s.id_sesion_caja}>
              <CTableDataCell>
                {s.codigo_caja} · {s.caja}
                <div>{s.sucursal}</div>
                <div className="small text-body-secondary">Sesión #{s.id_sesion_caja}</div>
              </CTableDataCell>
              <CTableDataCell>
                {dateTime(s.fecha_apertura)}
                <div>{s.usuario_apertura}</div>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={s.estado === 'ABIERTA' ? 'success' : 'secondary'}>{s.estado}</CBadge>
              </CTableDataCell>
              <CTableDataCell>{money(s.monto_apertura)}</CTableDataCell>
              <CTableDataCell>
                {s.estado === 'CERRADA' ? (
                  <>
                    {dateTime(s.fecha_cierre)}
                    <div>{s.usuario_cierre}</div>
                  </>
                ) : (
                  '—'
                )}
              </CTableDataCell>
              <CTableDataCell>
                {s.estado === 'CERRADA'
                  ? [s.monto_cierre_sistema, s.monto_cierre_real, s.diferencia]
                      .map((v) => (v == null ? 'No disponible' : money(v)))
                      .join(' / ')
                  : 'Disponible al cerrar'}
              </CTableDataCell>
              <CTableDataCell>
                <CButton
                  size="sm"
                  color="primary"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onSelect(s.id_sesion_caja)}
                >
                  Consultar detalle
                </CButton>
              </CTableDataCell>
            </CTableRow>
          ))}
          {!filtered.length && (
            <CTableRow>
              <CTableDataCell colSpan={7}>
                {sessions.length ? 'No hay coincidencias.' : 'Todavía no hay sesiones consultadas.'}
              </CTableDataCell>
            </CTableRow>
          )}
        </CTableBody>
      </CTable>
      <p className="small text-body-secondary">
        Datos de la última consulta de cada sesión; pulsa Consultar detalle para actualizarlos.
      </p>
    </section>
  )
}
CashSessions.propTypes = {
  sessions: PropTypes.array.isRequired,
  busy: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
}
export default CashSessions
