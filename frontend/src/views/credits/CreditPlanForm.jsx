import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CRow,
} from '@coreui/react'
import { money } from './creditModel'
import { planFrequencies, validateCreditPlan } from './creditPlanModel'

export const CreditPlanSale = ({ sale }) =>
  sale ? (
    <div className="border rounded p-3 my-3" role="status">
      <div>
        <strong>Venta {sale.numero_venta}</strong> · {sale.cliente}
      </div>
      <div>
        Total de venta: {money(sale.total)} · {sale.tipo_venta} · {sale.estado}
      </div>
      <p className="small text-body-secondary mb-0">
        El backend descontará los pagos aplicados y calculará el monto financiado, interés, saldo y
        cuotas.
      </p>
    </div>
  ) : (
    <p className="text-body-secondary">
      Selecciona una venta para revisar cliente, total y condición.
    </p>
  )
CreditPlanSale.propTypes = { sale: PropTypes.object }

const CreditPlanForm = ({ sales, busy, error, onSave, onRefresh, onCancel }) => {
  const [values, setValues] = useState({
    id_venta: '',
    tasa_interes: '',
    numero_cuotas: '',
    frecuencia: '',
    fecha_inicio: '',
    observacion: '',
  })
  const [query, setQuery] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [validation, setValidation] = useState('')
  const sale = sales.find((s) => String(s.id_venta) === String(values.id_venta))
  const filtered = sales.filter(
    (s) =>
      String(s.id_venta) === String(values.id_venta) ||
      [s.numero_venta, s.cliente].some((v) =>
        v.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')),
      ),
  )
  const invalid = validateCreditPlan(values, sales)
  const change = (event) => {
    setConfirmed(false)
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }
  return (
    <CForm
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault()
        if (busy) return
        const message = validateCreditPlan(values, sales)
        setValidation(message)
        if (!message && confirmed) {
          setConfirmed(false)
          onSave(values)
        }
      }}
    >
      {error && (
        <CAlert color="danger" role="alert">
          {error}
        </CAlert>
      )}
      {validation && (
        <CAlert color="danger" role="alert">
          {validation}
        </CAlert>
      )}
      {!sales.length && (
        <CAlert color="info">
          No hay ventas CREDITO CONFIRMADAS sin plan en los datos consultados.
        </CAlert>
      )}
      <fieldset disabled={busy} className="border-0 p-0">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmed(false)
              onRefresh()
            }}
          >
            Actualizar ventas elegibles
          </CButton>
        </div>
        <CFormInput
          id="plan-sale-search"
          label="Buscar venta por número o cliente"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3"
        />
        <CFormSelect
          id="plan-sale"
          label="Venta a financiar *"
          name="id_venta"
          value={values.id_venta}
          onChange={change}
          required
        >
          <option value="">Selecciona una venta</option>
          {filtered.map((s) => (
            <option key={s.id_venta} value={s.id_venta}>
              {s.numero_venta} · {s.cliente} · {money(s.total)} · {s.tipo_venta} / {s.estado}
            </option>
          ))}
        </CFormSelect>
        <CreditPlanSale sale={sale} />
        <CRow className="g-3">
          <CCol md={6}>
            <CFormInput
              id="plan-interest"
              label="Tasa de interés (%) *"
              name="tasa_interes"
              type="number"
              min={0}
              max={100}
              step="any"
              value={values.tasa_interes}
              onChange={change}
              required
            />
          </CCol>
          <CCol md={6}>
            <CFormInput
              id="plan-installments"
              label="Número de cuotas *"
              name="numero_cuotas"
              type="number"
              min={1}
              max={120}
              step={1}
              value={values.numero_cuotas}
              onChange={change}
              required
            />
          </CCol>
          <CCol md={6}>
            <CFormSelect
              id="plan-frequency"
              label="Periodicidad *"
              name="frecuencia"
              value={values.frecuencia}
              onChange={change}
              required
            >
              <option value="">Selecciona la periodicidad</option>
              {planFrequencies.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormInput
              id="plan-start"
              label="Fecha de inicio *"
              name="fecha_inicio"
              type="date"
              value={values.fecha_inicio}
              onChange={change}
              required
            />
          </CCol>
          <CCol xs={12}>
            <CFormTextarea
              id="plan-note"
              label="Observación (opcional)"
              name="observacion"
              maxLength={500}
              rows={2}
              value={values.observacion}
              onChange={change}
            />
          </CCol>
        </CRow>
        <p className="small text-body-secondary mt-3">
          La primera cuota vence un período después de la fecha de inicio. Los importes y el
          calendario definitivos se mostrarán después de crear el plan.
        </p>
        <CFormCheck
          id="plan-confirm"
          className="mb-3"
          label="Confirmo la venta seleccionada, interés, cuotas, periodicidad y fecha de inicio"
          checked={confirmed}
          disabled={busy || !!invalid}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <div className="d-flex flex-wrap gap-2">
          <CButton
            type="button"
            color="secondary"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={busy || !confirmed || !!invalid}>
            {busy ? 'Procesando…' : 'Crear plan de crédito'}
          </CButton>
        </div>
      </fieldset>
    </CForm>
  )
}
CreditPlanForm.propTypes = {
  sales: PropTypes.array.isRequired,
  busy: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}
export default CreditPlanForm
