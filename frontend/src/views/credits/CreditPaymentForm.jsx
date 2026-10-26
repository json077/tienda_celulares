import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CForm, CFormCheck, CFormInput, CFormSelect } from '@coreui/react'
import { money, positiveId, validateInstallment } from './creditModel'

const CreditPaymentForm = ({
  credit,
  quota,
  sale,
  rate,
  session,
  busy,
  error,
  warning,
  onConsult,
  onSave,
  onCancel,
}) => {
  const [values, setValues] = useState({
    metodo: 'EFECTIVO',
    id_moneda: '',
    id_sesion_caja: '',
    monto: '',
    referencia: '',
  })
  const [confirmed, setConfirmed] = useState(false)
  const [validation, setValidation] = useState('')
  const change = (event) => {
    setConfirmed(false)
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }
  const invalid = validateInstallment(values, credit, quota, rate, session, sale)
  return (
    <CForm
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault()
        if (busy) return
        const message = validateInstallment(values, credit, quota, rate, session, sale)
        setValidation(message)
        if (!message && confirmed) {
          setConfirmed(false)
          onSave(values)
        }
      }}
    >
      <h2 className="h5">Abonar cuota {quota.numero_cuota}</h2>
      <p>
        {credit.cliente} · Venta {credit.numero_venta} · Saldo cuota: {money(quota.saldo_cuota)}
      </p>
      {error && (
        <CAlert color="danger" role="alert">
          {error}
        </CAlert>
      )}
      {warning && (
        <CAlert color="warning" role="alert">
          {warning}
        </CAlert>
      )}
      {validation && (
        <CAlert color="danger" role="alert">
          {validation}
        </CAlert>
      )}
      <fieldset disabled={busy} className="border-0 p-0">
        <CFormSelect
          id="credit-payment-method"
          label="Método"
          name="metodo"
          value={values.metodo}
          onChange={change}
          className="mb-3"
        >
          {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((method) => (
            <option key={method}>{method}</option>
          ))}
        </CFormSelect>
        <CFormInput
          id="credit-payment-currency"
          label="ID de moneda configurada"
          name="id_moneda"
          type="number"
          min={1}
          step={1}
          value={values.id_moneda}
          onChange={change}
          required
          className="mb-2"
        />
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          disabled={busy || !positiveId(values.id_moneda)}
          onClick={() => {
            setConfirmed(false)
            onConsult('rate', values.id_moneda)
          }}
        >
          Consultar moneda y tasa
        </CButton>
        <p className="small text-body-secondary mt-2">
          La API no ofrece catálogo de monedas. Indica el ID configurado; no se asume ningún código
          o tasa.
        </p>
        {Number(rate?.id_moneda) === Number(values.id_moneda) && (
          <p role="status">
            Moneda: {rate.moneda} · Tasa consultada: {rate.tasa} NIO. El servidor fija la tasa
            definitiva.
          </p>
        )}
        {values.metodo === 'EFECTIVO' && (
          <>
            <CFormInput
              id="credit-payment-session"
              label="ID de sesión de caja abierta"
              name="id_sesion_caja"
              type="number"
              min={1}
              step={1}
              value={values.id_sesion_caja}
              onChange={change}
              required
              className="mb-2"
            />
            <CButton
              type="button"
              size="sm"
              color="secondary"
              variant="outline"
              disabled={busy || !positiveId(values.id_sesion_caja)}
              onClick={() => {
                setConfirmed(false)
                onConsult('session', values.id_sesion_caja)
              }}
            >
              Consultar sesión
            </CButton>
            <p className="small text-body-secondary mt-2">
              Usa una sesión abierta desde Caja, de la sucursal de esta venta.
            </p>
            {Number(session?.id_sesion_caja) === Number(values.id_sesion_caja) && (
              <p role="status">
                {session.caja} · {session.sucursal} · {session.estado}
              </p>
            )}
          </>
        )}
        <CFormInput
          id="credit-payment-amount"
          label="Monto en la moneda consultada"
          name="monto"
          type="number"
          min="0.01"
          step="0.01"
          value={values.monto}
          onChange={change}
          required
          className="mb-3"
        />
        <CFormInput
          id="credit-payment-reference"
          label={values.metodo === 'EFECTIVO' ? 'Referencia (opcional)' : 'Referencia obligatoria'}
          name="referencia"
          value={values.referencia}
          maxLength={100}
          required={values.metodo !== 'EFECTIVO'}
          onChange={change}
          className="mb-3"
        />
        <p className="small text-body-secondary">
          El abono se aplica únicamente a esta cuota. El servidor valida saldo, conversión y sesión;
          no se reparte entre cuotas.
        </p>
        {invalid && <p role="status">{invalid}</p>}
        <CFormCheck
          id="credit-payment-confirm"
          className="mb-3"
          label={`Confirmo abonar ${values.monto || '—'} ${rate?.moneda || ''} por ${values.metodo} a la cuota ${quota.numero_cuota} de ${credit.numero_venta}, cliente ${credit.cliente}`}
          checked={confirmed}
          disabled={!!invalid || busy}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <div className="d-flex flex-wrap gap-2">
          <CButton
            color="secondary"
            variant="outline"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Volver al detalle
          </CButton>
          <CButton color="primary" type="submit" disabled={busy || !!invalid || !confirmed}>
            {busy ? 'Procesando…' : 'Confirmar y registrar abono'}
          </CButton>
        </div>
      </fieldset>
    </CForm>
  )
}
CreditPaymentForm.propTypes = {
  credit: PropTypes.object.isRequired,
  quota: PropTypes.object.isRequired,
  sale: PropTypes.object,
  rate: PropTypes.object,
  session: PropTypes.object,
  busy: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  warning: PropTypes.string.isRequired,
  onConsult: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}
export default CreditPaymentForm
