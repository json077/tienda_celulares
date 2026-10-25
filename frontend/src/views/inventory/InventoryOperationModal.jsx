import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { validateInventoryOperation } from './inventoryOperation'

const InventoryOperationModal = ({ kind, row, saving, error, onConfirm, onClose }) => {
  const [values, setValues] = useState({
    tipo: 'ENTRADA',
    cantidad: '',
    observacion: '',
    stock_minimo: row.stock_minimo ?? '',
  })
  const [confirming, setConfirming] = useState(false)
  const [validationError, setValidationError] = useState('')
  const isMinimum = kind === 'minimum'
  const change = (event) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = (event) => {
    event.preventDefault()
    if (saving) return
    const message = validateInventoryOperation(kind, row, values)
    setValidationError(message)
    if (message) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    onConfirm(values)
  }

  return (
    <CModal
      visible
      backdrop="static"
      keyboard={!saving}
      onClose={onClose}
      aria-labelledby="inventory-operation-title"
    >
      <CModalHeader closeButton={!saving}>
        <CModalTitle id="inventory-operation-title">
          {isMinimum ? 'Configurar stock mínimo' : 'Ajustar existencias'}
        </CModalTitle>
      </CModalHeader>
      <CForm onSubmit={submit} aria-busy={saving}>
        <CModalBody>
          <p className="mb-1">
            <strong>{row.producto}</strong> · {row.sku}
          </p>
          <p className="text-body-secondary">
            Sucursal: {row.sucursal}. Stock consultado: {row.stock_actual}.
          </p>
          {error && (
            <CAlert color="danger" role="alert">
              {error}
            </CAlert>
          )}
          {validationError && (
            <CAlert color="danger" role="alert">
              {validationError}
            </CAlert>
          )}
          {confirming ? (
            <div role="status">
              <h3 className="h6">Confirma la operación</h3>
              {isMinimum ? (
                <p>
                  Establecer stock mínimo en <strong>{values.stock_minimo}</strong>.
                </p>
              ) : (
                <>
                  <p>
                    {values.tipo === 'ENTRADA' ? 'Registrar entrada de' : 'Registrar salida de'}{' '}
                    <strong>{values.cantidad}</strong> unidades.
                  </p>
                  <p className="text-break">Motivo: {values.observacion.trim()}</p>
                  <p className="small text-body-secondary">
                    El ajuste quedará registrado en el historial de movimientos.
                  </p>
                </>
              )}
            </div>
          ) : (
            <fieldset className="border-0 p-0 m-0" disabled={saving}>
              {isMinimum ? (
                <>
                  <CFormLabel htmlFor="inventory-minimum">Stock mínimo</CFormLabel>
                  <CFormInput
                    id="inventory-minimum"
                    name="stock_minimo"
                    type="number"
                    min={0}
                    step={1}
                    value={values.stock_minimo}
                    onChange={change}
                    required
                  />
                </>
              ) : (
                <>
                  <CFormLabel htmlFor="inventory-adjustment-type">Tipo de ajuste</CFormLabel>
                  <CFormSelect
                    id="inventory-adjustment-type"
                    name="tipo"
                    className="mb-3"
                    value={values.tipo}
                    onChange={change}
                    required
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida</option>
                  </CFormSelect>
                  <CFormLabel htmlFor="inventory-adjustment-amount">Cantidad</CFormLabel>
                  <CFormInput
                    id="inventory-adjustment-amount"
                    name="cantidad"
                    type="number"
                    min={1}
                    step={1}
                    className="mb-3"
                    value={values.cantidad}
                    onChange={change}
                    required
                  />
                  <CFormLabel htmlFor="inventory-adjustment-reason">
                    Motivo / observación
                  </CFormLabel>
                  <CFormTextarea
                    id="inventory-adjustment-reason"
                    name="observacion"
                    rows={3}
                    maxLength={500}
                    value={values.observacion}
                    onChange={change}
                    required
                  />
                </>
              )}
            </fieldset>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            type="button"
            color="secondary"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </CButton>
          {confirming && (
            <CButton
              type="button"
              color="secondary"
              disabled={saving}
              onClick={() => setConfirming(false)}
            >
              Volver
            </CButton>
          )}
          <CButton type="submit" color="primary" disabled={saving}>
            {saving && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
            {saving ? 'Guardando...' : confirming ? 'Confirmar' : 'Revisar operación'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

InventoryOperationModal.propTypes = {
  kind: PropTypes.oneOf(['adjust', 'minimum']).isRequired,
  row: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default InventoryOperationModal
