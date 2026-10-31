import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { productErrorMessage, productService } from '../../services/productService'
import ProductForm from './ProductForm'
import { useAuth } from '../../contexts/AuthContext'
import { filterProducts } from './productModel'

const priceFormat = new Intl.NumberFormat('es-NI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const Products = () => {
  const { can } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ category: '', brand: '', status: '', control: '' })
  const [operation, setOperation] = useState('')
  const [editor, setEditor] = useState(null)
  const [formError, setFormError] = useState('')
  const [statusProduct, setStatusProduct] = useState(null)
  const [statusError, setStatusError] = useState('')
  const pending = useRef(false)

  const loadProducts = useCallback((signal) => {
    return productService
      .list(signal)
      .then((response) => {
        if (!Array.isArray(response.data))
          throw new Error('El servidor devolvi? un listado inv?lido.')
        if (!signal?.aborted) setProducts(response.data)
      })
      .catch((error) => {
        if (!signal?.aborted) setError(productErrorMessage(error))
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false)
      })
  }, [])

  const refreshProducts = async () => {
    setLoading(true)
    setError('')
    await loadProducts()
  }

  useEffect(() => {
    const controller = new AbortController()
    loadProducts(controller.signal)
    return () => controller.abort()
  }, [loadProducts])

  const openEditor = async (product = null) => {
    if (!can(product ? 'PRODUCTOS_EDITAR' : 'PRODUCTOS_CREAR')) return
    if (pending.current) return
    pending.current = true
    setOperation('opening')
    setError('')
    setSuccess('')
    setFormError('')
    try {
      const [categories, brands, detail] = await Promise.all([
        productService.categories(),
        productService.brands(),
        product ? productService.get(product.id_producto) : Promise.resolve(null),
      ])
      if (!Array.isArray(categories.data) || !Array.isArray(brands.data))
        throw new Error('Cat?logos inv?lidos.')
      setEditor({ product: detail?.data || null, categories: categories.data, brands: brands.data })
    } catch (error) {
      setError(productErrorMessage(error))
    } finally {
      pending.current = false
      setOperation('')
    }
  }

  const saveProduct = async (values) => {
    if (!can(editor.product ? 'PRODUCTOS_EDITAR' : 'PRODUCTOS_CREAR')) return
    if (pending.current) return
    pending.current = true
    setOperation('saving')
    setFormError('')
    try {
      const response = editor.product
        ? await productService.update(editor.product.id_producto, values)
        : await productService.create(values)
      setEditor(null)
      setSuccess(response.message)
      await refreshProducts()
    } catch (error) {
      setFormError(productErrorMessage(error))
    } finally {
      pending.current = false
      setOperation('')
    }
  }

  const changeStatus = async () => {
    if (!can(Number(statusProduct?.activo) === 1 ? 'PRODUCTOS_ELIMINAR' : 'PRODUCTOS_EDITAR'))
      return
    if (pending.current) return
    pending.current = true
    setOperation('status')
    setStatusError('')
    setSuccess('')
    try {
      // La reactivación usa PUT completo con datos recién obtenidos del backend.
      const { data: current } = await productService.get(statusProduct.id_producto)
      if (Number(current.activo) !== Number(statusProduct.activo)) {
        throw new Error(
          'El estado del producto cambió. Cierra esta ventana y actualiza el listado.',
        )
      }
      const response =
        Number(current.activo) === 1
          ? await productService.deactivate(current.id_producto)
          : await productService.update(current.id_producto, { ...current, activo: true })
      setStatusProduct(null)
      setSuccess(response.message)
      await refreshProducts()
    } catch (error) {
      setStatusError(productErrorMessage(error))
    } finally {
      pending.current = false
      setOperation('')
    }
  }

  const filtered = filterProducts(products, { search, ...filters })
  const categoryOptions = [
    ...new Map(products.map((p) => [String(p.id_categoria), p.categoria])).entries(),
  ]
  const brandOptions = [
    ...new Map(
      products.filter((p) => p.id_marca != null).map((p) => [String(p.id_marca), p.marca]),
    ).entries(),
  ]
  const busy = loading || !!operation
  const statusAction = Number(statusProduct?.activo) === 1 ? 'Desactivar' : 'Activar'

  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <h1 className="h4 mb-1">Productos</h1>
              <p className="text-body-secondary mb-0">Catálogo de productos de Tienda Celulares.</p>
            </div>
            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                disabled={busy}
                onClick={refreshProducts}
              >
                Actualizar
              </CButton>
              <CButton
                color="primary"
                disabled={busy || !can('PRODUCTOS_CREAR')}
                onClick={() => openEditor()}
              >
                Nuevo producto
              </CButton>
            </div>
          </div>
          {success && (
            <CAlert color="success" role="status">
              {success}
            </CAlert>
          )}
          {error && (
            <CAlert color="danger" role="alert">
              {error}
            </CAlert>
          )}
          {operation === 'opening' && (
            <div role="status" className="mb-3">
              <CSpinner size="sm" className="me-2" />
              Cargando formulario...
            </div>
          )}
          <CRow className="mb-3">
            <CCol md={6} lg={5}>
              <CFormLabel htmlFor="product-search">Buscar por nombre o SKU</CFormLabel>
              <CFormInput
                id="product-search"
                type="search"
                placeholder="Escribe el nombre o SKU"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </CCol>
            {[
              ['category', 'Categor?a', categoryOptions],
              ['brand', 'Marca', [['none', 'Sin marca'], ...brandOptions]],
              [
                'status',
                'Estado',
                [
                  ['1', 'Activo'],
                  ['0', 'Inactivo'],
                ],
              ],
              [
                'control',
                'Control',
                [
                  ['CANTIDAD', 'Cantidad'],
                  ['SERIALIZADO', 'Serializado'],
                ],
              ],
            ].map(([key, label, options]) => (
              <CCol md={3} key={key}>
                <CFormLabel htmlFor={'product-filter-' + key}>{label}</CFormLabel>
                <CFormSelect
                  id={'product-filter-' + key}
                  value={filters[key]}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, [key]: event.target.value }))
                  }
                >
                  <option value="">Todos</option>
                  {options.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            ))}
            <CCol xs={12} className="mt-2">
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setFilters({ category: '', brand: '', status: '', control: '' })
                }}
              >
                Limpiar filtros
              </CButton>
            </CCol>
          </CRow>
          {loading ? (
            <div className="text-center py-5" role="status">
              <CSpinner color="primary" />
              <div className="mt-2">Cargando productos...</div>
            </div>
          ) : (
            <>
              {error && products.length > 0 && (
                <p className="small text-body-secondary">
                  Se muestra el último listado cargado. Usa Actualizar para volver a consultar la
                  API.
                </p>
              )}
              <CTable responsive align="middle" hover className="mb-0">
                <CTableHead>
                  <CTableRow>
                    {[
                      'ID',
                      'SKU',
                      'Nombre',
                      'Categoría',
                      'Marca',
                      'Control de inventario',
                      'Precio de venta',
                      'Estado',
                      'Acciones',
                    ].map((title) => (
                      <CTableHeaderCell scope="col" key={title}>
                        {title}
                      </CTableHeaderCell>
                    ))}
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {filtered.map((product) => (
                    <CTableRow key={product.id_producto}>
                      <CTableDataCell>{product.id_producto}</CTableDataCell>
                      <CTableDataCell>{product.sku}</CTableDataCell>
                      <CTableDataCell>
                        <div>{product.nombre}</div>
                        <div className="small text-body-secondary">{product.descripcion}</div>
                        <div className="small text-body-secondary">
                          Garant?a: {product.dias_garantia} d?as ? Descuento:{' '}
                          {Number(product.permite_descuento) === 1
                            ? product.porcentaje_descuento_maximo + '%'
                            : 'No permitido'}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>{product.categoria}</CTableDataCell>
                      <CTableDataCell>{product.marca || 'Sin marca'}</CTableDataCell>
                      <CTableDataCell>
                        {product.tipo_control === 'CANTIDAD' ? 'Cantidad' : 'Serializado'}
                      </CTableDataCell>
                      <CTableDataCell className="text-nowrap">
                        {priceFormat.format(Number(product.precio_venta))}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={Number(product.activo) === 1 ? 'success' : 'secondary'}>
                          {Number(product.activo) === 1 ? 'Activo' : 'Inactivo'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex gap-2">
                          <CButton
                            size="sm"
                            color="primary"
                            variant="outline"
                            disabled={busy || !can('PRODUCTOS_EDITAR')}
                            onClick={() => openEditor(product)}
                            aria-label={`Editar ${product.nombre}`}
                          >
                            Editar
                          </CButton>
                          <CButton
                            size="sm"
                            color={Number(product.activo) === 1 ? 'warning' : 'success'}
                            variant="outline"
                            disabled={
                              busy ||
                              !can(
                                Number(product.activo) === 1
                                  ? 'PRODUCTOS_ELIMINAR'
                                  : 'PRODUCTOS_EDITAR',
                              )
                            }
                            onClick={() => {
                              setStatusError('')
                              can(
                                Number(product.activo) === 1
                                  ? 'PRODUCTOS_ELIMINAR'
                                  : 'PRODUCTOS_EDITAR',
                              ) && setStatusProduct(product)
                            }}
                            aria-label={`${Number(product.activo) === 1 ? 'Desactivar' : 'Activar'} ${product.nombre}`}
                          >
                            {Number(product.activo) === 1 ? 'Desactivar' : 'Activar'}
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  {!filtered.length && (
                    <CTableRow>
                      <CTableDataCell colSpan={9} className="text-center py-4">
                        {error
                          ? 'No hay registros disponibles para mostrar.'
                          : products.length
                            ? 'No hay productos que coincidan con la búsqueda.'
                            : 'No hay productos registrados.'}
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
              <p className="small text-body-secondary mt-3 mb-0">
                {filtered.length} de {products.length} productos.
              </p>
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal
        visible={!!editor && can(editor.product ? 'PRODUCTOS_EDITAR' : 'PRODUCTOS_CREAR')}
        size="lg"
        backdrop="static"
        keyboard={!operation}
        onClose={() => {
          if (!operation) setEditor(null)
        }}
        aria-labelledby="product-editor-title"
      >
        <CModalHeader closeButton={!operation}>
          <CModalTitle id="product-editor-title">
            {editor?.product ? 'Editar producto' : 'Nuevo producto'}
          </CModalTitle>
        </CModalHeader>
        {editor && (
          <ProductForm
            product={editor.product}
            categories={editor.categories}
            brands={editor.brands}
            saving={operation === 'saving'}
            error={formError}
            onSave={saveProduct}
            onCancel={() => setEditor(null)}
          />
        )}
      </CModal>

      <CModal
        visible={
          !!statusProduct &&
          can(Number(statusProduct.activo) === 1 ? 'PRODUCTOS_ELIMINAR' : 'PRODUCTOS_EDITAR')
        }
        backdrop="static"
        keyboard={!operation}
        onClose={() => {
          if (!operation) setStatusProduct(null)
        }}
        aria-labelledby="product-status-title"
      >
        <CModalHeader closeButton={!operation}>
          <CModalTitle id="product-status-title">{statusAction} producto</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {statusError && (
            <CAlert color="danger" role="alert">
              {statusError}
            </CAlert>
          )}
          <p>
            ¿Deseas {statusAction.toLowerCase()} el producto{' '}
            <strong>{statusProduct?.nombre}</strong> ({statusProduct?.sku})?
          </p>
          <p className="text-body-secondary mb-0">El producto y su historial se conservarán.</p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            disabled={!!operation}
            onClick={() => setStatusProduct(null)}
          >
            Cancelar
          </CButton>
          <CButton color="primary" disabled={!!operation} onClick={changeStatus}>
            {operation === 'status' && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
            {operation === 'status' ? 'Procesando...' : statusAction}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Products
