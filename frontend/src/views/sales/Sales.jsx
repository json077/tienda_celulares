import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { apiErrorMessage } from '../../services/api'
import { saleService } from '../../services/saleService'
import { customerService } from '../../services/customerService'
import { productService } from '../../services/productService'
import { inventoryService } from '../../services/inventoryService'
import SaleForm from './SaleForm'
import SaleDetail from './SaleDetail'
import SaleSummary from './SaleSummary'
import SaleConfirmation from './SaleConfirmation'
import { listData, money, validateLines } from './saleModel'
import { loadSaleUnits } from './saleAvailability'
import './sales.css'

const Sales = () => {
  const { usuario, can } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : new URLSearchParams(window.location.hash.split('?')[1] || '').get('buscar') || '',
  )
  const [state, setState] = useState('')
  const [branch, setBranch] = useState('')
  const [type, setType] = useState('')
  const [mode, setMode] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [sale, setSale] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [payments, setPayments] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [confirmation, setConfirmation] = useState(null)
  const [cancelChecked, setCancelChecked] = useState(false)
  const [denied, setDenied] = useState({})
  const pending = useRef(false)
  const controller = useRef(null)
  const alive = () => controller.current && !controller.current.signal.aborted
  const loadUnits = useCallback(
    (branch, products, signal) => {
      if (products.length && !can('IMEI_VER')) {
        const error = new Error('No tienes permiso para consultar dispositivos disponibles.')
        error.status = 403
        return Promise.reject(error)
      }
      return loadSaleUnits(inventoryService, branch, products, signal)
    },
    [can],
  )
  const load = useCallback(async (signal) => {
    try {
      const data = listData(await saleService.list(signal))
      if (!signal.aborted) {
        setRows(data)
        setError('')
      }
    } catch (e) {
      if (!signal.aborted) setError(apiErrorMessage(e))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])
  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    queueMicrotask(() => {
      if (!current.signal.aborted) load(current.signal)
    })
    return () => current.abort()
  }, [load])
  const allowed = (action) => {
    const requirements = {
      list: ['VENTA_VER'],
      detail: ['VENTA_VER'],
      invoice: ['FACTURA_IMPRIMIR'],
      catalog: ['VENTA_CREAR', 'PRODUCTO_VER', 'CLIENTE_VER', 'INVENTARIO_VER'],
      create: ['VENTA_CREAR', 'INVENTARIO_VER'],
      availability: ['VENTA_CONFIRMAR', 'INVENTARIO_VER'],
      confirm: ['VENTA_CONFIRMAR'],
      cancel: ['VENTA_ANULAR'],
    }
    return requirements[action]?.every(can) === true
  }
  const run = async (action, operation) => {
    if (!allowed(action)) {
      setError('Acceso denegado. No tienes permiso para esta operación.')
      return
    }
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setModalError('')
    setSuccess('')
    try {
      await operation()
    } catch (e) {
      if (alive()) {
        if (e.status === 403) setDenied((old) => ({ ...old, [action]: true }))
        const message =
          apiErrorMessage(e) +
          (['create', 'confirm', 'cancel'].includes(action)
            ? ' Si la respuesta se interrumpió, actualiza y consulta la venta antes de repetir la operación.'
            : '')
        setError(message)
        setModalError(message)
      }
    } finally {
      pending.current = false
      if (alive()) setBusy(false)
    }
  }
  const refresh = async () => {
    setLoading(true)
    await load(controller.current.signal)
  }
  const related = async (record) => {
    setInvoice(null)
    setPayments(null)
    setWarnings([])
    const results = await Promise.allSettled([
      record.estado === 'CONFIRMADA'
        ? saleService.invoice(record.id_venta, controller.current.signal)
        : Promise.resolve(null),
      saleService.payments(record.id_venta, controller.current.signal),
    ])
    if (!alive()) return
    const [f, p] = results
    if (f.status === 'fulfilled') setInvoice(f.value?.data || null)
    if (p.status === 'fulfilled') setPayments(listData(p.value))
    setWarnings(
      results.flatMap((r, i) =>
        r.status === 'rejected'
          ? [`${i === 0 ? 'Factura e IMEI vendidos' : 'Pagos'}: ${apiErrorMessage(r.reason)}`]
          : [],
      ),
    )
    if (f.status === 'rejected' && f.reason.status === 403)
      setDenied((old) => ({ ...old, invoice: true }))
  }
  const openDetail = (id) =>
    run('detail', async () => {
      const response = await saleService.get(id, controller.current.signal)
      if (!alive()) return
      if (!Array.isArray(response.data?.detalles)) throw new Error('Detalle de venta inválido.')
      setSale(response.data)
      setMode('detail')
      await related(response.data)
    })
  const openNew = () =>
    run('catalog', async () => {
      const signal = controller.current.signal
      const result = await Promise.allSettled([
        productService.list(signal),
        customerService.list(signal),
        inventoryService.stock(signal),
      ])
      if (!alive()) return
      const failures = result
        .slice(0, 3)
        .flatMap((r, i) =>
          r.status === 'rejected'
            ? [`${['Productos', 'Clientes', 'Inventario'][i]}: ${apiErrorMessage(r.reason)}`]
            : [],
        )
      if (failures.length) throw new Error(failures.join(' '))
      setCatalog({
        products: listData(result[0].value),
        clients: listData(result[1].value),
        stock: listData(result[2].value),
      })
      setMode('new')
    })
  const create = (values) =>
    run('create', async () => {
      // Refresh availability immediately before writing; backend remains authoritative.
      const stock = listData(await inventoryService.stock(controller.current.signal))
      const serialProducts = values.detalles
        .filter((l) => l.tipo_control === 'SERIALIZADO')
        .map((l) => l.id_producto)
      const units = serialProducts.length
        ? await loadUnits(values.id_sucursal, serialProducts, controller.current.signal)
        : []
      validateLines(values, stock, units)
      if (!alive()) return
      const response = await saleService.create(values)
      if (!alive()) return
      setSale(response.data)
      setMode('detail')
      setSuccess('Borrador guardado. Revisa y confirma para descontar inventario.')
      setCatalog(null)
      await related(response.data)
      await refresh()
    })
  const prepareConfirm = () =>
    run('availability', async () => {
      const signal = controller.current.signal
      const record = (await saleService.get(sale.id_venta, signal)).data
      if (record.estado !== 'BORRADOR') {
        setSale(record)
        await refresh()
        throw new Error('La venta ya no está en BORRADOR.')
      }
      const results = await Promise.allSettled([
        inventoryService.stock(signal),
        record.detalles.some((l) => l.tipo_control === 'SERIALIZADO')
          ? loadUnits(
              record.id_sucursal,
              record.detalles
                .filter((l) => l.tipo_control === 'SERIALIZADO')
                .map((l) => l.id_producto),
              signal,
            )
          : Promise.resolve([]),
      ])
      const failure = results.find((r) => r.status === 'rejected')
      if (failure) throw failure.reason
      if (!alive()) return
      setSale(record)
      setConfirmation({ stock: listData(results[0].value), units: results[1].value })
      setMode('confirm')
    })
  const confirm = (units) =>
    run('confirm', async () => {
      const response = await saleService.confirm(sale.id_venta, units)
      if (!alive()) return
      setSale(response.data)
      setMode('detail')
      setSuccess('Venta confirmada y factura emitida. Los pagos se registran por separado.')
      await related(response.data)
      await refresh()
    })
  const cancel = () =>
    run('cancel', async () => {
      if (!cancelChecked) return
      const response = await saleService.cancel(sale.id_venta)
      if (!alive()) return
      setSale(response.data)
      setInvoice(null)
      setMode('detail')
      setSuccess('Venta y factura anuladas; inventario revertido.')
      await related(response.data)
      await refresh()
    })
  const print = () =>
    run('invoice', async () => {
      const response = await saleService.invoice(sale.id_venta, controller.current.signal)
      if (alive()) {
        setInvoice(response.data)
        setMode('invoice')
      }
    })
  const filtered = rows.filter(
    (r) =>
      (!state || r.estado === state) &&
      (!branch || String(r.id_sucursal) === branch) &&
      (!type || r.tipo_venta === type) &&
      [r.id_venta, r.numero_venta, r.cliente, r.identificacion_cliente, r.sucursal, r.usuario]
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  )
  const hasPayments = payments?.some((p) => p.estado === 'APLICADO' && Number(p.monto_base) > 0)
  return (
    <CCard>
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <h2>Ventas</h2>
          <div>
            <CButton
              color="secondary"
              className="me-2"
              disabled={busy || loading}
              onClick={() => run('list', refresh)}
            >
              Actualizar
            </CButton>
            <CButton
              color="primary"
              disabled={busy || denied.create || !allowed('catalog')}
              onClick={openNew}
            >
              Nueva venta
            </CButton>
          </div>
        </div>
        <p className="text-body-secondary">
          Vendedor de nuevos borradores: {usuario?.username || 'usuario autenticado'} · Moneda base
          NIO
        </p>
        {error && <CAlert color="danger">{error}</CAlert>}
        {success && <CAlert color="success">{success}</CAlert>}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <CFormInput
            aria-label="Buscar ventas"
            placeholder="Buscar ID, número, cliente, sucursal o vendedor"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CFormSelect
            aria-label="Filtrar estado"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {['BORRADOR', 'CONFIRMADA', 'ANULADA'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </CFormSelect>
          <CFormSelect
            aria-label="Filtrar sucursal"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {[...new Map(rows.map((r) => [r.id_sucursal, r])).values()].map((r) => (
              <option key={r.id_sucursal} value={r.id_sucursal}>
                {r.sucursal}
              </option>
            ))}
          </CFormSelect>
          <CFormSelect
            aria-label="Filtrar condición"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todas las condiciones</option>
            <option>CONTADO</option>
            <option>CREDITO</option>
          </CFormSelect>
        </div>
        {loading ? (
          <p role="status">Cargando ventas…</p>
        ) : (
          <>
            <p>{filtered.length} venta(s)</p>
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  {[
                    'ID / Número',
                    'Fecha',
                    'Cliente',
                    'Sucursal',
                    'Total NIO',
                    'Estado / condición',
                    'Vendedor',
                    'Acciones',
                  ].map((h) => (
                    <CTableHeaderCell key={h}>{h}</CTableHeaderCell>
                  ))}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filtered.map((r) => (
                  <CTableRow key={r.id_venta}>
                    <CTableDataCell>
                      {r.id_venta} / {r.numero_venta}
                    </CTableDataCell>
                    <CTableDataCell>{r.fecha}</CTableDataCell>
                    <CTableDataCell>{r.cliente}</CTableDataCell>
                    <CTableDataCell>{r.sucursal}</CTableDataCell>
                    <CTableDataCell>C$ {money(r.total)}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge
                        color={
                          { BORRADOR: 'secondary', CONFIRMADA: 'success', ANULADA: 'danger' }[
                            r.estado
                          ] || 'secondary'
                        }
                      >
                        {r.estado}
                      </CBadge>{' '}
                      {r.tipo_venta}
                    </CTableDataCell>
                    <CTableDataCell>{r.usuario}</CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        color="primary"
                        size="sm"
                        disabled={busy}
                        onClick={() => openDetail(r.id_venta)}
                      >
                        Ver detalle / acciones
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
            {!filtered.length && <p>No hay ventas que coincidan.</p>}
          </>
        )}
        <CModal
          visible={!!mode}
          size="xl"
          backdrop="static"
          keyboard={!busy}
          onClose={() => {
            if (!busy) setMode('')
          }}
        >
          <CModalHeader closeButton={!busy}>
            <CModalTitle>
              {
                {
                  new: 'Nueva venta',
                  detail: 'Detalle de venta',
                  confirm: 'Revisar y confirmar venta',
                  cancel: 'Anular venta',
                  invoice: 'Factura',
                }[mode]
              }
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {modalError && mode !== 'new' && <CAlert color="danger">{modalError}</CAlert>}
            {mode === 'new' && catalog && (
              <SaleForm
                catalog={catalog}
                canReadUnits={can('IMEI_VER')}
                loadUnits={loadUnits}
                error={modalError}
                saving={busy}
                onSave={create}
                onCancel={() => setMode('')}
              />
            )}
            {mode === 'detail' && sale && (
              <>
                <SaleDetail sale={sale} invoice={invoice} payments={payments} warnings={warnings} />
                {sale.estado === 'BORRADOR' && (
                  <CButton
                    className="me-2"
                    color="primary"
                    disabled={busy || denied.confirm || !allowed('availability')}
                    onClick={prepareConfirm}
                  >
                    Revisar y confirmar
                  </CButton>
                )}
                {sale.estado === 'CONFIRMADA' && (
                  <>
                    <CButton
                      className="me-2"
                      color="primary"
                      disabled={busy || denied.invoice || !allowed('invoice')}
                      onClick={print}
                    >
                      Ver / imprimir factura
                    </CButton>
                    {!hasPayments && (
                      <CButton
                        color="danger"
                        disabled={busy || denied.cancel || !allowed('cancel')}
                        onClick={() => {
                          setCancelChecked(false)
                          if (allowed('cancel')) setMode('cancel')
                        }}
                      >
                        Anular venta
                      </CButton>
                    )}
                    {hasPayments && (
                      <CAlert className="mt-3" color="warning">
                        La venta tiene pagos aplicados. El backend exige anularlos antes de anular
                        la venta.
                      </CAlert>
                    )}
                  </>
                )}
              </>
            )}
            {mode === 'confirm' && confirmation && (
              <SaleConfirmation
                sale={sale}
                {...confirmation}
                saving={busy}
                onConfirm={confirm}
                onCancel={() => setMode('detail')}
              />
            )}
            {mode === 'cancel' && (
              <>
                <SaleSummary sale={sale} />
                <CAlert color="warning">
                  Esta operación anulará la venta y su factura, repondrá el stock y devolverá las
                  unidades VENDIDO a DISPONIBLE. El backend impide anular ventas con pagos
                  aplicados.{' '}
                  {payments === null &&
                    'No fue posible consultar pagos; el servidor verificará esta restricción.'}{' '}
                  Los créditos se gestionan aparte; la anulación de venta no cancela su plan de
                  crédito.
                </CAlert>
                <label className="d-block">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={cancelChecked}
                    onChange={(e) => setCancelChecked(e.target.checked)}
                  />{' '}
                  He revisado la venta y autorizo su anulación y la reversión de inventario
                </label>
                <CButton
                  className="mt-3 me-2"
                  color="secondary"
                  disabled={busy}
                  onClick={() => setMode('detail')}
                >
                  Volver
                </CButton>
                <CButton
                  className="mt-3"
                  color="danger"
                  disabled={busy || !cancelChecked}
                  onClick={cancel}
                >
                  Confirmar anulación
                </CButton>
              </>
            )}
            {mode === 'invoice' && invoice && (
              <>
                <div id="sale-invoice">
                  <h2>Tienda Celulares</h2>
                  <p>
                    Factura {invoice.numero_factura} · Serie {invoice.serie} · Estado{' '}
                    {invoice.estado}
                  </p>
                  <SaleSummary sale={invoice} />
                  {payments && (
                    <div>
                      <h5>Pagos registrados al consultar</h5>
                      {payments.map((p) => (
                        <p key={p.id_pago}>
                          #{p.id_pago}: {p.metodo} · {money(p.monto)} {p.moneda} · Cambio{' '}
                          {p.tipo_cambio} · Base NIO {money(p.monto_base)} · {p.estado}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <CButton color="secondary" className="me-2" onClick={() => setMode('detail')}>
                  Volver
                </CButton>
                <CButton color="primary" onClick={() => window.print()}>
                  Imprimir factura
                </CButton>
              </>
            )}
          </CModalBody>
        </CModal>
      </CCardBody>
    </CCard>
  )
}
export default Sales
