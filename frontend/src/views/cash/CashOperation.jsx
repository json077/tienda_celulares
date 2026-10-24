import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CFormCheck,
} from '@coreui/react'
import { validateCash } from './cashModel'

const CashOperation = ({ mode, boxes, session, busy, onSave }) => {
  const [values, setValues] = useState({
    id_caja: '',
    monto_apertura: '0',
    monto_cierre_real: '',
    observacion: '',
    tipo: 'INGRESO',
    monto: '',
    concepto: '',
  })
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const change = (e) => {
    setChecked(false)
    setValues({ ...values, [e.target.name]: e.target.value })
  }
  return (
    <CForm
      onSubmit={(e) => {
        e.preventDefault()
        try {
          validateCash(mode, values, session, boxes)
          if (checked) {
            setChecked(false)
            onSave(values)
          }
        } catch (err) {
          setError(err.message)
        }
      }}
    >
      {error && <CAlert color="danger">{error}</CAlert>}
      <fieldset disabled={busy}>
        {mode === 'open' && (
          <>
            <CFormSelect
              className="mb-3"
              label="Caja / sucursal"
              name="id_caja"
              value={values.id_caja}
              onChange={change}
              required
            >
              <option value="">Selecciona caja activa</option>
              {boxes
                .filter((b) => Number(b.activo) === 1)
                .map((b) => (
                  <option
                    key={b.id_caja}
                    value={b.id_caja}
                    disabled={
                      session?.estado === 'ABIERTA' && Number(session.id_caja) === Number(b.id_caja)
                    }
                  >
                    {b.codigo} · {b.nombre} · {b.sucursal}
                  </option>
                ))}
            </CFormSelect>
            <CFormInput
              className="mb-3"
              label="Monto inicial NIO"
              name="monto_apertura"
              type="number"
              min="0"
              step="0.01"
              value={values.monto_apertura}
              onChange={change}
              required
            />
          </>
        )}
        {mode === 'close' && (
          <>
            <p>
              Se cerrará la sesión #{session?.id_sesion_caja}. Después no admitirá cobros en
              efectivo ni movimientos. El servidor calculará el monto esperado y la diferencia.
            </p>
            <CFormInput
              className="mb-3"
              label="Monto contado NIO"
              name="monto_cierre_real"
              type="number"
              min="0"
              step="0.01"
              value={values.monto_cierre_real}
              onChange={change}
              required
            />
          </>
        )}
        {mode === 'movement' ? (
          <>
            <CFormSelect
              className="mb-3"
              label="Tipo"
              name="tipo"
              value={values.tipo}
              onChange={change}
            >
              <option>INGRESO</option>
              <option>EGRESO</option>
            </CFormSelect>
            <CFormInput
              className="mb-3"
              label="Monto NIO"
              type="number"
              name="monto"
              min="0.01"
              step="0.01"
              value={values.monto}
              onChange={change}
              required
            />
            <CFormInput
              className="mb-3"
              label="Concepto"
              name="concepto"
              maxLength={255}
              value={values.concepto}
              onChange={change}
              required
            />
          </>
        ) : (
          <CFormTextarea
            className="mb-3"
            label="Observación"
            name="observacion"
            maxLength={500}
            value={values.observacion}
            onChange={change}
          />
        )}
        <CFormCheck
          className="mb-3"
          label="Revisé los datos y confirmo la operación"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <CButton
          type="submit"
          color={mode === 'close' ? 'danger' : 'primary'}
          disabled={busy || !checked}
        >
          {busy
            ? 'Procesando…'
            : { open: 'Abrir caja', close: 'Cerrar caja', movement: 'Registrar movimiento' }[mode]}
        </CButton>
      </fieldset>
    </CForm>
  )
}
CashOperation.propTypes = {
  mode: PropTypes.string.isRequired,
  boxes: PropTypes.array.isRequired,
  session: PropTypes.object,
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}
export default CashOperation
