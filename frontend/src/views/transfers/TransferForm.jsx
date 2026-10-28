import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CFormCheck,
  CRow,
  CCol,
} from '@coreui/react'
import { availableProducts, availableUnits, validateTransfer } from './transferModel'

const TransferForm = ({ catalog, busy, onSave }) => {
  const [values, setValues] = useState({
    numero_transferencia: '',
    id_sucursal_origen: '',
    id_sucursal_destino: '',
    observacion: '',
    detalles: [],
  })
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selected, setSelected] = useState([])
  const [unitSearch, setUnitSearch] = useState('')
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const products = availableProducts(catalog, values.id_sucursal_origen)
  const product = products.find((p) => String(p.id_producto) === productId)
  const change = (e) => {
    setReview(false)
    setConfirmed(false)
    setValues({
      ...values,
      [e.target.name]: e.target.value,
      ...(e.target.name === 'id_sucursal_origen' && { detalles: [] }),
    })
    if (e.target.name === 'id_sucursal_origen') {
      setProductId('')
      setSelected([])
    }
  }
  const branchControl = (name, label) => (
    <CCol md={6}>
      <CFormSelect
        id={`transfer-${name}-select`}
        className="mb-2"
        label={label}
        name={name}
        value={catalog.branches.some((b) => b.id === values[name]) ? values[name] : ''}
        onChange={change}
      >
        <option value="">Selecciona una sucursal conocida</option>
        {catalog.branches.map((b) => (
          <option value={b.id} key={b.id}>
            {b.label}
          </option>
        ))}
      </CFormSelect>
      <CFormInput
        id={`transfer-${name}-manual`}
        label={`${label}: ID existente si no aparece en la lista`}
        type="number"
        min="1"
        step="1"
        name={name}
        value={values[name]}
        onChange={change}
        required
      />
    </CCol>
  )
  return (
    <CForm
      onSubmit={(e) => {
        e.preventDefault()
        if (busy) return
        try {
          if (productId)
            throw new Error(
              'Agrega el artículo en edición o limpia la selección de producto antes de revisar.',
            )
          validateTransfer(values, catalog)
          if (!review) {
            setReview(true)
            setConfirmed(false)
            setError('')
            return
          }
          if (confirmed) {
            setConfirmed(false)
            onSave(values)
          }
        } catch (err) {
          setError(err.message)
          setReview(false)
          setConfirmed(false)
        }
      }}
    >
      {error && <CAlert color="danger">{error}</CAlert>}
      <fieldset disabled={busy}>
        <CFormInput
          id="transfer-number"
          className="mb-3"
          label="Número de transferencia"
          name="numero_transferencia"
          maxLength={50}
          value={values.numero_transferencia}
          onChange={change}
          required
        />
        <CRow className="g-3 mb-3">
          {branchControl('id_sucursal_origen', 'Sucursal origen')}
          {branchControl('id_sucursal_destino', 'Sucursal destino')}
        </CRow>
        <p className="small text-body-secondary">
          La API no ofrece catálogo de sucursales. Se muestran las conocidas por inventario y
          transferencias; el servidor valida que existan y estén activas. Cambiar origen elimina los
          artículos seleccionados.
        </p>
        <CFormTextarea
          id="transfer-observation"
          className="mb-3"
          label="Observación (opcional)"
          name="observacion"
          maxLength={500}
          value={values.observacion}
          onChange={change}
        />
        <CFormSelect
          id="transfer-product"
          className="mb-3"
          label="Producto disponible en origen"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value)
            setSelected([])
            setQuantity('1')
            setReview(false)
            setConfirmed(false)
          }}
        >
          <option value="">Selecciona producto</option>
          {products
            .filter(
              (p) => !values.detalles.some((d) => Number(d.id_producto) === Number(p.id_producto)),
            )
            .map((p) => (
              <option key={p.id_producto} value={p.id_producto}>
                {p.nombre} · {p.sku} · {p.tipo_control}
              </option>
            ))}
        </CFormSelect>
        {!products.length && (
          <p>No hay productos disponibles con los catálogos consultados para este origen.</p>
        )}
        {product && (
          <>
            <p>
              Stock consultado:{' '}
              {
                catalog.stock.find(
                  (s) =>
                    Number(s.id_sucursal) === Number(values.id_sucursal_origen) &&
                    Number(s.id_producto) === Number(productId),
                )?.stock_actual
              }
            </p>
            {product.tipo_control === 'CANTIDAD' ? (
              <CFormInput
                id="transfer-quantity"
                label="Cantidad a transferir"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            ) : (
              <>
                <CFormInput
                  id="transfer-unit-search"
                  className="mb-2"
                  label="Buscar IMEI o serie"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                />
                <div className="border rounded p-3 mb-3 overflow-auto" style={{ maxHeight: 260 }}>
                  {availableUnits(catalog.units || [], values.id_sucursal_origen, productId)
                    .filter((u) =>
                      [u.imei1, u.imei2, u.numero_serie].some((v) =>
                        String(v ?? '').includes(unitSearch.trim()),
                      ),
                    )
                    .map((u) => (
                      <CFormCheck
                        key={u.id_unidad}
                        id={`transfer-unit-${u.id_unidad}`}
                        label={`IMEI 1: ${u.imei1 || '—'} · IMEI 2: ${u.imei2 || '—'} · Serie: ${u.numero_serie || '—'}`}
                        checked={selected.includes(Number(u.id_unidad))}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...new Set([...selected, Number(u.id_unidad)])]
                              : selected.filter((v) => v !== Number(u.id_unidad)),
                          )
                        }
                      />
                    ))}
                </div>
                <p>{selected.length} dispositivos seleccionados</p>
              </>
            )}
            <CButton
              className="my-3"
              color="secondary"
              type="button"
              onClick={() => {
                const line = {
                  id_producto: Number(productId),
                  ...(product.tipo_control === 'SERIALIZADO'
                    ? { unidades: selected }
                    : { cantidad: quantity }),
                }
                const next = { ...values, detalles: [...values.detalles, line] }
                try {
                  validateTransfer(next, catalog)
                  setValues(next)
                  setProductId('')
                  setSelected([])
                  setReview(false)
                  setConfirmed(false)
                  setError('')
                } catch (err) {
                  setError(err.message)
                }
              }}
            >
              Agregar artículo
            </CButton>
          </>
        )}
        <h3 className="h6">Artículos seleccionados</h3>
        {!values.detalles.length && <p>No hay artículos agregados.</p>}
        <ul>
          {values.detalles.map((line) => (
            <li key={line.id_producto} className="mb-2">
              {
                catalog.products.find((p) => Number(p.id_producto) === Number(line.id_producto))
                  ?.nombre
              }{' '}
              · Cantidad: {line.unidades?.length ?? line.cantidad}
              {line.unidades && (
                <ul>
                  {line.unidades.map((value) => {
                    const u = catalog.units.find((unit) => Number(unit.id_unidad) === value)
                    return (
                      <li key={value}>
                        IMEI 1: {u?.imei1 || '—'} · IMEI 2: {u?.imei2 || '—'} · Serie:{' '}
                        {u?.numero_serie || '—'}
                      </li>
                    )
                  })}
                </ul>
              )}
              <CButton
                size="sm"
                color="danger"
                variant="outline"
                type="button"
                className="ms-2"
                onClick={() => {
                  setValues({ ...values, detalles: values.detalles.filter((d) => d !== line) })
                  setReview(false)
                  setConfirmed(false)
                }}
              >
                Quitar
              </CButton>
            </li>
          ))}
        </ul>
        {review && (
          <CAlert color="info">
            <strong>Resumen: {values.numero_transferencia}</strong>
            <p>
              {catalog.branches.find((b) => b.id === values.id_sucursal_origen)?.label ||
                `Sucursal #${values.id_sucursal_origen}`}{' '}
              →{' '}
              {catalog.branches.find((b) => b.id === values.id_sucursal_destino)?.label ||
                `Sucursal #${values.id_sucursal_destino}`}{' '}
              · {values.detalles.length} productos
            </p>
            Crear guarda un BORRADOR. No reserva ni mueve inventario. La disponibilidad se validará
            nuevamente al crear y al confirmar.
            <CFormCheck
              id="transfer-create-confirm"
              className="mt-2"
              label="Revisé sucursales, artículos e IMEI y confirmo crear el borrador"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
          </CAlert>
        )}
        <CButton color="primary" type="submit" disabled={busy || (review && !confirmed)}>
          {busy ? 'Procesando…' : review ? 'Crear borrador' : 'Revisar transferencia'}
        </CButton>
      </fieldset>
    </CForm>
  )
}
TransferForm.propTypes = {
  catalog: PropTypes.object.isRequired,
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}
export default TransferForm
