import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModalBody,
  CModalFooter,
  CRow,
  CSpinner,
} from '@coreui/react'
import { draftTotals, formatAmount, lineAmounts, validateDraft } from './purchaseModel'
import PurchaseSummary from './PurchaseSummary'

const PurchaseForm = ({
  products,
  suppliers,
  branches,
  warning,
  saving,
  error,
  onSave,
  onCancel,
}) => {
  const [values, setValues] = useState({
    id_proveedor: '',
    id_sucursal: '',
    numero_documento: '',
    observacion: '',
    detalles: [],
  })
  const [branchChoice, setBranchChoice] = useState('')
  const [validation, setValidation] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const nextKey = useRef(0)
  const activeProducts = products.filter((product) => Number(product.activo) === 1)
  const activeSuppliers = suppliers.filter((supplier) => Number(supplier.activo) === 1)
  const totals = draftTotals(values.detalles)

  const change = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }
  const updateLine = (key, name, value) => {
    setValues((current) => ({
      ...current,
      detalles: current.detalles.map((line) =>
        line.key === key ? { ...line, [name]: value } : line,
      ),
    }))
  }
  const review = (event) => {
    event.preventDefault()
    const message = validateDraft(values, products, suppliers)
    setValidation(message)
    if (!message) setReviewing(true)
  }
  const preview = {
    ...values,
    ...totals,
    proveedor: suppliers.find((s) => String(s.id_proveedor) === values.id_proveedor)?.nombre,
    sucursal: branches.find((branch) => branch.id === values.id_sucursal)?.label,
    detalles: values.detalles.map((line) => {
      const product = products.find((p) => String(p.id_producto) === line.id_producto)
      return {
        ...line,
        producto: product?.nombre,
        sku: product?.sku,
        tipo_control: product?.tipo_control,
        subtotal: lineAmounts(line).total,
      }
    }),
  }

  return (
    <CForm onSubmit={review} aria-busy={saving}>
      <CModalBody>
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
        {reviewing ? (
          <>
            <CAlert color="info">
              Revisa la compra antes de guardar. Se creará un borrador sin modificar existencias.
              Después podrás confirmar la recepción y completar los IMEI de los productos
              serializados.
            </CAlert>
            <PurchaseSummary purchase={preview} />
            <p className="small text-body-secondary">
              Importes estimados. El servidor calculará los importes definitivos.
            </p>
          </>
        ) : (
          <fieldset disabled={saving} className="border-0 p-0 m-0">
            <p>
              1. Guarda el borrador. 2. Revisa y confirma la recepción para ingresar las
              existencias.
            </p>
            {warning && <CAlert color="warning">{warning}</CAlert>}
            {(!activeSuppliers.length || !activeProducts.length) && (
              <CAlert color="warning">
                Se necesita al menos un proveedor y un producto activos para registrar una compra.
              </CAlert>
            )}
            <CRow className="g-3 mb-4">
              <CCol md={6}>
                <CFormLabel htmlFor="purchase-supplier">Proveedor *</CFormLabel>
                <CFormSelect
                  id="purchase-supplier"
                  name="id_proveedor"
                  value={values.id_proveedor}
                  onChange={change}
                  required
                >
                  <option value="">Selecciona un proveedor</option>
                  {activeSuppliers.map((supplier) => (
                    <option key={supplier.id_proveedor} value={supplier.id_proveedor}>
                      {supplier.nombre}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="purchase-branch">Sucursal *</CFormLabel>
                <CFormSelect
                  id="purchase-branch"
                  value={branchChoice}
                  required
                  onChange={(event) => {
                    setBranchChoice(event.target.value)
                    setValues((current) => ({
                      ...current,
                      id_sucursal: event.target.value === 'manual' ? '' : event.target.value,
                    }))
                  }}
                >
                  <option value="">Selecciona una sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.label}
                    </option>
                  ))}
                  <option value="manual">Otra sucursal: indicar ID</option>
                </CFormSelect>
                {branchChoice === 'manual' && (
                  <>
                    <CFormLabel htmlFor="purchase-branch-id" className="mt-2">
                      ID de sucursal existente *
                    </CFormLabel>
                    <CFormInput
                      id="purchase-branch-id"
                      name="id_sucursal"
                      type="number"
                      min="1"
                      step="1"
                      value={values.id_sucursal}
                      onChange={change}
                      required
                    />
                  </>
                )}
                <p className="small text-body-secondary mt-1 mb-0">
                  Se muestran sucursales conocidas. Se validará que la sucursal exista y esté activa
                  al guardar.
                </p>
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="purchase-document">Número de documento *</CFormLabel>
                <CFormInput
                  id="purchase-document"
                  name="numero_documento"
                  value={values.numero_documento}
                  maxLength={80}
                  onChange={change}
                  required
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="purchase-note">Observación</CFormLabel>
                <CFormTextarea
                  id="purchase-note"
                  name="observacion"
                  value={values.observacion}
                  maxLength={500}
                  rows={2}
                  onChange={change}
                />
              </CCol>
            </CRow>
            <h2 className="h5">Productos</h2>
            {values.detalles.map((line, index) => {
              const product = products.find((p) => String(p.id_producto) === line.id_producto)
              return (
                <CCard className="mb-3" key={line.key}>
                  <CCardBody>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>Línea {index + 1}</strong>
                      <CButton
                        type="button"
                        color="danger"
                        variant="outline"
                        size="sm"
                        aria-label={`Eliminar línea ${index + 1}`}
                        onClick={() =>
                          setValues((current) => ({
                            ...current,
                            detalles: current.detalles.filter((item) => item.key !== line.key),
                          }))
                        }
                      >
                        Eliminar
                      </CButton>
                    </div>
                    <CRow className="g-3">
                      <CCol xs={12}>
                        <CFormLabel htmlFor={`product-${line.key}`}>Producto *</CFormLabel>
                        <CFormSelect
                          id={`product-${line.key}`}
                          value={line.id_producto}
                          onChange={(event) =>
                            updateLine(line.key, 'id_producto', event.target.value)
                          }
                          required
                        >
                          <option value="">Selecciona un producto</option>
                          {activeProducts.map((p) => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.sku} · {p.nombre} · {p.tipo_control}
                            </option>
                          ))}
                        </CFormSelect>
                      </CCol>
                      {[
                        ['cantidad', 'Cantidad *', '1', '1'],
                        ['costo_unitario', 'Costo unitario *', '0', 'any'],
                        ['descuento', 'Descuento (importe)', '0', 'any'],
                        ['impuesto', 'Impuesto (importe)', '0', 'any'],
                      ].map(([name, label, min, step]) => (
                        <CCol xs={6} md={3} key={name}>
                          <CFormLabel htmlFor={`${name}-${line.key}`}>{label}</CFormLabel>
                          <CFormInput
                            id={`${name}-${line.key}`}
                            type="number"
                            min={min}
                            step={step}
                            value={line[name]}
                            required={name === 'cantidad' || name === 'costo_unitario'}
                            onChange={(event) => updateLine(line.key, name, event.target.value)}
                          />
                        </CCol>
                      ))}
                    </CRow>
                    <div className="mt-3">
                      Subtotal estimado: <strong>{formatAmount(lineAmounts(line).total)}</strong>
                    </div>
                    {product?.tipo_control === 'SERIALIZADO' && (
                      <p className="small text-body-secondary mt-2 mb-0">
                        Al confirmar se solicitarán {line.cantidad || 'N'} unidades, cada una con
                        IMEI1 obligatorio; IMEI2 y serie opcionales.
                      </p>
                    )}
                  </CCardBody>
                </CCard>
              )
            })}
            {!values.detalles.length && (
              <p className="text-body-secondary">Agrega los productos de esta compra.</p>
            )}
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              onClick={() => {
                const key = nextKey.current++
                setValues((current) => ({
                  ...current,
                  detalles: [
                    ...current.detalles,
                    {
                      key,
                      id_producto: '',
                      cantidad: '1',
                      costo_unitario: '',
                      descuento: '0',
                      impuesto: '0',
                    },
                  ],
                }))
              }}
            >
              Agregar producto
            </CButton>
            <p className="text-end mt-3 mb-0">
              <strong>Total estimado: {formatAmount(totals.total)}</strong>
            </p>
          </fieldset>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          disabled={saving}
          onClick={reviewing ? () => setReviewing(false) : onCancel}
        >
          {reviewing ? 'Volver a editar' : 'Cancelar'}
        </CButton>
        {reviewing ? (
          <CButton type="button" color="primary" disabled={saving} onClick={() => onSave(values)}>
            {saving && <CSpinner size="sm" className="me-2" />}
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </CButton>
        ) : (
          <CButton
            type="submit"
            color="primary"
            disabled={saving || !activeProducts.length || !activeSuppliers.length}
          >
            Revisar compra
          </CButton>
        )}
      </CModalFooter>
    </CForm>
  )
}

PurchaseForm.propTypes = {
  products: PropTypes.array.isRequired,
  suppliers: PropTypes.array.isRequired,
  branches: PropTypes.array.isRequired,
  warning: PropTypes.string.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default PurchaseForm
