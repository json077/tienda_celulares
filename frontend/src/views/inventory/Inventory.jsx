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
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTab,
  CTabContent,
  CTabList,
  CTabPanel,
  CTabs,
} from '@coreui/react'
import { apiErrorMessage } from '../../services/api'
import { inventoryService } from '../../services/inventoryService'
import InventoryTable from './InventoryTable'
import InventoryOperationModal from './InventoryOperationModal'
import { branchId, filterInventoryRows, formatInventoryDate, inventoryLabel } from './inventoryView'

const sections = [
  { key: 'stock', label: 'Existencias' },
  { key: 'units', label: 'Dispositivos / IMEI' },
  { key: 'movements', label: 'Movimientos' },
]
const newDataset = () => ({ rows: [], loading: true, error: '' })
const newFilters = () => ({ query: '', branch: '', product: '', type: '', state: '' })

const Inventory = () => {
  const [active, setActive] = useState('stock')
  const [datasets, setDatasets] = useState({
    stock: newDataset(),
    units: newDataset(),
    movements: newDataset(),
  })
  const [filters, setFilters] = useState({
    stock: newFilters(),
    units: newFilters(),
    movements: newFilters(),
  })
  const [operation, setOperation] = useState(null)
  const [saving, setSaving] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [success, setSuccess] = useState('')
  const [movement, setMovement] = useState(null)
  const pending = useRef(false)

  const loadSections = useCallback(
    (keys, signal) =>
      Promise.allSettled(
        keys.map((key) =>
          inventoryService[key](signal)
            .then((response) => {
              if (!Array.isArray(response.data))
                throw new Error('El servidor devolvió un listado inválido.')
              if (!signal?.aborted) {
                setDatasets((current) => ({
                  ...current,
                  [key]: { rows: response.data, loading: false, error: '' },
                }))
              }
            })
            .catch((error) => {
              if (!signal?.aborted) {
                setDatasets((current) => ({
                  ...current,
                  [key]: { ...current[key], loading: false, error: apiErrorMessage(error) },
                }))
              }
            }),
        ),
      ),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadSections(['stock', 'units', 'movements'], controller.signal)
    return () => controller.abort()
  }, [loadSections])

  const refresh = async (keys) => {
    setDatasets((current) => {
      const next = { ...current }
      keys.forEach((key) => {
        next[key] = { ...current[key], loading: true, error: '' }
      })
      return next
    })
    await loadSections(keys)
  }

  const openOperation = (kind, row) => {
    setOperationError('')
    setSuccess('')
    setOperation({ kind, row })
  }

  const saveOperation = async (values) => {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setOperationError('')
    try {
      const response =
        operation.kind === 'minimum'
          ? await inventoryService.setMinimum(operation.row, values.stock_minimo)
          : await inventoryService.adjust(operation.row, values)
      setOperation(null)
      setSuccess(response.message)
      await refresh(['stock', 'movements'])
    } catch (error) {
      setOperationError(apiErrorMessage(error))
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  const current = datasets[active]
  const selection = filters[active]
  const updateFilter = (name, value) =>
    setFilters((current) => ({
      ...current,
      [active]: { ...current[active], [name]: value },
    }))
  const branches = [
    ...new Map(current.rows.map((row) => [branchId(active, row), row.sucursal])).entries(),
  ]
  const products = [
    ...new Map(
      current.rows.map((row) => [String(row.id_producto), `${row.producto} · ${row.sku}`]),
    ).entries(),
  ]
  const types = [...new Set(current.rows.map((row) => row.tipo).filter(Boolean))]
  const states = [...new Set(current.rows.map((row) => row.estado).filter(Boolean))]
  const rows = filterInventoryRows(current.rows, active, selection)
  const productCell = (row) => (
    <>
      <div>{row.producto}</div>
      <div className="small text-body-secondary">{row.sku}</div>
    </>
  )
  const columns = {
    stock: [
      { key: 'producto', label: 'Producto / SKU', render: productCell },
      { key: 'sucursal', label: 'Sucursal' },
      { key: 'tipo_control', label: 'Control', render: (row) => inventoryLabel(row.tipo_control) },
      { key: 'stock_actual', label: 'Stock actual' },
      { key: 'stock_minimo', label: 'Stock mínimo' },
      {
        key: 'stock_bajo',
        label: 'Nivel',
        render: (row) => (
          <CBadge color={Number(row.stock_bajo) === 1 ? 'warning' : 'success'}>
            {Number(row.stock_bajo) === 1 ? 'Stock bajo' : 'Sobre el mínimo'}
          </CBadge>
        ),
      },
      {
        key: 'actions',
        label: 'Acciones',
        render: (row) => (
          <div className="d-flex flex-wrap gap-2">
            {row.tipo_control === 'CANTIDAD' && (
              <CButton
                size="sm"
                color="primary"
                variant="outline"
                disabled={saving || current.loading}
                onClick={() => openOperation('adjust', row)}
                aria-label={`Ajustar ${row.producto} en ${row.sucursal}`}
              >
                Ajustar
              </CButton>
            )}
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              disabled={saving || current.loading}
              onClick={() => openOperation('minimum', row)}
              aria-label={`Stock mínimo de ${row.producto} en ${row.sucursal}`}
            >
              Stock mínimo
            </CButton>
          </div>
        ),
      },
    ],
    units: [
      {
        key: 'producto',
        label: 'Producto / SKU',
        render: (row) => (
          <>
            {productCell(row)}
            <div className="small text-body-secondary">Unidad #{row.id_unidad}</div>
          </>
        ),
      },
      {
        key: 'imei1',
        label: 'IMEI',
        render: (row) => (
          <div className="text-nowrap">
            <div>1: {row.imei1 || '—'}</div>
            <div>2: {row.imei2 || '—'}</div>
          </div>
        ),
      },
      { key: 'numero_serie', label: 'N.º de serie' },
      { key: 'sucursal', label: 'Sucursal actual' },
      {
        key: 'estado',
        label: 'Estado',
        render: (row) => (
          <CBadge
            color={
              row.estado === 'DISPONIBLE'
                ? 'success'
                : row.estado === 'DEFECTUOSO'
                  ? 'danger'
                  : 'secondary'
            }
          >
            {inventoryLabel(row.estado)}
          </CBadge>
        ),
      },
      { key: 'id_detalle_compra', label: 'Detalle de compra de origen' },
    ],
    movements: [
      {
        key: 'fecha',
        label: 'Fecha',
        render: (row) => (
          <div className="text-nowrap">
            {formatInventoryDate(row.fecha)}
            <div className="small text-body-secondary">#{row.id_movimiento}</div>
          </div>
        ),
      },
      { key: 'producto', label: 'Producto / SKU', render: productCell },
      { key: 'sucursal', label: 'Sucursal' },
      { key: 'tipo', label: 'Tipo', render: (row) => inventoryLabel(row.tipo) },
      {
        key: 'cantidad',
        label: 'Cantidad',
        render: (row) => (
          <span className={Number(row.cantidad) < 0 ? 'text-danger' : 'text-success'}>
            {Number(row.cantidad) > 0 ? '+' : ''}
            {row.cantidad}
          </span>
        ),
      },
      {
        key: 'stock',
        label: 'Stock anterior → nuevo',
        render: (row) => (
          <span className="text-nowrap">
            {row.stock_anterior} → {row.stock_nuevo}
          </span>
        ),
      },
      { key: 'usuario', label: 'Usuario' },
      {
        key: 'detail',
        label: 'Detalle',
        render: (row) => (
          <CButton
            size="sm"
            color="primary"
            variant="outline"
            onClick={() => setMovement(row)}
            aria-label={`Ver movimiento ${row.id_movimiento}`}
          >
            Ver detalle
          </CButton>
        ),
      },
    ],
  }
  const emptyMessage = current.error
    ? 'No hay datos disponibles para mostrar.'
    : current.rows.length
      ? 'No hay resultados para los filtros seleccionados.'
      : 'No hay registros en esta sección.'

  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <h1 className="h4">Inventario</h1>
          <p className="text-body-secondary">
            Existencias por sucursal, dispositivos serializados e historial de movimientos.
          </p>
          {success && (
            <CAlert color="success" role="status">
              {success}
            </CAlert>
          )}
          <CTabs activeItemKey={active} onChange={setActive}>
            <CTabList variant="tabs" aria-label="Secciones de inventario">
              {sections.map(({ key, label }) => (
                <CTab key={key} itemKey={key}>
                  {label}
                </CTab>
              ))}
            </CTabList>
            <CTabContent>
              <CTabPanel key={active} itemKey={active} transition={false} className="pt-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h2 className="h5 mb-0">{sections.find(({ key }) => key === active).label}</h2>
                  <CButton
                    color="secondary"
                    variant="outline"
                    disabled={current.loading || saving}
                    onClick={() => refresh([active])}
                  >
                    Actualizar
                  </CButton>
                </div>
                {current.error && (
                  <CAlert color="danger" role="alert">
                    {current.error}
                  </CAlert>
                )}
                {current.error && current.rows.length > 0 && (
                  <p className="small text-body-secondary">
                    Se muestran los últimos datos cargados. Usa Actualizar para volver a consultar.
                  </p>
                )}
                {active === 'stock' && (
                  <p className="small text-body-secondary">
                    Stock bajo: stock actual menor o igual al mínimo. Los ajustes de cantidad se
                    aplican solo a productos con control por cantidad.
                  </p>
                )}
                {active === 'units' && (
                  <p className="small text-body-secondary">
                    Consulta de unidades individuales y su sucursal actual. Las entradas por compra
                    se registran desde Compras.
                  </p>
                )}
                <CRow className="g-3 mb-4">
                  <CCol md={6} xl={active === 'movements' ? 3 : 5}>
                    <CFormLabel htmlFor="inventory-search">
                      {active === 'units'
                        ? 'Buscar IMEI, serie, producto o SKU'
                        : 'Buscar producto o SKU'}
                    </CFormLabel>
                    <CFormInput
                      id="inventory-search"
                      type="search"
                      value={selection.query}
                      onChange={(event) => updateFilter('query', event.target.value)}
                      placeholder={
                        active === 'units' ? 'IMEI, serie, producto o SKU' : 'Nombre o SKU'
                      }
                    />
                  </CCol>
                  <CCol md={6} xl={3}>
                    <CFormLabel htmlFor="inventory-branch">Sucursal</CFormLabel>
                    <CFormSelect
                      id="inventory-branch"
                      value={selection.branch}
                      onChange={(event) => updateFilter('branch', event.target.value)}
                    >
                      <option value="">Todas las sucursales</option>
                      {selection.branch && !branches.some(([id]) => id === selection.branch) && (
                        <option value={selection.branch}>
                          Sucursal seleccionada (sin registros)
                        </option>
                      )}
                      {branches.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  {active === 'units' && (
                    <CCol md={6} xl={4}>
                      <CFormLabel htmlFor="inventory-state">Estado</CFormLabel>
                      <CFormSelect
                        id="inventory-state"
                        value={selection.state}
                        onChange={(event) => updateFilter('state', event.target.value)}
                      >
                        <option value="">Todos los estados</option>
                        {[...new Set([...states, selection.state].filter(Boolean))].map((state) => (
                          <option key={state} value={state}>
                            {inventoryLabel(state)}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>
                  )}
                  {active === 'movements' && (
                    <>
                      <CCol md={6} xl={3}>
                        <CFormLabel htmlFor="inventory-product">Producto</CFormLabel>
                        <CFormSelect
                          id="inventory-product"
                          value={selection.product}
                          onChange={(event) => updateFilter('product', event.target.value)}
                        >
                          <option value="">Todos los productos</option>
                          {selection.product &&
                            !products.some(([id]) => id === selection.product) && (
                              <option value={selection.product}>
                                Producto seleccionado (sin registros)
                              </option>
                            )}
                          {products.map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </CFormSelect>
                      </CCol>
                      <CCol md={6} xl={3}>
                        <CFormLabel htmlFor="inventory-type">Tipo</CFormLabel>
                        <CFormSelect
                          id="inventory-type"
                          value={selection.type}
                          onChange={(event) => updateFilter('type', event.target.value)}
                        >
                          <option value="">Todos los tipos</option>
                          {[...new Set([...types, selection.type].filter(Boolean))].map((type) => (
                            <option key={type} value={type}>
                              {inventoryLabel(type)}
                            </option>
                          ))}
                        </CFormSelect>
                      </CCol>
                    </>
                  )}
                </CRow>
                {current.loading ? (
                  <div className="text-center py-5" role="status">
                    <CSpinner color="primary" />
                    <div className="mt-2">
                      Cargando {sections.find(({ key }) => key === active).label.toLowerCase()}...
                    </div>
                  </div>
                ) : (
                  <>
                    <InventoryTable
                      columns={columns[active]}
                      rows={rows}
                      rowKey={(row) =>
                        active === 'stock'
                          ? `${row.id_sucursal}-${row.id_producto}`
                          : String(active === 'units' ? row.id_unidad : row.id_movimiento)
                      }
                      emptyMessage={emptyMessage}
                    />
                    <p className="small text-body-secondary mt-3 mb-0">
                      {rows.length} de {current.rows.length} registros.
                    </p>
                  </>
                )}
              </CTabPanel>
            </CTabContent>
          </CTabs>
        </CCardBody>
      </CCard>
      {operation && (
        <InventoryOperationModal
          kind={operation.kind}
          row={operation.row}
          saving={saving}
          error={operationError}
          onConfirm={saveOperation}
          onClose={() => {
            if (!saving) setOperation(null)
          }}
        />
      )}
      <CModal
        visible={!!movement}
        onClose={() => setMovement(null)}
        aria-labelledby="movement-detail-title"
      >
        <CModalHeader>
          <CModalTitle id="movement-detail-title">
            Movimiento #{movement?.id_movimiento}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {movement && (
            <dl className="mb-0">
              <dt>Fecha</dt>
              <dd>{formatInventoryDate(movement.fecha)}</dd>
              <dt>Producto / SKU</dt>
              <dd>
                {movement.producto} · {movement.sku}
              </dd>
              <dt>Sucursal</dt>
              <dd>{movement.sucursal}</dd>
              <dt>Tipo y cantidad</dt>
              <dd>
                {inventoryLabel(movement.tipo)} · {movement.cantidad}
              </dd>
              <dt>Stock anterior → nuevo</dt>
              <dd>
                {movement.stock_anterior} → {movement.stock_nuevo}
              </dd>
              <dt>Unidad</dt>
              <dd>{movement.id_unidad ?? '—'}</dd>
              <dt>Referencia / origen</dt>
              <dd>
                {movement.tipo_referencia || '—'}
                {movement.id_referencia != null ? ` #${movement.id_referencia}` : ''}
              </dd>
              <dt>Usuario</dt>
              <dd>
                {movement.usuario} (ID {movement.id_usuario})
              </dd>
              <dt>Observación</dt>
              <dd className="text-break">{movement.observacion || '—'}</dd>
            </dl>
          )}
        </CModalBody>
      </CModal>
    </>
  )
}

export default Inventory
