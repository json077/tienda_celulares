import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CFormInput, CFormLabel } from '@coreui/react'
import {
  productPhotoService,
  PRODUCT_PHOTO_MAX_BYTES,
  PRODUCT_PHOTO_TYPES,
} from '../../services/productPhotoService'

const BlobPreview = ({ image, onError }) => {
  const ref = useRef(null)
  useEffect(() => {
    const url = URL.createObjectURL(image)
    ref.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [image])
  return (
    <img
      ref={ref}
      alt="Fotografía del producto"
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      onError={onError}
    />
  )
}
BlobPreview.propTypes = { image: PropTypes.object.isRequired, onError: PropTypes.func.isRequired }

const ProductPhoto = ({ productId, change, onChange, disabled, canEdit }) => {
  const [existing, setExisting] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!!productId)
  useEffect(() => {
    if (!productId) return
    const controller = new AbortController()
    productPhotoService
      .get(productId, controller.signal)
      .then((blob) => {
        if (!controller.signal.aborted) setExisting(blob)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [productId])
  const image =
    change?.action === 'upload' ? change.file : change?.action === 'remove' ? null : existing
  const select = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (
      !PRODUCT_PHOTO_TYPES.includes(file.type) ||
      !file.size ||
      file.size > PRODUCT_PHOTO_MAX_BYTES
    ) {
      setError('Selecciona JPG, PNG o WebP de hasta 2 MB.')
      return
    }
    setError('')
    onChange({ action: 'upload', file })
  }
  return (
    <section className="border rounded p-3 mt-3" aria-labelledby="product-photo-title">
      <h2 id="product-photo-title" className="h6">
        Fotografía del producto
      </h2>
      <div className="d-flex flex-wrap align-items-center gap-3">
        <div
          className="border rounded bg-body-tertiary d-flex align-items-center justify-content-center"
          style={{ width: 140, height: 140 }}
        >
          {image ? (
            <BlobPreview
              image={image}
              onError={() =>
                setError('No se pudo visualizar la imagen. Selecciona un archivo válido.')
              }
            />
          ) : (
            <span className="text-body-secondary small text-center">
              {loading ? 'Cargando fotografía…' : 'Sin fotografía'}
            </span>
          )}
        </div>
        <div>
          <CFormLabel htmlFor="product-photo-file">Seleccionar o reemplazar fotografía</CFormLabel>
          <CFormInput
            id="product-photo-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || !canEdit}
            onChange={select}
          />
          <p className="small text-body-secondary my-2">
            JPG, PNG o WebP. Máximo 2 MB y 4096 × 4096 píxeles.
          </p>
          {!canEdit && (
            <p className="small text-body-secondary">
              Se requiere permiso para editar productos para cambiar fotografías.
            </p>
          )}
          <CButton
            type="button"
            color="secondary"
            variant="outline"
            size="sm"
            disabled={disabled || !canEdit || loading}
            onClick={() => {
              setError('')
              onChange({ action: 'remove' })
            }}
          >
            Quitar fotografía
          </CButton>
          {change && (
            <CButton
              type="button"
              color="secondary"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Deshacer cambio
            </CButton>
          )}
          <p className="small text-body-secondary mt-2 mb-0">
            Los cambios de fotografía se aplican al guardar.
          </p>
        </div>
      </div>
      {error && (
        <CAlert color="warning" className="mt-2 mb-0" role="alert">
          {error}
        </CAlert>
      )}
    </section>
  )
}
ProductPhoto.propTypes = {
  productId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  change: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  canEdit: PropTypes.bool,
}
export default ProductPhoto
