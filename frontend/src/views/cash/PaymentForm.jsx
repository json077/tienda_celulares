import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CForm, CFormInput, CFormSelect, CFormCheck } from '@coreui/react'
import { money, round } from '../sales/saleModel'
import { dateTime, paymentBalance, validatePayment } from './cashModel'

const PaymentForm = ({ sale, payments, session, rate, busy, onRate, onSave }) => {
  const [values, setValues] = useState({
    id_venta: sale.id_venta,
    metodo: 'EFECTIVO',
    id_moneda: '',
    monto: '',
    referencia: '',
  })
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const balance = paymentBalance(sale, payments)
  const currentRate = rate && Number(rate.id_moneda) === Number(values.id_moneda) ? rate : null
  const effective = { ...values, id_sesion_caja: session?.id_sesion_caja }
  let invalid = ''
  try {
    validatePayment(effective, sale, payments, session, currentRate)
  } catch (e) {
    invalid = e.message
  }
  const change = (e) => {
    setChecked(false)
    setValues({ ...values, [e.target.name]: e.target.value })
  }
  return (
    <CForm
      onSubmit={(e) => {
        e.preventDefault()
        try {
          validatePayment(effective, sale, payments, session, currentRate)
          if (checked) {
            setChecked(false)
            onSave(effective)
          }
        } catch (err) {
          setError(err.message)
        }
      }}
    >
      <h5>Registrar pago · {sale.numero_venta}</h5>
      <p>
        {sale.cliente} · {sale.sucursal} · {sale.tipo_venta} / {sale.estado} · Total NIO: C${' '}
        {money(sale.total)}
      </p>
      <p>
        Saldo según pagos consultados: {balance ? `C$ ${money(balance.pending)}` : 'No disponible'}
      </p>
      {error && <CAlert color="danger">{error}</CAlert>}
      {sale.tipo_venta !== 'CONTADO' && (
        <CAlert color="warning">
          Los abonos de ventas CREDITO deben gestionarse mediante sus cuotas. Aquí solo se
          consultan.
        </CAlert>
      )}
      <fieldset disabled={busy || sale.tipo_venta !== 'CONTADO' || sale.estado !== 'CONFIRMADA'}>
        <CFormSelect
          className="mb-3"
          label="Método de pago"
          name="metodo"
          value={values.metodo}
          onChange={change}
        >
          {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((method) => (
            <option key={method}>{method}</option>
          ))}
        </CFormSelect>
        {values.metodo === 'EFECTIVO' && (
          <p>
            Sesión seleccionada:{' '}
            {session
              ? `#${session.id_sesion_caja} · ${session.caja} · ${session.sucursal} · ${session.estado}`
              : 'Consulta o abre una sesión en la sección Caja.'}
          </p>
        )}
        <CFormInput
          className="mb-2"
          label="ID de moneda NIO / USD"
          name="id_moneda"
          type="number"
          min="1"
          step="1"
          value={values.id_moneda}
          onChange={change}
          required
        />
        <CButton
          className="mb-3"
          color="secondary"
          type="button"
          disabled={
            busy || !Number.isInteger(Number(values.id_moneda)) || Number(values.id_moneda) <= 0
          }
          onClick={() => {
            setChecked(false)
            onRate(values.id_moneda)
          }}
        >
          Consultar moneda y tasa
        </CButton>
        <p className="text-body-secondary">
          Indica el ID configurado de la moneda. La API no ofrece un catálogo de monedas; se
          verifica su código y tasa antes de cobrar.
        </p>
        {currentRate && (
          <p>
            {currentRate.moneda} · Tasa consultada: {currentRate.tasa} NIO · Fecha:{' '}
            {dateTime(currentRate.fecha)}. El servidor fijará la tasa histórica al registrar.
          </p>
        )}
        <CFormInput
          className="mb-3"
          label={`Monto original ${currentRate?.moneda || ''}`}
          name="monto"
          type="number"
          min="0.01"
          step="0.01"
          value={values.monto}
          onChange={change}
          required
        />
        {currentRate && Number(values.monto) > 0 && (
          <p>
            Equivalencia orientativa: C${' '}
            {money(round(Number(values.monto) * Number(currentRate.tasa)))}. El monto definitivo lo
            calcula el servidor.
          </p>
        )}
        <CFormInput
          className="mb-3"
          label={values.metodo === 'EFECTIVO' ? 'Referencia (opcional)' : 'Referencia obligatoria'}
          name="referencia"
          value={values.referencia}
          maxLength={150}
          onChange={change}
          required={values.metodo !== 'EFECTIVO'}
        />
        {invalid && <p role="status">{invalid}</p>}
        <CFormCheck
          className="mb-3"
          label="Confirmo la venta, monto, moneda y método del pago"
          checked={checked}
          disabled={!!invalid}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <CButton type="submit" color="primary" disabled={busy || !checked || !!invalid}>
          {busy ? 'Procesando…' : 'Registrar pago'}
        </CButton>
      </fieldset>
    </CForm>
  )
}
PaymentForm.propTypes = {
  sale: PropTypes.object.isRequired,
  payments: PropTypes.array,
  session: PropTypes.object,
  rate: PropTypes.object,
  busy: PropTypes.bool.isRequired,
  onRate: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
}
export default PaymentForm
