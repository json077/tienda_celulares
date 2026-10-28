import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CFormInput,
  CFormSelect,
  CFormCheck,
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
  CBadge,
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { apiErrorMessage } from '../../services/api'
import { transferService } from '../../services/transferService'
import { inventoryService } from '../../services/inventoryService'
import { productService } from '../../services/productService'
import { listData } from '../sales/saleModel'
import { dateTime } from '../cash/cashModel'
import { inventoryRows } from '../inventory/inventoryView'
import TransferForm from './TransferForm'
import TransferDetail from './TransferDetail'
import {
  acquireTransferOperation,
  assertTransfer,
  filterTransfers,
  processTransfer,
  transferBranches,
  transferList,
  transferStates,
  validateTransfer,
} from './transferModel'

const Transfers = () => {
  const { usuario } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [denied, setDenied] = useState({})
  const [filters, setFilters] = useState({ query: '', state: '', origin: '', destination: '' })
  const [record, setRecord] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [mode, setMode] = useState('')
  const [checked, setChecked] = useState(false)
  const pending = useRef(false)
  const controller = useRef(null)
  const alive = () => controller.current && !controller.current.signal.aborted
  const blocked = (permission) => !usuario?.roles?.includes('ROOT') && !!denied[permission]
  const noteError = useCallback((e, permission) => {
    setError(apiErrorMessage(e))
    if (e.status === 403) setDenied((d) => ({ ...d, [e.permission || permission]: true }))
  }, [])
  const load = useCallback(
    async (signal) => {
      try {
        const data = transferList(await transferService.list(signal))
        if (!signal.aborted) setRows(data)
      } catch (e) {
        if (!signal.aborted) {
          setRows([])
          noteError(e, 'TRANSFERENCIAS_VER')
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
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
    if (!acquireTransferOperation(pending)) return
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
              ' Si se interrumpió la respuesta, consulta la transferencia antes de repetir; no hay reintentos automáticos.',
          )
      }
    } finally {
      pending.current = false
      if (alive()) setBusy(false)
    }
  }
  const get = async (id) => {
    try {
      return assertTransfer((await transferService.get(id, controller.current.signal)).data, id)
    } catch (e) {
      e.permission = 'TRANSFERENCIAS_VER'
      throw e
    }
  }
  const openDetail = (row) =>
    run('TRANSFERENCIAS_VER', async () => {
      setRecord(null)
      const current = await get(row.id_transferencia)
      if (alive()) {
        setRecord(current)
        setMode('detail')
        setChecked(false)
      }
    })
  const getCatalog = async () => {
    const signal = controller.current.signal
    const results = await Promise.allSettled([
      productService.list(signal).then(listData),
      inventoryService.stock(signal).then((r) => inventoryRows(r, 'stock')),
      inventoryService.units(signal).then((r) => inventoryRows(r, 'units')),
    ])
    for (let i = 0; i < 2; i += 1) {
      if (results[i].status === 'rejected') {
        const e = results[i].reason
        e.permission = ['PRODUCTOS_VER', 'INVENTARIO_VER'][i]
        throw e
      }
    }
    return {
      products: results[0].value,
      stock: results[1].value,
      units: results[2].status === 'fulfilled' ? results[2].value : null,
      warning:
        results[2].status === 'rejected'
          ? 'No se pudieron consultar los IMEI. Solo puedes transferir productos por cantidad. ' +
            apiErrorMessage(results[2].reason)
          : '',
      branches: transferBranches(results[1].value, rows),
    }
  }
  const openNew = () =>
    run('TRANSFERENCIAS_CREAR', async () => {
      setCatalog(null)
      const current = await getCatalog()
      if (alive()) {
        setCatalog(current)
        setMode('new')
      }
    })
  const committed = async (response, expectedId) => {
    if (!alive()) return
    setMode('')
    setChecked(false)
    setCatalog(null)
    setRecord(null)
    setSuccess(response.message || 'Operación confirmada por el servidor.')
    try {
      setRecord(assertTransfer(response.data, expectedId))
    } catch (e) {
      setError(
        e.message +
          ' La escritura fue confirmada. Actualiza y consulta antes de operar nuevamente.',
      )
    }
    setLoading(true)
    await load(controller.current.signal)
  }
  const create = (values) =>
    run(
      'TRANSFERENCIAS_CREAR',
      async () => {
        const current = await getCatalog()
        if (!alive()) return
        validateTransfer(values, current)
        const response = await transferService.create(values)
        await committed(response)
      },
      true,
    )
  const transition = () => {
    if (!checked || !['confirm', 'cancel'].includes(mode)) return
    const action = mode
    run(
      action === 'confirm' ? 'TRANSFERENCIAS_CONFIRMAR' : 'TRANSFERENCIAS_ANULAR',
      async () => {
        const currentId = record.id_transferencia
        setChecked(false)
        try {
          await processTransfer({
            action,
            record,
            service: { ...transferService, get: async (id) => ({ data: await get(id) }) },
            signal: controller.current.signal,
            onCurrent: (current) => {
              if (alive()) setRecord(current)
            },
            onCommitted: () => {
              if (alive()) {
                setMode('')
                setRecord(null)
              }
            },
          }).then(async (response) => {
            if (response) await committed(response, currentId)
          })
        } catch (e) {
          if (alive()) {
            setRecord(null)
            setMode('')
            await load(controller.current.signal)
          }
          throw e
        }
      },
      true,
    )
  }
  const refresh = () =>
    run('TRANSFERENCIAS_VER', async () => {
      setLoading(true)
      await load(controller.current.signal)
      if (record) {
        const id = record.id_transferencia
        setRecord(null)
        const current = await get(id)
        if (alive()) setRecord(current)
      }
    })
  const changeFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value })
  const branches = transferBranches([], rows)
  const filtered = filterTransfers(
    rows,
    filters.query,
    filters.state,
    filters.origin,
    filters.destination,
  )
  return (
    <CCard>
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <h1 className="h4">Transferencias entre sucursales</h1>
          <div className="d-flex gap-2">
            <CButton color="secondary" disabled={busy || loading} onClick={refresh}>
              Actualizar
            </CButton>
            <CButton
              color="primary"
              disabled={busy || blocked('TRANSFERENCIAS_CREAR')}
              onClick={openNew}
            >
              Nueva transferencia
            </CButton>
          </div>
        </div>
        <p>
          Crear guarda un borrador sin reservar inventario. Confirmar mueve las existencias y los
          dispositivos al destino en una sola operación. No existe recepción separada.
        </p>
        {error && <CAlert color="danger">{error}</CAlert>}
        {success && <CAlert color="success">{success}</CAlert>}
        {busy && <p role="status">Procesando solicitud…</p>}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <CFormInput
            label="Buscar número, sucursal o usuario"
            value={filters.query}
            onChange={changeFilter('query')}
          />
          <CFormSelect label="Estado" value={filters.state} onChange={changeFilter('state')}>
            <option value="">Todos</option>
            {transferStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </CFormSelect>
          {['origin', 'destination'].map((key) => (
            <CFormSelect
              key={key}
              label={key === 'origin' ? 'Origen' : 'Destino'}
              value={filters[key]}
              onChange={changeFilter(key)}
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </CFormSelect>
          ))}
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setFilters({ query: '', state: '', origin: '', destination: '' })}
          >
            Limpiar filtros
          </CButton>
        </div>
        {loading ? (
          <p role="status">Cargando transferencias…</p>
        ) : (
          <CTable responsive hover>
            <CTableHead>
              <CTableRow>
                {[
                  'Número',
                  'Origen',
                  'Destino',
                  'Solicitud',
                  'Estado',
                  'Responsable',
                  'Acciones',
                ].map((h) => (
                  <CTableHeaderCell scope="col" key={h}>
                    {h}
                  </CTableHeaderCell>
                ))}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((r) => (
                <CTableRow key={r.id_transferencia}>
                  <CTableDataCell>{r.numero_transferencia}</CTableDataCell>
                  <CTableDataCell>{r.sucursal_origen}</CTableDataCell>
                  <CTableDataCell>{r.sucursal_destino}</CTableDataCell>
                  <CTableDataCell>{dateTime(r.fecha_solicitud)}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge
                      color={
                        r.estado === 'BORRADOR'
                          ? 'warning'
                          : r.estado === 'CONFIRMADA'
                            ? 'success'
                            : 'secondary'
                      }
                    >
                      {r.estado}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{r.usuario_solicita}</CTableDataCell>
                  <CTableDataCell>
                    <CButton
                      size="sm"
                      color="secondary"
                      disabled={busy || blocked('TRANSFERENCIAS_VER')}
                      onClick={() => openDetail(r)}
                    >
                      Consultar detalle
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {!filtered.length && (
                <CTableRow>
                  <CTableDataCell colSpan={7}>No hay transferencias para mostrar.</CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        )}
        <p className="small text-body-secondary">
          Los filtros actúan sobre el listado recibido. Las cantidades y los dispositivos se
          consultan en el detalle.
        </p>
        {record && !mode && (
          <>
            <TransferDetail record={record} />
            <CButton
              color="secondary"
              disabled={busy}
              onClick={() => {
                setMode('detail')
                setChecked(false)
              }}
            >
              Ver acciones
            </CButton>
          </>
        )}
        <CModal
          visible={!!mode}
          size="xl"
          scrollable
          backdrop="static"
          keyboard={!busy}
          onClose={() => {
            if (!busy) {
              setMode('')
              setChecked(false)
            }
          }}
        >
          <CModalHeader closeButton={!busy}>
            <CModalTitle>
              {mode === 'new' ? 'Nueva transferencia' : 'Detalle de transferencia'}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {mode === 'new' && catalog && (
              <>
                {catalog.warning && <CAlert color="warning">{catalog.warning}</CAlert>}
                <p>Selecciona origen para consultar los artículos disponibles.</p>
                <TransferForm catalog={catalog} busy={busy} onSave={create} />
              </>
            )}
            {mode !== 'new' && record && (
              <>
                <TransferDetail record={record} />
                {mode === 'detail' && record.estado === 'BORRADOR' && (
                  <div className="d-flex flex-wrap gap-2">
                    <CButton
                      color="primary"
                      disabled={busy || blocked('TRANSFERENCIAS_CONFIRMAR')}
                      onClick={() => {
                        setMode('confirm')
                        setChecked(false)
                        setError('')
                      }}
                    >
                      Confirmar transferencia
                    </CButton>
                    <CButton
                      color="danger"
                      disabled={busy || blocked('TRANSFERENCIAS_ANULAR')}
                      onClick={() => {
                        setMode('cancel')
                        setChecked(false)
                        setError('')
                      }}
                    >
                      Anular borrador
                    </CButton>
                  </div>
                )}
                {['confirm', 'cancel'].includes(mode) && record.estado === 'BORRADOR' && (
                  <CAlert color="warning">
                    <p>
                      {mode === 'confirm'
                        ? 'Confirmar descontará origen, sumará destino y cambiará la ubicación de los IMEI. No puede deshacerse desde este módulo.'
                        : 'Anular descarta este borrador sin mover inventario. No puede reactivarse.'}
                    </p>
                    <CFormCheck
                      id="transfer-action-confirm"
                      label={`Revisé ${record.numero_transferencia}, sus sucursales y artículos; confirmo ${mode === 'confirm' ? 'la transferencia' : 'la anulación'}`}
                      checked={checked}
                      disabled={busy}
                      onChange={(e) => setChecked(e.target.checked)}
                    />
                    <div className="d-flex gap-2 mt-3">
                      <CButton
                        color={mode === 'confirm' ? 'primary' : 'danger'}
                        disabled={busy || !checked}
                        onClick={transition}
                      >
                        {busy
                          ? 'Procesando…'
                          : mode === 'confirm'
                            ? 'Confirmar y mover inventario'
                            : 'Confirmar anulación'}
                      </CButton>
                      <CButton
                        color="secondary"
                        disabled={busy}
                        onClick={() => {
                          setMode('detail')
                          setChecked(false)
                        }}
                      >
                        Volver
                      </CButton>
                    </div>
                  </CAlert>
                )}
              </>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton
              color="secondary"
              disabled={busy}
              onClick={() => {
                setMode('')
                setChecked(false)
              }}
            >
              Cerrar
            </CButton>
          </CModalFooter>
        </CModal>
      </CCardBody>
    </CCard>
  )
}
export default Transfers
