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
  CFormCheck,
} from '@coreui/react'
import SaleSummary from './SaleSummary'
import { clearSaleSelections } from './saleAvailability'
import { useSaleUnits } from './useSaleUnits'
import {
  availableUnits,
  money,
  round,
  stockFor,
  totals,
  unitLabel,
  validateLines,
} from './saleModel'

const noUnits = async () => []
const SaleForm = ({
  catalog,
  saving,
  error,
  onSave,
  onCancel,
  canReadUnits = false,
  loadUnits = noUnits,
}) => {
  const [values, setValues] = useState({
    numero_venta: '',
    id_cliente: '',
    id_sucursal: '',
    tipo_venta: 'CONTADO',
    observacion: '',
    detalles: [],
  })
  const [productId, setProductId] = useState('')
  const [review, setReview] = useState(false)
  const [checked, setChecked] = useState(false)
  const [validation, setValidation] = useState('')
  const products = catalog.products.filter((p) => Number(p.activo) === 1)
  const clients = catalog.clients.filter((c) => Number(c.activo) === 1)
  const branches = [...new Map(catalog.stock.map((r) => [String(r.id_sucursal), r])).values()]
  const serialProducts = [
    ...new Set([
      ...values.detalles
        .filter((line) => line.tipo_control === 'SERIALIZADO')
        .map((line) => String(line.id_producto)),
      ...products
        .filter(
          (product) =>
            String(product.id_producto) === productId && product.tipo_control === 'SERIALIZADO',
        )
        .map((product) => String(product.id_producto)),
    ]),
  ].sort()
  const branch = values.id_sucursal
  const scope = JSON.stringify([branch, productId, serialProducts])
  const availability = useSaleUnits(scope, canReadUnits, loadUnits)
  const units = availability.rows
  const unitsBusy = serialProducts.length > 0 && availability.loading
  const unitError =
    catalog.unitError ||
    availability.error ||
    (!canReadUnits && products.some((p) => p.tipo_control === 'SERIALIZADO')
      ? 'No tienes permiso para consultar dispositivos disponibles.'
      : '')
  const set = (key, value) => setValues((old) => ({ ...old, [key]: value }))
  const update = (index, key, value) =>
    set(
      'detalles',
      values.detalles.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    )
  const add = () => {
    const p = products.find((p) => String(p.id_producto) === productId)
    if (!p || values.detalles.some((l) => String(l.id_producto) === productId)) return
    if (
      p.tipo_control === 'SERIALIZADO' &&
      (!canReadUnits ||
        unitsBusy ||
        unitError ||
        !availableUnits(units, branch, p.id_producto).length)
    )
      return
    set('detalles', [
      ...clearSaleSelections(values.detalles),
      {
        ...p,
        producto: p.nombre,
        precio_unitario: p.precio_venta,
        cantidad: 1,
        descuento: 0,
        impuesto: 0,
        selected: [],
      },
    ])
    setProductId('')
  }
  const summary = () => {
    const c = clients.find((c) => String(c.id_cliente) === values.id_cliente)
    return {
      ...values,
      ...totals(values.detalles),
      cliente: [c?.nombres, c?.apellidos].filter(Boolean).join(' '),
      identificacion_cliente: c?.identificacion,
      sucursal: branches.find((b) => String(b.id_sucursal) === values.id_sucursal)?.sucursal,
      detalles: values.detalles.map((l) => ({
        ...l,
        subtotal: round(
          round(l.cantidad * round(l.precio_unitario)) - round(l.descuento) + round(l.impuesto),
        ),
        unidades: units.filter((u) => l.selected.includes(String(u.id_unidad))),
      })),
    }
  }
  const submit = (e) => {
    e.preventDefault()
    try {
      if (
        !clients.some((c) => String(c.id_cliente) === values.id_cliente) ||
        !branches.some((b) => String(b.id_sucursal) === values.id_sucursal)
      )
        throw new Error('Selecciona cliente y sucursal.')
      if (
        !values.numero_venta.trim() ||
        values.numero_venta.trim().length > 50 ||
        values.observacion.trim().length > 500
      )
        throw new Error('Revisa número de venta y observación.')
      if (
        values.detalles.some((line) => line.tipo_control === 'SERIALIZADO') &&
        (unitsBusy || unitError || !canReadUnits)
      ) {
        throw new Error(unitError || 'Espera la consulta de dispositivos disponibles.')
      }
      validateLines(values, catalog.stock, units)
      setValidation('')
      setChecked(false)
      setReview(true)
    } catch (e) {
      setValidation(e.message)
    }
  }
  return (
    <>
      {error && <CAlert color="danger">{error}</CAlert>}
      {validation && <CAlert color="danger">{validation}</CAlert>}
      {(!clients.length || !products.length || !branches.length) && (
        <CAlert color="warning">
          Se necesita un cliente activo, un producto activo y una sucursal con inventario
          consultable. No se simulan existencias ni se permiten sucursales sin registro de
          inventario.
        </CAlert>
      )}
      {unitError && (
        <CAlert color="warning">
          No se pueden vender serializados sin consultar unidades: {unitError}
        </CAlert>
      )}
      {unitsBusy && <p role="status">Consultando dispositivos disponibles…</p>}
      {!unitsBusy && serialProducts.length > 0 && !unitError && !units.length && (
        <p>No hay dispositivos disponibles para la selección.</p>
      )}
      {review ? (
        <>
          <SaleSummary sale={summary()} />
          <CAlert color="info">
            Se creará un BORRADOR. No reserva stock ni registra pagos. Después deberás confirmar la
            venta; los precios definitivos los calcula el servidor.
          </CAlert>
          <CFormCheck
            id="sale-review"
            label="He revisado los datos y autorizo guardar el borrador"
            checked={checked}
            disabled={saving}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <CButton
            className="me-2 mt-3"
            disabled={saving}
            color="secondary"
            onClick={() => setReview(false)}
          >
            Editar
          </CButton>
          <CButton
            className="mt-3"
            disabled={saving || !checked}
            color="primary"
            onClick={() => onSave(values)}
          >
            Guardar borrador
          </CButton>
        </>
      ) : (
        <CForm onSubmit={submit}>
          <fieldset disabled={saving}>
            <CFormLabel htmlFor="sale-number">Número de venta</CFormLabel>
            <CFormInput
              id="sale-number"
              required
              maxLength={50}
              value={values.numero_venta}
              onChange={(e) => set('numero_venta', e.target.value)}
            />
            <CFormLabel htmlFor="sale-client">Cliente</CFormLabel>
            <CFormSelect
              id="sale-client"
              required
              value={values.id_cliente}
              onChange={(e) => set('id_cliente', e.target.value)}
            >
              <option value="">Selecciona un cliente activo</option>
              {clients.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.nombres} {c.apellidos} · {c.identificacion}
                </option>
              ))}
            </CFormSelect>
            <CFormLabel htmlFor="sale-branch">Sucursal</CFormLabel>
            <CFormSelect
              id="sale-branch"
              required
              value={values.id_sucursal}
              onChange={(e) => {
                setValues((old) => ({ ...old, id_sucursal: e.target.value, detalles: [] }))
                setProductId('')
              }}
            >
              <option value="">Selecciona sucursal del inventario</option>
              {branches.map((b) => (
                <option key={b.id_sucursal} value={b.id_sucursal}>
                  {b.codigo_sucursal} · {b.sucursal}
                </option>
              ))}
            </CFormSelect>
            <small>
              Al cambiar de sucursal se vacían los productos. El servidor valida que la sucursal
              siga activa.
            </small>
            <CFormLabel htmlFor="sale-type" className="d-block mt-2">
              Condición
            </CFormLabel>
            <CFormSelect
              id="sale-type"
              value={values.tipo_venta}
              onChange={(e) => set('tipo_venta', e.target.value)}
            >
              <option>CONTADO</option>
              <option>CREDITO</option>
            </CFormSelect>
            <CAlert color="info" className="mt-2">
              Importes en NIO. Los pagos se registran por separado. CREDITO requiere crear
              posteriormente su plan en Créditos; confirmar la venta no lo genera.
            </CAlert>
            <CFormLabel htmlFor="sale-product">Producto</CFormLabel>
            <CFormSelect
              id="sale-product"
              disabled={!values.id_sucursal}
              value={productId}
              onChange={(e) => {
                set('detalles', clearSaleSelections(values.detalles))
                setProductId(e.target.value)
              }}
            >
              <option value="">Selecciona producto</option>
              {products
                .filter(
                  (p) =>
                    !values.detalles.some((l) => Number(l.id_producto) === Number(p.id_producto)),
                )
                .map((p) => (
                  <option
                    key={p.id_producto}
                    value={p.id_producto}
                    disabled={
                      Number(stockFor(catalog.stock, values.id_sucursal, p.id_producto) || 0) <=
                        0 ||
                      (p.tipo_control === 'SERIALIZADO' && !canReadUnits)
                    }
                  >
                    {p.sku} · {p.nombre} · {p.tipo_control} · Stock{' '}
                    {stockFor(catalog.stock, values.id_sucursal, p.id_producto) ?? 'sin registro'}
                  </option>
                ))}
            </CFormSelect>
            <CButton
              color="secondary"
              className="my-2"
              disabled={
                !productId ||
                unitsBusy ||
                (!!unitError &&
                  products.some(
                    (p) => String(p.id_producto) === productId && p.tipo_control === 'SERIALIZADO',
                  ))
              }
              onClick={add}
            >
              Agregar producto
            </CButton>
            {values.detalles.map((l, i) => (
              <div className="border rounded p-3 mb-3" key={l.id_producto}>
                <strong>
                  {l.sku} · {l.producto} · {l.tipo_control}
                </strong>
                <p>
                  Precio: C$ {money(l.precio_unitario)} · Stock consultado:{' '}
                  {stockFor(catalog.stock, values.id_sucursal, l.id_producto)}
                </p>
                <CFormLabel htmlFor={`sale-qty-${i}`}>Cantidad</CFormLabel>
                <CFormInput
                  id={`sale-qty-${i}`}
                  type="number"
                  min={1}
                  step={1}
                  required
                  max={stockFor(catalog.stock, values.id_sucursal, l.id_producto)}
                  value={l.cantidad}
                  onChange={(e) => {
                    set(
                      'detalles',
                      values.detalles.map((row, index) =>
                        index === i ? { ...row, cantidad: e.target.value, selected: [] } : row,
                      ),
                    )
                  }}
                />
                {l.tipo_control === 'SERIALIZADO' && (
                  <>
                    <CFormLabel htmlFor={`sale-units-${i}`}>
                      Unidades disponibles (selecciona {l.cantidad})
                    </CFormLabel>
                    <CFormSelect
                      id={`sale-units-${i}`}
                      disabled={unitsBusy || !!unitError || !canReadUnits}
                      multiple
                      value={l.selected}
                      onChange={(e) =>
                        update(
                          i,
                          'selected',
                          Array.from(e.target.selectedOptions, (o) => o.value),
                        )
                      }
                    >
                      {availableUnits(units, values.id_sucursal, l.id_producto).map((u) => (
                        <option key={u.id_unidad} value={u.id_unidad}>
                          {unitLabel(u)}
                        </option>
                      ))}
                    </CFormSelect>
                  </>
                )}
                <CFormLabel htmlFor={`sale-discount-${i}`}>
                  Descuento de línea NIO (máximo {l.porcentaje_descuento_maximo || 0}%)
                </CFormLabel>
                <CFormInput
                  id={`sale-discount-${i}`}
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={Number(l.permite_descuento) !== 1}
                  value={l.descuento}
                  onChange={(e) => update(i, 'descuento', e.target.value)}
                />
                <CFormLabel htmlFor={`sale-tax-${i}`}>Impuesto de línea NIO (importe)</CFormLabel>
                <CFormInput
                  id={`sale-tax-${i}`}
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={l.impuesto}
                  onChange={(e) => update(i, 'impuesto', e.target.value)}
                />
                <p>
                  Importe: C${' '}
                  {money(
                    round(l.cantidad * round(l.precio_unitario)) -
                      round(l.descuento) +
                      round(l.impuesto),
                  )}
                </p>
                <CButton
                  color="danger"
                  variant="outline"
                  onClick={() =>
                    set(
                      'detalles',
                      clearSaleSelections(values.detalles.filter((_, index) => index !== i)),
                    )
                  }
                >
                  Quitar
                </CButton>
              </div>
            ))}
            <h5>Total estimado: C$ {money(totals(values.detalles).total)}</h5>
            <CFormLabel htmlFor="sale-note">Observación</CFormLabel>
            <CFormTextarea
              id="sale-note"
              maxLength={500}
              value={values.observacion}
              onChange={(e) => set('observacion', e.target.value)}
            />
            <CButton
              type="submit"
              color="primary"
              className="mt-3"
              disabled={!values.detalles.length}
            >
              Revisar venta
            </CButton>
          </fieldset>
        </CForm>
      )}
      <CButton className="mt-3 ms-2" color="secondary" disabled={saving} onClick={onCancel}>
        Cerrar
      </CButton>
    </>
  )
}
SaleForm.propTypes = {
  catalog: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  canReadUnits: PropTypes.bool,
  loadUnits: PropTypes.func,
}
export default SaleForm
