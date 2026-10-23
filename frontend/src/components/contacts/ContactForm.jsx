import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModalBody,
  CModalFooter,
  CRow,
  CSpinner,
} from '@coreui/react'

export const validateContact = (fields, values) => {
  for (const field of fields) {
    const value = String(values[field.name] ?? '').trim()
    if (field.required && !value) return `El campo «${field.label}» es obligatorio.`
    if (value.length > field.maxLength)
      return `El campo «${field.label}» no puede superar ${field.maxLength} caracteres.`
  }
  return ''
}

const ContactForm = ({ config, record, saving, error, onSave, onCancel }) => {
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(config.fields.map(({ name }) => [name, record?.[name] ?? ''])),
    activo: record ? Number(record.activo) === 1 : true,
  }))
  const [validationError, setValidationError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    if (saving) return
    const message = validateContact(config.fields, values)
    setValidationError(message)
    if (!message) onSave(values)
  }
  const change = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  return (
    <CForm onSubmit={submit} aria-busy={saving}>
      <CModalBody>
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
        <fieldset disabled={saving} className="border-0 p-0 m-0">
          <CRow className="g-3">
            {config.fields.map((field) => {
              const id = `${config.idKey}-${field.name}`
              const Input = field.multiline ? CFormTextarea : CFormInput
              return (
                <CCol key={field.name} xs={12} md={field.multiline || field.fullWidth ? 12 : 6}>
                  <CFormLabel htmlFor={id}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </CFormLabel>
                  <Input
                    id={id}
                    name={field.name}
                    {...(field.multiline ? { rows: 3 } : { type: field.type || 'text' })}
                    value={values[field.name]}
                    onChange={change}
                    maxLength={field.maxLength}
                    required={!!field.required}
                    autoComplete={field.autoComplete}
                  />
                </CCol>
              )
            })}
          </CRow>
        </fieldset>
        <p className="small text-body-secondary mt-3 mb-0">
          * Campos obligatorios.{' '}
          {record
            ? 'El estado se cambia desde el listado, con confirmación.'
            : 'El registro se creará activo.'}
        </p>
      </CModalBody>
      <CModalFooter>
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </CButton>
        <CButton type="submit" color="primary" disabled={saving}>
          {saving && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </CButton>
      </CModalFooter>
    </CForm>
  )
}

ContactForm.propTypes = {
  config: PropTypes.object.isRequired,
  record: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default ContactForm
