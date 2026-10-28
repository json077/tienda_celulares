import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CFormSelect,
  CFormInput,
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
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { apiErrorMessage } from '../../services/api'
import { returnService } from '../../services/returnService'
import { saleService } from '../../services/saleService'
import { dateTime } from '../cash/cashModel'
import { listData } from '../sales/saleModel'
import {
  acquireReturnOperation,
  assertReturn,
  createReturn,
  eligibleSales,
  filterReturns,
  loadReturnContext,
  processReturn,
  returnRows,
  returnStates,
} from './returnModel'
import ReturnDetail, { ReturnFinancialNotice } from './ReturnDetail'
import ReturnForm from './ReturnForm'

const Returns = () => {
  const { usuario } = useAuth()
  const [rows, setRows] = useState([])
  const [sales, setSales] = useState([])
  const [saleId, setSaleId] = useState('')
  const [context, setContext] = useState(null)
  const [record, setRecord] = useState(null)
  const [mode, setMode] = useState('')
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [denied, setDenied] = useState({})
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
        const data = returnRows(await returnService.list(signal))
        if (!signal.aborted) setRows(data)
      } catch (e) {
        if (!signal.aborted) {
          setRows([])
          noteError(e, 'DEVOLUCIONES_VER')
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
    if (!acquireReturnOperation(pending)) return
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
              ' Si se perdió la respuesta, consulta el número de devolución antes de repetir. No hay reintentos automáticos.',
          )
      }
    } finally {
      pending.current = false
      if (alive()) setBusy(false)
    }
  }
  const get = async (id) => {
    try {
      return assertReturn((await returnService.get(id, controller.current.signal)).data, id)
    } catch (e) {
      e.permission = 'DEVOLUCIONES_VER'
      throw e
    }
  }
  const openDetail = (row) =>
    run('DEVOLUCIONES_VER', async () => {
      setRecord(null)
      const current = await get(row.id_devolucion)
      if (alive()) {
        setRecord(current)
        setMode('detail')
        setChecked(false)
      }
    })
  const openNew = () =>
    run('VENTA_VER', async () => {
      const records = listData(await saleService.list(controller.current.signal))
      if (alive()) {
        setSales(eligibleSales(records))
        setSaleId('')
        setContext(null)
        setMode('new')
      }
    })
  const consultSale = (id) =>
    run('DEVOLUCIONES_VER', async () => {
      setSaleId(id)
      setContext(null)
      if (!id) return
      const current = await loadReturnContext({
        id,
        sales: saleService,
        returns: returnService,
        signal: controller.current.signal,
      })
      if (alive()) setContext(current)
    })
  const committed = (response, expectedId) => {
    if (!alive()) return
    setMode('')
    setChecked(false)
    setContext(null)
    setRecord(null)
    setSuccess(response.message || 'Operación confirmada por el servidor.')
    try {
      setRecord(assertReturn(response.data, expectedId))
    } catch (e) {
      setError(e.message + ' La escritura fue confirmada. Consulta antes de operar nuevamente.')
    }
  }
  const refreshList = async () => {
    if (!alive()) return
    setLoading(true)
    await load(controller.current.signal)
  }
  const create = (values) =>
    run(
      'DEVOLUCIONES_CREAR',
      async () => {
        const response = await createReturn({
          values,
          sales: saleService,
          returns: returnService,
          signal: controller.current.signal,
          onCommitted: committed,
        })
        if (response) await refreshList()
      },
      true,
    )
  const transition = () => {
    if (!checked || !['confirm', 'cancel'].includes(mode)) return
    const action = mode
    run(
      action === 'confirm' ? 'DEVOLUCIONES_CONFIRMAR' : 'DEVOLUCIONES_ANULAR',
      async () => {
        setChecked(false)
        const id = record.id_devolucion
        try {
          const response = await processReturn({
            action,
            record,
            returns: returnService,
            signal: controller.current.signal,
            onCurrent: (current) => {
              if (alive()) setRecord(current)
            },
            onCommitted: (result) => committed(result, id),
          })
          if (response) await refreshList()
        } catch (e) {
          if (alive()) {
            setRecord(null)
            setMode('')
            await refreshList()
          }
          throw e
        }
      },
      true,
    )
  }
  const refresh = () =>
    run('DEVOLUCIONES_VER', async () => {
      await refreshList()
      if (record) {
        const id = record.id_devolucion
        setRecord(null)
        const current = await get(id)
        if (alive()) setRecord(current)
      }
    })
  const header = rows.find((r) => Number(r.id_devolucion) === Number(record?.id_devolucion)) || {}
  const filtered = filterReturns(rows, query, state)
  return (
    <CCard>
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <h1 className="h4">Devoluciones</h1>
          <div className="d-flex gap-2">
            <CButton color="secondary" disabled={busy || loading} onClick={refresh}>
              Actualizar
            </CButton>
            <CButton
              color="primary"
              disabled={
                busy ||
                blocked('DEVOLUCIONES_CREAR') ||
                blocked('VENTA_VER') ||
                blocked('DEVOLUCIONES_VER')
              }
              onClick={openNew}
            >
              Nueva devolución
            </CButton>
          </div>
        </div>
        <ReturnFinancialNotice />
        {error && <CAlert color="danger">{error}</CAlert>}
        {success && <CAlert color="success">{success}</CAlert>}
        {busy && <p role="status">Procesando solicitud…</p>}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <CFormInput
            id="return-search"
            label="Buscar número, venta, motivo o sucursal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CFormSelect
            id="return-state"
            label="Estado"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Todos</option>
            {returnStates.map((s) => (
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
          <p role="status">Cargando devoluciones…</p>
        ) : (
          <CTable responsive hover>
            <CTableHead>
              <CTableRow>
                {['Número', 'Venta', 'Sucursal', 'Fecha', 'Motivo', 'Estado', 'Acciones'].map(
                  (h) => (
                    <CTableHeaderCell key={h} scope="col">
                      {h}
                    </CTableHeaderCell>
                  ),
                )}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((r) => (
                <CTableRow key={r.id_devolucion}>
                  <CTableDataCell>{r.numero_devolucion}</CTableDataCell>
                  <CTableDataCell>{r.numero_venta || `Referencia #${r.id_venta}`}</CTableDataCell>
                  <CTableDataCell>{r.sucursal}</CTableDataCell>
                  <CTableDataCell>{dateTime(r.fecha)}</CTableDataCell>
                  <CTableDataCell>{r.motivo}</CTableDataCell>
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
                  <CTableDataCell>
                    <CButton
                      color="secondary"
                      size="sm"
                      disabled={busy || blocked('DEVOLUCIONES_VER')}
                      onClick={() => openDetail(r)}
                    >
                      Consultar detalle
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {!filtered.length && (
                <CTableRow>
                  <CTableDataCell colSpan={7}>No hay devoluciones para mostrar.</CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        )}
        <p className="small text-body-secondary">
          Los filtros se aplican al listado consultado. Crear un borrador no reserva cantidades ni
          modifica inventario.
        </p>
        {record && !mode && (
          <>
            <ReturnDetail record={record} header={header} />
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
          scrollable
          size="xl"
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
              {mode === 'new' ? 'Nueva devolución' : 'Detalle de devolución'}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {mode === 'new' && (
              <>
                <CFormSelect
                  id="return-sale"
                  className="mb-3"
                  label="Venta CONFIRMADA"
                  value={saleId}
                  disabled={busy}
                  onChange={(e) => consultSale(e.target.value)}
                >
                  <option value="">Selecciona una venta</option>
                  {sales.map((s) => (
                    <option key={s.id_venta} value={s.id_venta}>
                      {s.numero_venta} · {s.cliente} · {s.sucursal} · {s.tipo_venta}
                    </option>
                  ))}
                </CFormSelect>
                {!sales.length && (
                  <p>No hay ventas confirmadas disponibles en el catálogo consultado.</p>
                )}
                {saleId && (
                  <CButton
                    className="mb-3"
                    color="secondary"
                    disabled={busy}
                    onClick={() => consultSale(saleId)}
                  >
                    Actualizar artículos (reinicia el formulario)
                  </CButton>
                )}
                {context && (
                  <ReturnForm
                    key={context.sale.id_venta}
                    context={context}
                    busy={busy}
                    onSave={create}
                  />
                )}
              </>
            )}
            {mode !== 'new' && record && (
              <>
                <ReturnDetail record={record} header={header} />
                {mode === 'detail' && record.estado === 'BORRADOR' && (
                  <div className="d-flex flex-wrap gap-2">
                    <CButton
                      color="primary"
                      disabled={busy || blocked('DEVOLUCIONES_CONFIRMAR')}
                      onClick={() => {
                        setMode('confirm')
                        setChecked(false)
                        setError('')
                      }}
                    >
                      Confirmar devolución
                    </CButton>
                    <CButton
                      color="danger"
                      disabled={busy || blocked('DEVOLUCIONES_ANULAR')}
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
                        ? 'Confirmar aplicará las condiciones y reintegros indicados: los teléfonos defectuosos no quedarán disponibles para venta. Esta acción no se revierte desde el módulo y no devuelve dinero.'
                        : 'Anular descarta este borrador sin modificar inventario. No podrá reactivarse.'}
                    </p>
                    <CFormCheck
                      id="return-action-confirm"
                      disabled={busy}
                      label={`Revisé ${record.numero_devolucion}, su venta, cantidades, IMEI y condiciones; confirmo ${mode === 'confirm' ? 'el procesamiento' : 'la anulación'}`}
                      checked={checked}
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
                            ? 'Confirmar y procesar inventario'
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
export default Returns
