import React, { useId, useState } from 'react'
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
const ProductPlaceholder = () => (
  <span className="pos-product-image" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <rect x="13" y="5" width="22" height="38" rx="5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 10h8M22 37h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </span>
)
const SaleForm = ({
  catalog,
  saving,
  error,
  onSave,
  onCancel,
  canReadUnits = false,
  loadUnits = noUnits,
}) => {
  const formId = useId()
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
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
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
  const add = (selectedId = productId) => {
    const p = products.find((p) => String(p.id_producto) === selectedId)
    if (!p || values.detalles.some((l) => String(l.id_producto) === selectedId)) return
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
  const changeQuantity = (index, quantity) =>
    set(
      'detalles',
      values.detalles.map((row, i) =>
        i === index ? { ...row, cantidad: quantity, selected: [] } : row,
      ),
    )
  const categories = [
    ...new Map(
      products
        .filter((p) => p.id_categoria != null && p.categoria)
        .map((p) => [String(p.id_categoria), p.categoria]),
    ).entries(),
  ]
  const shownProducts = products.filter(
    (p) =>
      (!category || String(p.id_categoria) === category) &&
      `${p.nombre} ${p.sku}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const amounts = totals(values.detalles)
  return (
    <div className={`sale-pos ${review ? 'sale-pos-review' : ''}`}>
      <div className="pos-notices" aria-live="polite">
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
      </div>
      {review ? (
        <div className="pos-review-content">
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
        </div>
      ) : (
        <CForm
          id={formId}
          className="pos-form"
          onSubmit={submit}
          onInvalidCapture={(event) => {
            const section = event.target.closest('details')
            if (section) section.open = true
          }}
        >
          <fieldset disabled={saving} className="pos-workspace">
            <section className="pos-catalog" aria-labelledby="pos-catalog-title">
              <div className="pos-catalog-heading">
                <div>
                  <span className="pos-eyebrow">PUNTO DE VENTA</span>
                  <h2 id="pos-catalog-title">Catálogo de productos</h2>
                  <p>Encuentra el producto y agrégalo a tu venta.</p>
                </div>
                <span className="pos-count">{shownProducts.length} productos</span>
              </div>
              <div className="pos-search">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="m16 16 4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <CFormLabel htmlFor="pos-search" className="visually-hidden">
                  Buscar por nombre o SKU
                </CFormLabel>
                <CFormInput
                  id="pos-search"
                  type="search"
                  placeholder="Buscar por nombre o SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="pos-categories" role="group" aria-label="Filtrar por categoría">
                <CButton
                  type="button"
                  className={!category ? 'is-selected' : ''}
                  aria-pressed={!category}
                  onClick={() => setCategory('')}
                >
                  Todos
                </CButton>
                {categories.map(([id, name]) => (
                  <CButton
                    type="button"
                    key={id}
                    className={category === id ? 'is-selected' : ''}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {name}
                  </CButton>
                ))}
              </div>
              <div className="pos-quick-add">
                <CFormLabel htmlFor="sale-product" className="visually-hidden">
                  Producto
                </CFormLabel>
                <CFormSelect
                  id="sale-product"
                  disabled={!values.id_sucursal}
                  value={productId}
                  onChange={(e) => {
                    set('detalles', clearSaleSelections(values.detalles))
                    setProductId(e.target.value)
                  }}
                >
                  <option value="">Seleccionar producto / consultar IMEI</option>
                  {products
                    .filter(
                      (p) =>
                        !values.detalles.some(
                          (l) => Number(l.id_producto) === Number(p.id_producto),
                        ),
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
                        {stockFor(catalog.stock, values.id_sucursal, p.id_producto) ??
                          'sin registro'}
                      </option>
                    ))}
                </CFormSelect>
                <CButton
                  type="button"
                  color="primary"
                  disabled={
                    !productId ||
                    unitsBusy ||
                    (!!unitError &&
                      products.some(
                        (p) =>
                          String(p.id_producto) === productId && p.tipo_control === 'SERIALIZADO',
                      ))
                  }
                  onClick={() => add()}
                >
                  Agregar producto
                </CButton>
              </div>
              <p className="pos-catalog-help">
                {!values.id_sucursal
                  ? 'Selecciona la sucursal en los datos de la venta para consultar existencias.'
                  : productId
                    ? 'Producto seleccionado. Usa «Agregar producto» al terminar la consulta; los IMEI se eligen en el carrito.'
                    : 'Los productos con IMEI requieren seleccionar y consultar sus dispositivos antes de agregarlos.'}
              </p>
              <div className="pos-catalog-scroll">
                <div className="pos-product-grid">
                  {shownProducts.map((p) => {
                    const stock = stockFor(catalog.stock, values.id_sucursal, p.id_producto)
                    const added = values.detalles.some(
                      (l) => String(l.id_producto) === String(p.id_producto),
                    )
                    const unavailable =
                      !values.id_sucursal ||
                      Number(stock || 0) <= 0 ||
                      (p.tipo_control === 'SERIALIZADO' && !canReadUnits)
                    return (
                      <article
                        className={`pos-product-card ${productId === String(p.id_producto) ? 'is-selected' : ''}`}
                        key={p.id_producto}
                      >
                        <ProductPlaceholder />
                        <span className="pos-product-category">
                          {p.categoria || p.tipo_control}
                        </span>
                        <h3 title={p.nombre}>{p.nombre}</h3>
                        <span className="pos-sku">{p.sku}</span>
                        <strong className="pos-price">C$ {money(p.precio_venta)}</strong>
                        <span className="pos-stock">
                          {!values.id_sucursal
                            ? 'Elige una sucursal'
                            : stock == null
                              ? 'Sin registro de stock'
                              : `${stock} disponibles`}
                        </span>
                        <CButton
                          type="button"
                          color="primary"
                          variant={added ? 'outline' : undefined}
                          disabled={unavailable || added}
                          aria-label={`${added ? 'Agregado' : 'Agregar'} ${p.nombre}`}
                          onClick={() => {
                            if (p.tipo_control === 'SERIALIZADO') {
                              set('detalles', clearSaleSelections(values.detalles))
                              setProductId(String(p.id_producto))
                            } else add(String(p.id_producto))
                          }}
                        >
                          {added ? 'Agregado' : '+ Agregar'}
                        </CButton>
                      </article>
                    )
                  })}
                </div>
                {!shownProducts.length && (
                  <div className="pos-empty" role="status">
                    <ProductPlaceholder />
                    <strong>No hay productos para mostrar</strong>
                    <p>Prueba otro nombre, SKU o categoría.</p>
                  </div>
                )}
              </div>
            </section>
            <section className="pos-cart" aria-labelledby="pos-cart-title">
              <div className="pos-cart-scroll">
                <div className="pos-cart-tabs">
                  <h2 id="pos-cart-title">
                    Venta actual <span>{values.detalles.length}</span>
                  </h2>
                  <button
                    type="button"
                    disabled
                    title="Ventas guardadas no está disponible en esta etapa"
                  >
                    Ventas guardadas <span aria-hidden="true">⌁</span>
                  </button>
                </div>
                <div className="pos-sale-data">
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
                  <div className="pos-data-grid">
                    <div>
                      <CFormLabel htmlFor="sale-number">Número de venta</CFormLabel>
                      <CFormInput
                        id="sale-number"
                        required
                        maxLength={50}
                        value={values.numero_venta}
                        onChange={(e) => set('numero_venta', e.target.value)}
                      />
                    </div>
                    <div>
                      <CFormLabel htmlFor="sale-type">Condición</CFormLabel>
                      <CFormSelect
                        id="sale-type"
                        value={values.tipo_venta}
                        onChange={(e) => set('tipo_venta', e.target.value)}
                      >
                        <option>CONTADO</option>
                        <option>CREDITO</option>
                      </CFormSelect>
                    </div>
                    <div className="pos-data-wide">
                      <CFormLabel htmlFor="sale-branch">Sucursal</CFormLabel>
                      <CFormSelect
                        id="sale-branch"
                        required
                        value={values.id_sucursal}
                        onChange={(e) => {
                          setValues((old) => ({
                            ...old,
                            id_sucursal: e.target.value,
                            detalles: [],
                          }))
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
                    </div>
                  </div>
                  <p className="pos-helper">
                    Al cambiar de sucursal se vacían los productos. El servidor valida que la
                    sucursal siga activa.
                  </p>
                </div>
                <div className="pos-cart-items">
                  {!values.detalles.length && (
                    <div className="pos-empty">
                      <ProductPlaceholder />
                      <strong>Tu venta comienza aquí</strong>
                      <p>Agrega productos del catálogo para preparar el borrador.</p>
                    </div>
                  )}
                  {values.detalles.map((l, i) => (
                    <article className="pos-cart-item" key={l.id_producto}>
                      <div className="pos-item-heading">
                        <ProductPlaceholder />
                        <div>
                          <h3>{l.producto}</h3>
                          <span className="pos-sku">
                            {l.sku} · {l.tipo_control}
                          </span>
                          <span className="pos-unit-price">
                            C$ {money(l.precio_unitario)} por unidad
                          </span>
                        </div>
                        <CButton
                          type="button"
                          color="danger"
                          variant="ghost"
                          className="pos-remove"
                          aria-label={`Quitar ${l.producto}`}
                          onClick={() =>
                            set(
                              'detalles',
                              clearSaleSelections(
                                values.detalles.filter((_, index) => index !== i),
                              ),
                            )
                          }
                        >
                          ×
                        </CButton>
                      </div>
                      <div className="pos-item-amount">
                        <div className="pos-quantity">
                          <CFormLabel htmlFor={`sale-qty-${i}`} className="visually-hidden">
                            Cantidad de {l.producto}
                          </CFormLabel>
                          <CButton
                            type="button"
                            aria-label={`Disminuir cantidad de ${l.producto}`}
                            disabled={Number(l.cantidad) <= 1}
                            onClick={() => changeQuantity(i, Number(l.cantidad) - 1)}
                          >
                            −
                          </CButton>
                          <CFormInput
                            id={`sale-qty-${i}`}
                            type="number"
                            min={1}
                            step={1}
                            required
                            max={stockFor(catalog.stock, values.id_sucursal, l.id_producto)}
                            value={l.cantidad}
                            onChange={(e) => changeQuantity(i, e.target.value)}
                          />
                          <CButton
                            type="button"
                            aria-label={`Aumentar cantidad de ${l.producto}`}
                            disabled={
                              Number(l.cantidad) >=
                              Number(stockFor(catalog.stock, values.id_sucursal, l.id_producto))
                            }
                            onClick={() => changeQuantity(i, Number(l.cantidad) + 1)}
                          >
                            +
                          </CButton>
                        </div>
                        <strong>
                          C${' '}
                          {money(
                            round(l.cantidad * round(l.precio_unitario)) -
                              round(l.descuento) +
                              round(l.impuesto),
                          )}
                        </strong>
                      </div>
                      <span className="pos-helper">
                        Stock consultado:{' '}
                        {stockFor(catalog.stock, values.id_sucursal, l.id_producto)}
                      </span>
                      {l.tipo_control === 'SERIALIZADO' && (
                        <div className="pos-imei">
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
                        </div>
                      )}
                      <details className="pos-line-options">
                        <summary>Descuento e impuesto de línea</summary>
                        <div className="pos-data-grid">
                          <div>
                            <CFormLabel htmlFor={`sale-discount-${i}`}>
                              Descuento NIO (máx. {l.porcentaje_descuento_maximo || 0}%)
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
                          </div>
                          <div>
                            <CFormLabel htmlFor={`sale-tax-${i}`}>
                              Impuesto NIO (importe)
                            </CFormLabel>
                            <CFormInput
                              id={`sale-tax-${i}`}
                              type="number"
                              step="0.01"
                              min={0}
                              required
                              value={l.impuesto}
                              onChange={(e) => update(i, 'impuesto', e.target.value)}
                            />
                          </div>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </div>
              <div className="pos-cart-bottom">
                <details className="pos-note">
                  <summary>Observación y condiciones</summary>
                  <CFormLabel htmlFor="sale-note" className="visually-hidden">
                    Observación
                  </CFormLabel>
                  <CFormTextarea
                    id="sale-note"
                    maxLength={500}
                    value={values.observacion}
                    onChange={(e) => set('observacion', e.target.value)}
                  />
                  <p className="pos-helper">
                    Importes en NIO. Los pagos se registran por separado. CREDITO requiere crear
                    posteriormente su plan en Créditos; confirmar la venta no lo genera.
                  </p>
                </details>
                <dl className="pos-totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>C$ {money(amounts.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>Descuento</dt>
                    <dd>C$ {money(amounts.descuento)}</dd>
                  </div>
                  <div>
                    <dt>Impuesto ingresado</dt>
                    <dd>C$ {money(amounts.impuesto)}</dd>
                  </div>
                  <div className="pos-grand-total">
                    <dt>Total estimado</dt>
                    <dd>C$ {money(amounts.total)}</dd>
                  </div>
                </dl>
              </div>
            </section>
          </fieldset>
        </CForm>
      )}
      <div className="modal-actions pos-actions">
        <span className="pos-actions-note">
          {review
            ? 'Revisa el borrador antes de guardarlo.'
            : 'La venta se revisa antes de guardar el borrador.'}
        </span>
        <CButton color="secondary" variant="outline" disabled={saving} onClick={onCancel}>
          Cancelar
        </CButton>
        {review ? (
          <>
            <CButton disabled={saving} color="secondary" onClick={() => setReview(false)}>
              Editar
            </CButton>
            <CButton disabled={saving || !checked} color="primary" onClick={() => onSave(values)}>
              Guardar borrador
            </CButton>
          </>
        ) : (
          <CButton
            type="submit"
            form={formId}
            color="primary"
            disabled={saving || !values.detalles.length}
          >
            Revisar venta <span aria-hidden="true">→</span>
          </CButton>
        )}
      </div>
    </div>
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
