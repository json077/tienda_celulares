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
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { apiErrorMessage } from '../../services/api'
import { warrantyService } from '../../services/warrantyService'
import { saleService } from '../../services/saleService'
import { listData } from '../sales/saleModel'
import { creditDate } from '../credits/creditModel'
import WarrantyDetail, { ClaimDetail, WarrantyNotice } from './WarrantyDetail'
import { ClaimForm, ResolutionForm, WarrantyForm } from './WarrantyForms'
import {
  acquireWarrantyOperation,
  assertClaim,
  assertWarranty,
  claimRows,
  claimTransitions,
  createWarranty,
  filterWarranties,
  hasOpenClaim,
  knownWarrantyBranches,
  loadWarrantySale,
  receiveClaim,
  resolveClaim,
  warrantyLine,
  warrantyRows,
  warrantySale,
  warrantyStates,
} from './warrantyModel'

const Warranties = () => {
  const { can } = useAuth()
  const [rows, setRows] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [catalogWarning, setCatalogWarning] = useState('')
  const [detailWarning, setDetailWarning] = useState('')
  const [denied, setDenied] = useState({})
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [warranty, setWarranty] = useState(null)
  const [claims, setClaims] = useState(null)
  const [claim, setClaim] = useState(null)
  const [context, setContext] = useState(null)
  const [saleId, setSaleId] = useState('')
  const [mode, setMode] = useState('')
  const pending = useRef(false)
  const controller = useRef(null)
  const alive = () => controller.current && !controller.current.signal.aborted
  const blocked = (permission) => !can(permission) || !!denied[permission]
  const noteError = useCallback((e, permission) => {
    setError(apiErrorMessage(e))
    if (e.status === 403) setDenied((d) => ({ ...d, [e.permission || permission]: true }))
  }, [])
  const load = useCallback(
    async (signal) => {
      const results = await Promise.allSettled([
        warrantyService.list(signal).then(warrantyRows),
        saleService.list(signal).then(listData),
      ])
      if (signal.aborted) return
      if (results[0].status === 'fulfilled') setRows(results[0].value)
      else {
        setRows([])
        noteError(results[0].reason, 'GARANTIAS_VER')
      }
      if (results[1].status === 'fulfilled') {
        setSales(results[1].value)
        setCatalogWarning('')
      } else {
        setSales([])
        setCatalogWarning(
          'No se pudieron consultar nombres de ventas, clientes y productos. Se muestran referencias de las garantías. ' +
            apiErrorMessage(results[1].reason),
        )
        if (results[1].reason.status === 403) setDenied((d) => ({ ...d, VENTA_VER: true }))
      }
      setLoading(false)
    },
    [noteError],
  )
  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    queueMicrotask(() => {
      if (!current.signal.aborted) load(current.signal)
    })
    return () => current.abort()
  }, [load])
  const run = async (permission, operation, writing = false) => {
    if (blocked(permission)) {
      setError('Acceso denegado. No tienes permiso para esta operación.')
      return
    }
    if (!acquireWarrantyOperation(pending)) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await operation()
    } catch (e) {
      if (alive()) {
        noteError(e, permission)
        if (writing)
          setError(
            apiErrorMessage(e) +
              ' Si se perdió la respuesta, consulta el resultado antes de repetir. No hay reintentos automáticos.',
          )
      }
    } finally {
      pending.current = false
      if (alive()) setBusy(false)
    }
  }
  const getWarranty = async (id) => {
    try {
      return assertWarranty((await warrantyService.get(id, controller.current.signal)).data, id)
    } catch (e) {
      e.permission = 'GARANTIAS_VER'
      throw e
    }
  }
  const loadDetail = async (id) => {
    setWarranty(null)
    setClaims(null)
    setContext(null)
    setDetailWarning('')
    const current = await getWarranty(id)
    if (!alive()) return
    setWarranty(current)
    const results = await Promise.allSettled([
      warrantyService.claims(id, controller.current.signal).then((r) => claimRows(r, id)),
      loadWarrantySale({
        id: current.id_venta,
        sales: saleService,
        signal: controller.current.signal,
      }),
    ])
    if (!alive()) return
    const messages = []
    if (results[0].status === 'fulfilled') setClaims(results[0].value)
    else {
      messages.push('Reclamos: ' + apiErrorMessage(results[0].reason))
      if (results[0].reason.status === 403) setDenied((d) => ({ ...d, GARANTIAS_VER: true }))
    }
    if (results[1].status === 'fulfilled') setContext(results[1].value)
    else messages.push('Datos históricos: ' + apiErrorMessage(results[1].reason))
    setDetailWarning(messages.join(' '))
  }
  const openDetail = (row) =>
    run('GARANTIAS_VER', async () => {
      setClaim(null)
      await loadDetail(row.id_garantia)
      if (alive()) setMode('detail')
    })
  const openNew = () =>
    run('GARANTIAS_CREAR', async () => {
      if (blocked('VENTA_VER')) return
      const data = listData(await saleService.list(controller.current.signal))
      if (alive()) {
        setSales(data)
        setContext(null)
        setSaleId('')
        setMode('new')
      }
    })
  const chooseSale = (id) =>
    run('VENTA_VER', async () => {
      setSaleId(id)
      setContext(null)
      if (!id) return
      const current = await loadWarrantySale({
        id,
        sales: saleService,
        signal: controller.current.signal,
      })
      if (alive()) setContext(current)
    })
  const refresh = () =>
    run('GARANTIAS_VER', async () => {
      setLoading(true)
      await load(controller.current.signal)
      if (warranty) await loadDetail(warranty.id_garantia)
    })
  const markCommitted = (response) => {
    if (!alive()) return
    setMode('')
    setWarranty(null)
    setClaims(null)
    setClaim(null)
    setContext(null)
    setSuccess(response.message || 'Operación confirmada por el servidor.')
  }
  const reloadCommitted = async (response, kind, expectedId) => {
    if (!alive() || !response) return
    let current
    try {
      current =
        kind === 'warranty'
          ? assertWarranty(response.data, expectedId)
          : assertClaim(response.data, expectedId)
      if (kind !== 'warranty') setClaim(current)
    } catch (e) {
      setError(
        e.message +
          ' La escritura ya fue confirmada. Actualiza y consulta antes de operar nuevamente.',
      )
    }
    setLoading(true)
    await load(controller.current.signal)
    if (!current || !alive()) return
    try {
      await loadDetail(current.id_garantia)
      if (alive()) setMode(kind === 'warranty' ? 'detail' : 'claim')
    } catch (e) {
      if (alive()) noteError(e, 'GARANTIAS_VER')
    }
  }
  const saveWarranty = (values) =>
    run(
      'GARANTIAS_CREAR',
      async () => {
        const response = await createWarranty({
          values,
          sales: saleService,
          service: warrantyService,
          signal: controller.current.signal,
          onCommitted: markCommitted,
        })
        await reloadCommitted(response, 'warranty')
      },
      true,
    )
  const startClaim = () =>
    run('GARANTIAS_RECLAMAR', async () => {
      await loadDetail(warranty.id_garantia)
      if (alive()) setMode('receive')
    })
  const saveClaim = (values) =>
    run(
      'GARANTIAS_RECLAMAR',
      async () => {
        const id = warranty.id_garantia
        const response = await receiveClaim({
          id,
          values,
          service: warrantyService,
          signal: controller.current.signal,
          onCommitted: markCommitted,
        })
        await reloadCommitted(response, 'claim')
      },
      true,
    )
  const openClaim = (row) =>
    run('GARANTIAS_VER', async () => {
      setClaim(null)
      const current = assertClaim(
        (await warrantyService.claim(row.id_reclamo, controller.current.signal)).data,
        row.id_reclamo,
      )
      if (Number(current.id_garantia) !== Number(warranty.id_garantia))
        throw new Error('El reclamo no corresponde a la garantía.')
      if (alive()) {
        setClaim(current)
        setMode('claim')
      }
    })
  const saveResolution = (values) =>
    run(
      'GARANTIAS_RESOLVER',
      async () => {
        const id = claim.id_reclamo
        try {
          const response = await resolveClaim({
            record: claim,
            values,
            service: warrantyService,
            signal: controller.current.signal,
            onCurrent: (r) => {
              if (alive()) setClaim(r)
            },
            onCommitted: markCommitted,
          })
          await reloadCommitted(response, 'claim', id)
        } catch (e) {
          if (alive()) {
            setClaim(null)
            setMode('detail')
            await loadDetail(warranty.id_garantia)
          }
          throw e
        }
      },
      true,
    )
  const canClaim =
    warranty?.estado === 'VIGENTE' &&
    claims !== null &&
    !hasOpenClaim(claims) &&
    !blocked('GARANTIAS_RECLAMAR') &&
    !blocked('GARANTIAS_VER')
  const branches = knownWarrantyBranches([...sales, ...(context ? [context.sale] : [])])
  const filtered = filterWarranties(rows, sales, query, state)
  return (
    <CCard>
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <h1 className="h4">Garantías y reclamos</h1>
          <div className="d-flex gap-2">
            <CButton color="secondary" disabled={busy || loading} onClick={refresh}>
              Actualizar
            </CButton>
            <CButton
              color="primary"
              disabled={
                busy ||
                blocked('GARANTIAS_CREAR') ||
                blocked('GARANTIAS_VER') ||
                blocked('VENTA_VER')
              }
              onClick={openNew}
            >
              Registrar garantía
            </CButton>
          </div>
        </div>
        <WarrantyNotice />
        {error && <CAlert color="danger">{error}</CAlert>}
        {success && <CAlert color="success">{success}</CAlert>}
        {catalogWarning && <CAlert color="warning">{catalogWarning}</CAlert>}
        {busy && <p role="status">Procesando solicitud…</p>}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <CFormInput
            id="warranty-search"
            label="Buscar garantía, venta, cliente, producto o ID de dispositivo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CFormSelect
            id="warranty-state"
            label="Estado de garantía"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Todos</option>
            {warrantyStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </CFormSelect>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => {
              setQuery('')
              setState('')
            }}
          >
            Limpiar filtros
          </CButton>
        </div>
        {loading ? (
          <p role="status">Cargando garantías…</p>
        ) : (
          <CTable responsive hover>
            <CTableHead>
              <CTableRow>
                {[
                  'Garantía',
                  'Venta / cliente',
                  'Producto / dispositivo',
                  'Cobertura',
                  'Estado',
                  'Acción',
                ].map((h) => (
                  <CTableHeaderCell key={h} scope="col">
                    {h}
                  </CTableHeaderCell>
                ))}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((r) => {
                const sale = warrantySale(r, sales),
                  line = warrantyLine(r, sale)
                return (
                  <CTableRow key={r.id_garantia}>
                    <CTableDataCell>#{r.id_garantia}</CTableDataCell>
                    <CTableDataCell>
                      {sale?.numero_venta || `Venta #${r.id_venta}`}
                      <div>{sale?.cliente}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {line?.producto || `Producto #${r.id_producto}`}
                      <div>
                        {r.id_unidad != null
                          ? `Dispositivo #${r.id_unidad}`
                          : 'Detalle por cantidad'}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {creditDate(r.fecha_inicio)} → {creditDate(r.fecha_fin)}
                      <div>{r.dias_garantia} días históricos</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={r.estado === 'VIGENTE' ? 'success' : 'secondary'}>
                        {r.estado}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        color="secondary"
                        size="sm"
                        disabled={busy || blocked('GARANTIAS_VER')}
                        onClick={() => openDetail(r)}
                      >
                        Consultar detalle
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
              {!filtered.length && (
                <CTableRow>
                  <CTableDataCell colSpan={6}>No hay garantías para mostrar.</CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        )}
        <p className="small text-body-secondary">
          Búsqueda y filtros sobre los datos consultados. Los IMEI históricos se consultan en el
          detalle mediante la factura; el listado de garantías solo incluye IDs de dispositivo.
        </p>
        <CModal
          visible={!!mode}
          size="xl"
          scrollable
          backdrop="static"
          keyboard={!busy}
          onClose={() => {
            if (!busy) setMode('')
          }}
        >
          <CModalHeader closeButton={!busy}>
            <CModalTitle>
              {mode === 'new'
                ? 'Registrar garantía'
                : mode === 'receive'
                  ? 'Registrar reclamo'
                  : mode === 'claim'
                    ? 'Detalle y procesamiento de reclamo'
                    : 'Detalle de garantía'}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {mode === 'new' && (
              <>
                <CFormSelect
                  id="warranty-sale"
                  className="mb-3"
                  label="Venta CONFIRMADA"
                  disabled={busy}
                  value={saleId}
                  onChange={(e) => chooseSale(e.target.value)}
                >
                  <option value="">Selecciona venta</option>
                  {sales
                    .filter((s) => s.estado === 'CONFIRMADA')
                    .map((s) => (
                      <option key={s.id_venta} value={s.id_venta}>
                        {s.numero_venta} · {s.cliente} · {s.sucursal}
                      </option>
                    ))}
                </CFormSelect>
                {!sales.some((s) => s.estado === 'CONFIRMADA') && (
                  <p>No hay ventas confirmadas en el catálogo consultado.</p>
                )}
                {context && (
                  <WarrantyForm
                    key={context.sale.id_venta}
                    context={context}
                    existing={rows}
                    busy={busy}
                    onSave={saveWarranty}
                  />
                )}
              </>
            )}
            {['detail', 'receive'].includes(mode) && warranty && (
              <>
                <WarrantyDetail
                  warranty={warranty}
                  context={context}
                  warning={detailWarning}
                  claims={claims}
                  busy={busy || blocked('GARANTIAS_VER')}
                  canClaim={mode === 'detail' && canClaim}
                  canResolve={!blocked('GARANTIAS_RESOLVER')}
                  onClaim={startClaim}
                  onSelectClaim={openClaim}
                />
                {mode === 'receive' && claims !== null && (
                  <ClaimForm
                    key={warranty.id_garantia}
                    warranty={warranty}
                    claims={claims}
                    branches={branches}
                    defaultBranch={context?.sale.id_sucursal || ''}
                    busy={busy}
                    onSave={saveClaim}
                  />
                )}
              </>
            )}
            {mode === 'claim' && claim && (
              <>
                <ClaimDetail claim={claim} />
                <WarrantyNotice />
                {!blocked('GARANTIAS_RESOLVER') &&
                  !blocked('GARANTIAS_VER') &&
                  claimTransitions[claim.estado]?.length > 0 && (
                    <ResolutionForm
                      key={`${claim.id_reclamo}-${claim.estado}`}
                      claim={claim}
                      busy={busy}
                      onSave={saveResolution}
                    />
                  )}
                <CButton
                  className="mt-3"
                  color="secondary"
                  disabled={busy}
                  onClick={() => setMode('detail')}
                >
                  Volver a la garantía
                </CButton>
              </>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" disabled={busy} onClick={() => setMode('')}>
              Cerrar
            </CButton>
          </CModalFooter>
        </CModal>
      </CCardBody>
    </CCard>
  )
}
export default Warranties
