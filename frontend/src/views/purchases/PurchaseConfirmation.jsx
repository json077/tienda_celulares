import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CModalBody,
  CModalFooter,
  CRow,
  CSpinner,
} from '@coreui/react'
import { serializedDetails, unitComplete, validateUnits } from './purchaseModel'
import PurchaseSummary from './PurchaseSummary'

const PAGE_SIZE = 5

const PurchaseConfirmation = ({ purchase, saving, error, onConfirm, onCancel }) => {
  // Captura por páginas: no se generan IMEI ni se crean arrays proporcionales a cantidades grandes.
  const [entries, setEntries] = useState({})
  const [pages, setPages] = useState({})
  const [reviewed, setReviewed] = useState(false)
  const [validation, setValidation] = useState('')
  const lines = serializedDetails(purchase)
  const units = Object.values(entries)
  const missing =
    lines.reduce((sum, line) => sum + Number(line.cantidad), 0) - units.filter(unitComplete).length
  const updateUnit = (line, index, field, value) => {
    const key = `${line.id_detalle_compra}-${index}`
    setReviewed(false)
    setEntries((current) => ({
      ...current,
      [key]: {
        id_detalle_compra: line.id_detalle_compra,
        imei1: '',
        imei2: '',
        numero_serie: '',
        ...current[key],
        [field]: value,
      },
    }))
  }
  const submit = (event) => {
    event.preventDefault()
    if (saving) return
    const message = validateUnits(purchase, units)
    setValidation(message)
    if (!message && reviewed) onConfirm(units)
  }

  return (
    <CForm onSubmit={submit} aria-busy={saving}>
      <CModalBody>
        <CAlert color="warning">
          Confirmar ingresará las cantidades en la sucursal indicada, registrará los dispositivos y
          generará los movimientos de compra. Una compra confirmada no puede anularse con este
          sistema.
        </CAlert>
        <PurchaseSummary purchase={purchase} />
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
        <fieldset disabled={saving} className="border-0 p-0 m-0">
          {lines.length > 0 && (
            <>
              <h2 className="h5">Unidades serializadas</h2>
              <p>
                IMEI1: 15 dígitos obligatorios. IMEI2: 15 dígitos opcionales. Serie: opcional, hasta
                80 caracteres. Los IMEI y las series deben ser únicos.
              </p>
              <p role="status">
                <strong>Faltan {missing} unidades por completar.</strong> También se comprobarán los
                duplicados al confirmar.
              </p>
            </>
          )}
          {lines.map((line) => {
            const page = pages[line.id_detalle_compra] || 0
            const start = page * PAGE_SIZE
            const count = Number(line.cantidad)
            const complete = units.filter(
              (unit) =>
                Number(unit.id_detalle_compra) === Number(line.id_detalle_compra) &&
                unitComplete(unit),
            ).length
            return (
              <CCard key={line.id_detalle_compra} className="mb-3">
                <CCardBody>
                  <h3 className="h6">
                    {line.producto} · {line.sku} · Detalle #{line.id_detalle_compra}
                  </h3>
                  <p>
                    {complete} de {count} unidades completas.
                  </p>
                  {Array.from({ length: Math.min(PAGE_SIZE, count - start) }, (_, offset) => {
                    const index = start + offset
                    const key = `${line.id_detalle_compra}-${index}`
                    const unit = entries[key] || {}
                    return (
                      <fieldset className="border rounded p-3 mb-3" key={key}>
                        <legend className="float-none w-auto fs-6 px-2">Unidad {index + 1}</legend>
                        <CRow className="g-3">
                          {[
                            ['imei1', 'IMEI 1 *', 15],
                            ['imei2', 'IMEI 2', 15],
                            ['numero_serie', 'Número de serie', 80],
                          ].map(([field, label, max]) => (
                            <CCol md={4} key={field}>
                              <CFormLabel htmlFor={`${key}-${field}`}>{label}</CFormLabel>
                              <CFormInput
                                id={`${key}-${field}`}
                                type="text"
                                inputMode={field !== 'numero_serie' ? 'numeric' : undefined}
                                maxLength={max}
                                pattern={field !== 'numero_serie' ? '[0-9]{15}' : undefined}
                                required={field === 'imei1'}
                                autoComplete="off"
                                value={unit[field] || ''}
                                onChange={(event) =>
                                  updateUnit(line, index, field, event.target.value)
                                }
                              />
                            </CCol>
                          ))}
                        </CRow>
                      </fieldset>
                    )
                  })}
                  {count > PAGE_SIZE && (
                    <div className="d-flex flex-wrap align-items-center gap-3">
                      <CButton
                        type="button"
                        color="secondary"
                        variant="outline"
                        disabled={page === 0}
                        onClick={() =>
                          setPages((current) => ({
                            ...current,
                            [line.id_detalle_compra]: page - 1,
                          }))
                        }
                      >
                        Anteriores
                      </CButton>
                      <span>
                        Unidades {start + 1}–{Math.min(start + PAGE_SIZE, count)} de {count}
                      </span>
                      <CButton
                        type="button"
                        color="secondary"
                        variant="outline"
                        disabled={start + PAGE_SIZE >= count}
                        onClick={() =>
                          setPages((current) => ({
                            ...current,
                            [line.id_detalle_compra]: page + 1,
                          }))
                        }
                      >
                        Siguientes
                      </CButton>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            )
          })}
          {!lines.length && (
            <p>Todos los productos se controlan por cantidad. No se requieren IMEI.</p>
          )}
          <CFormCheck
            id="purchase-confirm-reviewed"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
            label="He revisado la compra y confirmo la recepción de todos los productos en esta sucursal."
            required
          />
        </fieldset>
      </CModalBody>
      <CModalFooter>
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
        >
          Volver al detalle
        </CButton>
        <CButton type="submit" color="primary" disabled={saving || !reviewed || missing > 0}>
          {saving && <CSpinner size="sm" className="me-2" />}
          {saving ? 'Confirmando...' : 'Confirmar e ingresar existencias'}
        </CButton>
      </CModalFooter>
    </CForm>
  )
}

PurchaseConfirmation.propTypes = {
  purchase: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default PurchaseConfirmation
