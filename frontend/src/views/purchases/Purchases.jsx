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
import { apiErrorMessage } from '../../services/api'
import { purchaseService } from '../../services/purchaseService'
import { productService } from '../../services/productService'
import { supplierService } from '../../services/supplierService'
import { inventoryService } from '../../services/inventoryService'
import PurchaseForm from './PurchaseForm'
import { useAuth } from '../../contexts/AuthContext'
import PurchaseSummary from './PurchaseSummary'
import PurchaseConfirmation from './PurchaseConfirmation'
import {
  assertPurchase,
  filterPurchases,
  formatAmount,
  formatPurchaseDate,
  knownBranches,
  purchaseStateColor,
  purchaseStateLabel,
  purchaseStates,
  serializedDetails,
  validateUnits,
} from './purchaseModel'

const listData = (response) => {
  if (!Array.isArray(response.data)) throw new Error('El servidor devolvió un listado inválido.')
  return response.data
}

const Purchases = () => {
  const { can } = useAuth()
  const canCreate = ['COMPRAS_CREAR', 'PRODUCTO_VER', 'PROVEEDORES_VER'].every(can)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [branch, setBranch] = useState('')
  const [operation, setOperation] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [purchase, setPurchase] = useState(null)
  const [mode, setMode] = useState('detail')
  const [modalError, setModalError] = useState('')
  const [cancelText, setCancelText] = useState('')
  const [unitData, setUnitData] = useState({ rows: [], error: '', loading: false })
  const pending = useRef(false)
  const controller = useRef(null)

  const load = useCallback(
    (signal) =>
      purchaseService
        .list(signal)
        .then(listData)
        .then((records) => {
          if (!signal.aborted) {
            setRows(records)
            setError('')
          }
        })
        .catch((error) => {
          if (!signal.aborted) setError(apiErrorMessage(error))
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false)
        }),
    [],
  )

  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    load(current.signal)
    return () => current.abort()
  }, [load])

  const refresh = async () => {
    setLoading(true)
    await load(controller.current.signal)
  }

  const start = (name) => {
    const permission = {
      catalog: 'COMPRAS_CREAR',
      create: 'COMPRAS_CREAR',
      detail: 'COMPRAS_VER',
      confirm: 'COMPRAS_CONFIRMAR',
      cancel: 'COMPRAS_ANULAR',
    }[name]
    if (!permission || !can(permission)) {
      setError('Acceso denegado. No tienes permiso para esta operación.')
      return false
    }
    if (pending.current) return false
    pending.current = true
    setOperation(name)
    setModalError('')
    setSuccess('')
    return true
  }
  const finish = () => {
    pending.current = false
    if (!controller.current.signal.aborted) setOperation('')
  }

  const openNew = async () => {
    if (!canCreate || !start('catalog')) return
    setError('')
    const signal = controller.current.signal
    try {
      const results = await Promise.allSettled([
        productService.list(signal).then(listData),
        supplierService.list(signal).then(listData),
        inventoryService.stock(signal).then(listData),
      ])
      if (signal.aborted) return
      const [products, suppliers, stock] = results
      const failures = results
        .slice(0, 2)
        .flatMap((result, index) =>
          result.status === 'rejected'
            ? [`${index === 0 ? 'Productos' : 'Proveedores'}: ${apiErrorMessage(result.reason)}`]
            : [],
        )
      if (failures.length) {
        setError(failures.join(' '))
        return
      }
      setCatalog({
        products: products.value,
        suppliers: suppliers.value,
        branches: knownBranches(rows, stock.status === 'fulfilled' ? stock.value : []),
        warning:
          stock.status === 'rejected'
            ? `No se pudieron consultar las sucursales del inventario. Puedes usar las conocidas por compras o indicar un ID existente. ${apiErrorMessage(stock.reason)}`
            : '',
      })
    } finally {
      finish()
    }
  }

  const loadUnits = async (record) => {
    const signal = controller.current.signal
    setUnitData({ rows: [], error: '', loading: true })
    try {
      const all = listData(await inventoryService.units(signal))
      const ids = new Set(record.detalles.map((line) => String(line.id_detalle_compra)))
      if (!signal.aborted)
        setUnitData({
          rows: all.filter((unit) => ids.has(String(unit.id_detalle_compra))),
          error: '',
          loading: false,
        })
    } catch (error) {
      if (!signal.aborted) setUnitData({ rows: [], error: apiErrorMessage(error), loading: false })
    }
  }

  const openDetail = async (id) => {
    if (!start('detail')) return
    setError('')
    try {
      const { data } = await purchaseService.get(id, controller.current.signal)
      const record = assertPurchase(data, id)
      if (controller.current.signal.aborted) return
      setPurchase(record)
      setMode('detail')
      setCancelText('')
      setUnitData({ rows: [], error: '', loading: false })
      if (record.estado === 'CONFIRMADA' && serializedDetails(record).length)
        await loadUnits(record)
    } catch (error) {
      if (!controller.current.signal.aborted) setError(apiErrorMessage(error))
    } finally {
      finish()
    }
  }

  const saveDraft = async (values) => {
    if (!start('create')) return
    try {
      const response = await purchaseService.create(values)
      if (controller.current.signal.aborted) return
      const created = assertPurchase(response.data)
      setCatalog(null)
      setPurchase(created)
      setMode('detail')
      setUnitData({ rows: [], error: '', loading: false })
      setSuccess(response.message)
      await refresh()
    } catch (error) {
      if (!controller.current.signal.aborted)
        setModalError(
          `${apiErrorMessage(error)} Si se interrumpió la respuesta, comprueba el listado antes de volver a guardar.`,
        )
    } finally {
      finish()
    }
  }

  const changeState = async (kind, units = []) => {
    if (kind === 'cancel' && cancelText !== 'ANULAR') return
    if (!start(kind)) return
    try {
      const current = assertPurchase(
        (await purchaseService.get(purchase.id_compra, controller.current.signal)).data,
        purchase.id_compra,
      )
      if (controller.current.signal.aborted) return
      if (current.estado !== 'BORRADOR') {
        setPurchase(current)
        setMode('detail')
        await refresh()
        if (current.estado === 'CONFIRMADA' && serializedDetails(current).length)
          await loadUnits(current)
        throw new Error('La compra ya no es un borrador. Revisa su estado actualizado.')
      }
      if (kind === 'confirm') {
        const validation = validateUnits(current, units)
        if (validation) throw new Error(validation)
      }
      const response =
        kind === 'confirm'
          ? await purchaseService.confirm(current.id_compra, units)
          : await purchaseService.cancel(current.id_compra)
      if (controller.current.signal.aborted) return
      const updated = assertPurchase(response.data, current.id_compra)
      setPurchase(updated)
      setMode('detail')
      setSuccess(response.message)
      await refresh()
      if (kind === 'confirm' && serializedDetails(updated).length) await loadUnits(updated)
    } catch (error) {
      if (!controller.current.signal.aborted)
        setModalError(
          `${apiErrorMessage(error)} Si se interrumpió la respuesta, cierra y vuelve a consultar el detalle antes de reintentar.`,
        )
    } finally {
      finish()
    }
  }

  const closeModal = () => {
    if (pending.current) return
    setCatalog(null)
    setPurchase(null)
    setModalError('')
  }
  const busy = loading || !!operation
  const filtered = filterPurchases(rows, query, state, branch)
  const branches = knownBranches(rows)

  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <h1 className="h4 mb-1">Compras</h1>
              <p className="text-body-secondary mb-0">
                Registro de compras y recepción de productos por sucursal.
              </p>
            </div>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" disabled={busy} onClick={refresh}>
                Actualizar
              </CButton>
              <CButton color="primary" disabled={busy || !canCreate} onClick={openNew}>
                Nueva compra
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
          {(operation === 'catalog' || operation === 'detail') && (
            <p role="status">
              <CSpinner size="sm" className="me-2" />
              Cargando datos...
            </p>
          )}
          <CRow className="g-3 mb-3">
            <CCol md={6}>
              <CFormLabel htmlFor="purchase-search">
                Buscar por ID, documento, proveedor, sucursal o usuario
              </CFormLabel>
              <CFormInput
                id="purchase-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Escribe para buscar"
              />
            </CCol>
            <CCol md={3}>
              <CFormLabel htmlFor="purchase-state">Estado</CFormLabel>
              <CFormSelect
                id="purchase-state"
                value={state}
                onChange={(event) => setState(event.target.value)}
              >
                <option value="">Todos</option>
                {purchaseStates.map((value) => (
                  <option key={value} value={value}>
                    {purchaseStateLabel(value)}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormLabel htmlFor="purchase-filter-branch">Sucursal</CFormLabel>
              <CFormSelect
                id="purchase-filter-branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              >
                <option value="">Todas</option>
                {branches.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
          </CRow>
          {loading ? (
            <div className="text-center py-5" role="status">
              <CSpinner color="primary" />
              <p className="mt-2">Cargando compras...</p>
            </div>
          ) : (
            <>
              {error && rows.length > 0 && (
                <p className="small text-body-secondary">
                  Se muestra el último listado cargado. Usa Actualizar para volver a consultar.
                </p>
              )}
              <CTable responsive hover align="middle">
                <CTableHead>
                  <CTableRow>
                    {[
                      'ID / Documento',
                      'Fecha',
                      'Proveedor',
                      'Sucursal',
                      'Total',
                      'Estado',
                      'Usuario',
                      'Acciones',
                    ].map((label) => (
                      <CTableHeaderCell key={label} scope="col">
                        {label}
                      </CTableHeaderCell>
                    ))}
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {filtered.map((row) => (
                    <CTableRow key={row.id_compra}>
                      <CTableDataCell>
                        #{row.id_compra}
                        <div>{row.numero_documento}</div>
                      </CTableDataCell>
                      <CTableDataCell>{formatPurchaseDate(row.fecha)}</CTableDataCell>
                      <CTableDataCell>{row.proveedor}</CTableDataCell>
                      <CTableDataCell>{row.sucursal}</CTableDataCell>
                      <CTableDataCell>{formatAmount(row.total)}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={purchaseStateColor(row.estado)}>
                          {purchaseStateLabel(row.estado)}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{row.usuario}</CTableDataCell>
                      <CTableDataCell>
                        <CButton
                          color="primary"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => openDetail(row.id_compra)}
                          aria-label={`Ver detalle de compra ${row.id_compra}`}
                        >
                          Ver detalle
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  {!filtered.length && (
                    <CTableRow>
                      <CTableDataCell colSpan={8} className="text-center py-4">
                        {error
                          ? 'No hay compras disponibles para mostrar.'
                          : rows.length
                            ? 'No hay coincidencias para los filtros.'
                            : 'No hay compras registradas.'}
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
              <p className="small text-body-secondary mb-0">
                {filtered.length} de {rows.length} compras.
              </p>
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal
        visible={!!catalog || !!purchase}
        size="xl"
        backdrop="static"
        keyboard={!operation}
        onClose={closeModal}
        aria-labelledby="purchase-modal-title"
      >
        <CModalHeader closeButton={!operation}>
          <CModalTitle id="purchase-modal-title">
            {catalog
              ? 'Nueva compra'
              : `${mode === 'confirm' ? 'Confirmar recepción' : mode === 'cancel' ? 'Anular borrador' : 'Detalle de compra'} #${purchase?.id_compra ?? ''}`}
          </CModalTitle>
        </CModalHeader>
        {catalog ? (
          <PurchaseForm
            {...catalog}
            saving={operation === 'create'}
            error={modalError}
            onSave={saveDraft}
            onCancel={closeModal}
          />
        ) : purchase && mode === 'confirm' ? (
          <PurchaseConfirmation
            key={purchase.id_compra}
            purchase={purchase}
            saving={operation === 'confirm'}
            error={modalError}
            onConfirm={(units) => changeState('confirm', units)}
            onCancel={() => {
              setMode('detail')
              setModalError('')
            }}
          />
        ) : (
          purchase && (
            <>
              <CModalBody>
                {success && (
                  <CAlert color="success" role="status">
                    {success}
                  </CAlert>
                )}
                {modalError && (
                  <CAlert color="danger" role="alert">
                    {modalError}
                  </CAlert>
                )}
                <PurchaseSummary purchase={purchase} />
                {mode === 'cancel' ? (
                  <>
                    <CAlert color="warning">
                      Se anulará este borrador y no podrá confirmarse. Se conservarán la compra y
                      sus detalles. No se modificará inventario, porque el borrador no generó
                      entradas.
                    </CAlert>
                    <CFormLabel htmlFor="purchase-cancel-text">
                      Escribe ANULAR para continuar
                    </CFormLabel>
                    <CFormInput
                      id="purchase-cancel-text"
                      value={cancelText}
                      disabled={!!operation}
                      autoComplete="off"
                      onChange={(event) => setCancelText(event.target.value)}
                    />
                  </>
                ) : purchase.estado === 'BORRADOR' ? (
                  <CAlert color="info">
                    Este borrador no ha modificado existencias. Confirma la recepción cuando hayas
                    revisado todos los productos y los IMEI requeridos.
                  </CAlert>
                ) : (
                  purchase.estado === 'CONFIRMADA' &&
                  serializedDetails(purchase).length > 0 && (
                    <>
                      <h2 className="h5">Dispositivos de esta compra</h2>
                      {unitData.loading && (
                        <p role="status">
                          <CSpinner size="sm" className="me-2" />
                          Consultando unidades...
                        </p>
                      )}
                      {unitData.error ? (
                        <CAlert color="warning" role="alert">
                          El detalle de compra está disponible, pero no se pudieron consultar los
                          dispositivos. {unitData.error}
                        </CAlert>
                      ) : (
                        !unitData.loading && (
                          <CTable responsive bordered>
                            <CTableHead>
                              <CTableRow>
                                {['Producto', 'Detalle', 'IMEI 1', 'IMEI 2', 'Serie', 'Estado'].map(
                                  (label) => (
                                    <CTableHeaderCell key={label} scope="col">
                                      {label}
                                    </CTableHeaderCell>
                                  ),
                                )}
                              </CTableRow>
                            </CTableHead>
                            <CTableBody>
                              {unitData.rows.map((unit) => (
                                <CTableRow key={unit.id_unidad}>
                                  <CTableDataCell>{unit.producto}</CTableDataCell>
                                  <CTableDataCell>#{unit.id_detalle_compra}</CTableDataCell>
                                  <CTableDataCell>{unit.imei1}</CTableDataCell>
                                  <CTableDataCell>{unit.imei2 || '—'}</CTableDataCell>
                                  <CTableDataCell>{unit.numero_serie || '—'}</CTableDataCell>
                                  <CTableDataCell>{unit.estado}</CTableDataCell>
                                </CTableRow>
                              ))}
                              {!unitData.rows.length && (
                                <CTableRow>
                                  <CTableDataCell colSpan={6}>
                                    No se encontraron dispositivos vinculados a los detalles de esta
                                    compra.
                                  </CTableDataCell>
                                </CTableRow>
                              )}
                            </CTableBody>
                          </CTable>
                        )
                      )}
                    </>
                  )
                )}
              </CModalBody>
              <CModalFooter>
                <CButton
                  color="secondary"
                  variant="outline"
                  disabled={!!operation}
                  onClick={
                    mode === 'cancel'
                      ? () => {
                          setMode('detail')
                          setModalError('')
                        }
                      : closeModal
                  }
                >
                  {mode === 'cancel' ? 'Volver al detalle' : 'Cerrar'}
                </CButton>
                {purchase.estado === 'BORRADOR' &&
                  (mode === 'cancel' ? (
                    <CButton
                      color="danger"
                      disabled={!!operation || !can('COMPRAS_ANULAR') || cancelText !== 'ANULAR'}
                      onClick={() => changeState('cancel')}
                    >
                      {operation === 'cancel' && <CSpinner size="sm" className="me-2" />}Anular
                      borrador definitivamente
                    </CButton>
                  ) : (
                    <>
                      <CButton
                        color="danger"
                        variant="outline"
                        disabled={!!operation || !can('COMPRAS_ANULAR')}
                        onClick={() => {
                          if (!can('COMPRAS_ANULAR')) return
                          setMode('cancel')
                          setCancelText('')
                          setModalError('')
                        }}
                      >
                        Anular borrador
                      </CButton>
                      <CButton
                        color="primary"
                        disabled={!!operation || !can('COMPRAS_CONFIRMAR')}
                        onClick={() => {
                          if (!can('COMPRAS_CONFIRMAR')) return
                          setMode('confirm')
                          setModalError('')
                        }}
                      >
                        Preparar recepción
                      </CButton>
                    </>
                  ))}
              </CModalFooter>
            </>
          )
        )}
      </CModal>
    </>
  )
}

export default Purchases
