import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { validateProduct } from './productModel'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModalBody,
  CModalFooter,
  CRow,
  CSpinner,
} from '@coreui/react'

const ProductForm = ({ product, categories, brands, saving, error, onSave, onCancel }) => {
  const [values, setValues] = useState(() => ({
    id_categoria: product?.id_categoria ?? '',
    id_marca: product?.id_marca ?? '',
    sku: product?.sku ?? '',
    nombre: product?.nombre ?? '',
    descripcion: product?.descripcion ?? '',
    tipo_control: product?.tipo_control ?? 'CANTIDAD',
    precio_venta: product?.precio_venta ?? '',
    permite_descuento: Number(product?.permite_descuento) === 1,
    porcentaje_descuento_maximo: product?.porcentaje_descuento_maximo ?? 0,
    dias_garantia: product?.dias_garantia ?? 0,
    activo: Number(product?.activo) === 1,
  }))
  const [validationError, setValidationError] = useState('')
  const activeCategories = categories.filter((item) => Number(item.activo) === 1)
  const activeBrands = brands.filter((item) => Number(item.activo) === 1)
  const validCategory = activeCategories.some(
    (item) => String(item.id_categoria) === String(values.id_categoria),
  )
  const validBrand =
    values.id_marca === '' ||
    activeBrands.some((item) => String(item.id_marca) === String(values.id_marca))
  const change = (event) => {
    const { name, value, type, checked } = event.target
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (saving) return
    const message = validateProduct(values, categories, brands)
    if (message) {
      setValidationError(message)
      return
    }
    setValidationError('')
    onSave(values)
  }

  return (
    <CForm onSubmit={handleSubmit} aria-busy={saving}>
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
        {!activeCategories.length && (
          <CAlert color="warning">
            No hay categorías activas. Es necesario disponer de una para guardar productos.
          </CAlert>
        )}
        {((!validCategory && values.id_categoria !== '') || !validBrand) && (
          <CAlert color="warning">
            La categoría o marca actual está inactiva. El backend requiere relaciones activas para
            editar; selecciona una categoría activa y una marca activa o sin marca.
          </CAlert>
        )}
        <fieldset disabled={saving} className="border-0 p-0 m-0">
          <CRow className="g-3">
            <CCol md={4}>
              <CFormLabel htmlFor="product-sku">SKU *</CFormLabel>
              <CFormInput
                id="product-sku"
                name="sku"
                value={values.sku}
                onChange={change}
                maxLength={50}
                required
              />
            </CCol>
            <CCol md={8}>
              <CFormLabel htmlFor="product-name">Nombre *</CFormLabel>
              <CFormInput
                id="product-name"
                name="nombre"
                value={values.nombre}
                onChange={change}
                minLength={2}
                maxLength={160}
                required
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="product-category">Categoría *</CFormLabel>
              <CFormSelect
                id="product-category"
                name="id_categoria"
                value={values.id_categoria}
                onChange={change}
                required
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((item) => (
                  <option
                    key={item.id_categoria}
                    value={item.id_categoria}
                    disabled={Number(item.activo) !== 1}
                  >
                    {item.nombre}
                    {Number(item.activo) !== 1 ? ' (inactiva)' : ''}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="product-brand">Marca</CFormLabel>
              <CFormSelect
                id="product-brand"
                name="id_marca"
                value={values.id_marca}
                onChange={change}
              >
                <option value="">Sin marca</option>
                {brands.map((item) => (
                  <option
                    key={item.id_marca}
                    value={item.id_marca}
                    disabled={Number(item.activo) !== 1}
                  >
                    {item.nombre}
                    {Number(item.activo) !== 1 ? ' (inactiva)' : ''}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="product-control">Tipo de control *</CFormLabel>
              <CFormSelect
                id="product-control"
                name="tipo_control"
                value={values.tipo_control}
                onChange={change}
                required
              >
                <option value="CANTIDAD">Cantidad</option>
                <option value="SERIALIZADO">Serializado</option>
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="product-price">Precio de venta *</CFormLabel>
              <CFormInput
                id="product-price"
                name="precio_venta"
                type="number"
                min={0}
                step="any"
                value={values.precio_venta}
                onChange={change}
                required
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel htmlFor="product-description">Descripción</CFormLabel>
              <CFormTextarea
                id="product-description"
                name="descripcion"
                rows={3}
                value={values.descripcion}
                onChange={change}
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                id="product-discount"
                name="permite_descuento"
                label="Permitir descuentos"
                checked={values.permite_descuento}
                onChange={change}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="product-max-discount">Descuento máximo (%)</CFormLabel>
              <CFormInput
                id="product-max-discount"
                name="porcentaje_descuento_maximo"
                type="number"
                min={0}
                max={100}
                step="any"
                value={values.porcentaje_descuento_maximo}
                onChange={change}
                disabled={!values.permite_descuento}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="product-warranty">Días de garantía</CFormLabel>
              <CFormInput
                id="product-warranty"
                name="dias_garantia"
                type="number"
                min={0}
                max={65535}
                step={1}
                value={values.dias_garantia}
                onChange={change}
              />
            </CCol>
          </CRow>
        </fieldset>
        <p className="small text-body-secondary mt-3" role="status">
          {values.tipo_control === 'SERIALIZADO'
            ? 'Serializado: los IMEI y unidades se registran en Compras e Inventario.'
            : 'Cantidad: las existencias se administran en Compras e Inventario.'}
        </p>
        {product && values.tipo_control !== product.tipo_control && (
          <CAlert color="warning">
            Verifica el historial en Inventario antes de cambiar el control. La API no comprueba
            compatibilidad con existencias anteriores.
          </CAlert>
        )}
        <p className="small text-body-secondary mt-3 mb-0">
          * Campos obligatorios.{' '}
          {product
            ? 'El estado se cambia desde el listado, con confirmación.'
            : 'El producto se creará activo.'}
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
        <CButton type="submit" color="primary" disabled={saving || !activeCategories.length}>
          {saving && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
          {saving ? 'Guardando...' : 'Guardar producto'}
        </CButton>
      </CModalFooter>
    </CForm>
  )
}

ProductForm.propTypes = {
  product: PropTypes.object,
  categories: PropTypes.array.isRequired,
  brands: PropTypes.array.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default ProductForm
