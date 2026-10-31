import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CFormSelect,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { apiErrorMessage } from '../../services/api'
import { cashService } from '../../services/cashService'
import { paymentService } from '../../services/paymentService'
import { saleService } from '../../services/saleService'
import { listData, money } from '../sales/saleModel'
import { paymentBalance, positiveId, validatePayment } from './cashModel'
import CashDetail from './CashDetail'
import CashOperation from './CashOperation'
import PaymentForm from './PaymentForm'
import PaymentsTable from './PaymentsTable'
import CashSessions from './CashSessions'
import CashMovementResult from './CashMovementResult'
import {
  acquireCashOperation,
  commitCashOperation,
  normalizeCashSession,
  normalizeCashMovement,
  rememberCashSession,
  cashBoxList,
} from './cashSessionModel'

const Cash = () => {
  const { usuario, can } = useAuth()
  const [boxes, setBoxes] = useState([])
  const [sales, setSales] = useState([])
  const [session, setSession] = useState(null)
  const [sessionId, setSessionId] = useState('')
  const [saleId, setSaleId] = useState('')
  const [sale, setSale] = useState(null)
  const [payments, setPayments] = useState(null)
  const [rate, setRate] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [movement, setMovement] = useState(null)
  const [consultedSessions, setConsultedSessions] = useState([])
  const [closeResult, setCloseResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('')
  const [denied, setDenied] = useState({})
  const pending = useRef(false)
  const controller = useRef(null)
  const alive = () => controller.current && !controller.current.signal.aborted
  const blocked = (permission) => !can(permission) || !!denied[permission]
  const load = useCallback(async (signal) => {
    const results = await Promise.allSettled([cashService.list(signal), saleService.list(signal)])
    if (signal.aborted) return
    const messages = []
    results.forEach((r, index) => {
      const label = index === 0 ? 'Cajas' : 'Ventas'
      if (r.status === 'fulfilled') {
        try {
          const records = listData(r.value)
          if (index === 0) setBoxes(cashBoxList(r.value))
          else setSales(records)
        } catch (e) {
          messages.push(`${label}: ${e.message}`)
        }
      } else {
        messages.push(`${label}: ${apiErrorMessage(r.reason)}`)
        if (r.reason.status === 403)
          setDenied((d) => ({ ...d, [index === 0 ? 'CAJA_VER' : 'VENTA_VER']: true }))
      }
    })
    setWarnings(messages)
    setLoading(false)
  }, [])
  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    queueMicrotask(() => {
      if (!current.signal.aborted) load(current.signal)
    })
    return () => current.abort()
  }, [load])
  const run = async (permission, operation, writing = false) => {
    if (
      (permission === 'read' && (!can('VENTA_VER') || !can('PAGO_REGISTRAR'))) ||
      (!['read', 'rate'].includes(permission) && blocked(permission))
    ) {
      setError('Acceso denegado. No tienes permiso para esta operación.')
      return
    }
    if (!acquireCashOperation(pending)) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await operation()
    } catch (e) {
      if (alive()) {
        if (e.status === 403) setDenied((d) => ({ ...d, [e.permission || permission]: true }))
        setError(
          apiErrorMessage(e) +
            (writing
              ? ' Si la respuesta se interrumpió, consulta el resultado antes de repetir la operación.'
              : ''),
        )
      }
    } finally {
      pending.current = false
      if (alive()) setBusy(false)
    }
  }
  const getSession = async (id) => {
    if (!positiveId(id)) throw new Error('Indica un ID de sesión positivo.')
    let result
    try {
      result = (await cashService.session(id, controller.current.signal)).data
    } catch (e) {
      e.permission = 'CAJA_VER'
      throw e
    }
    const record = normalizeCashSession(result, id)
    if (alive()) setConsultedSessions((rows) => rememberCashSession(rows, record))
    return record
  }
  const lookupSession = (id = sessionId) =>
    run('CAJA_VER', async () => {
      setSession(null)
      setMovement(null)
      setCloseResult(null)
      const record = await getSession(id)
      if (alive()) {
        setSession(record)
        setSessionId(String(record.id_sesion_caja))
      }
    })
  const lookupSale = () =>
    run('read', async () => {
      if (!positiveId(saleId)) throw new Error('Selecciona una venta.')
      setSale(null)
      setPayments(null)
      setReceipt(null)
      setRate(null)
      const results = await Promise.allSettled([
        saleService.get(saleId, controller.current.signal),
        paymentService.listForSale(saleId, controller.current.signal),
      ])
      if (!alive()) return
      const [s, p] = results
      if (s.status === 'rejected') {
        if (s.reason.status === 403) setDenied((d) => ({ ...d, VENTA_VER: true }))
        throw s.reason
      }
      if (!s.value.data?.id_venta) throw new Error('Respuesta de venta inválida.')
      setSale(s.value.data)
      if (p.status === 'rejected') {
        if (p.reason.status === 403) setDenied((d) => ({ ...d, PAGO_REGISTRAR: true }))
        throw p.reason
      }
      setPayments(listData(p.value))
    })
  const saveCash = (values) =>
    run(
      { open: 'CAJA_ABRIR', close: 'CAJA_CERRAR', movement: 'CAJA_MOVIMIENTO' }[mode],
      async () => {
        const updated = await commitCashOperation({
          mode,
          values,
          session,
          boxes,
          service: cashService,
          signal: controller.current.signal,
          getSession: async (id) => {
            try {
              const current = await getSession(id)
              if (alive()) setSession(current)
              return current
            } catch (e) {
              if (alive()) setSession(null)
              throw e
            }
          },
          onCommitted: (response, current) => {
            if (!alive()) return
            setMode('')
            setMovement(null)
            setCloseResult(null)
            setSuccess(response.message || 'Operación completada.')
            if (mode === 'movement') {
              setMovement(normalizeCashMovement(response.data, current.id_sesion_caja))
              setCloseResult(null)
            } else {
              const record = normalizeCashSession(
                mode === 'close' ? response.data?.sesion : response.data,
              )
              setSession(record)
              setSessionId(String(record.id_sesion_caja))
              setConsultedSessions((rows) => rememberCashSession(rows, record))
              setMovement(null)
              setCloseResult(mode === 'close' ? response.data.resumen : null)
            }
          },
          onRefreshError: (e) => {
            if (alive()) {
              setSession(null)
              setError(
                apiErrorMessage(e) +
                  ' La operación ya fue confirmada. Consulta la sesión antes de operar nuevamente.',
              )
              if (e.status === 403) setDenied((d) => ({ ...d, CAJA_VER: true }))
            }
          },
        })
        if (alive() && updated) setSession(updated)
      },
      true,
    )
  const registerPayment = (values) =>
    run(
      'PAGO_REGISTRAR',
      async () => {
        // Recheck the selected records before writing; no automatic retry of POSTs.
        const results = await Promise.allSettled([
          saleService.get(sale.id_venta, controller.current.signal),
          paymentService.listForSale(sale.id_venta, controller.current.signal),
          values.metodo === 'EFECTIVO' ? getSession(values.id_sesion_caja) : Promise.resolve(null),
          paymentService.rate(values.id_moneda, controller.current.signal),
        ])
        if (!alive()) return
        const failedIndex = results.findIndex((r) => r.status === 'rejected')
        if (failedIndex >= 0) {
          setPayments(null)
          const failure = results[failedIndex].reason
          failure.permission = ['VENTA_VER', 'PAGO_REGISTRAR', 'CAJA_VER', 'rate'][failedIndex]
          throw failure
        }
        const currentSale = results[0].value.data
        const currentPayments = listData(results[1].value)
        const currentSession = results[2].value
        const currentRate = results[3].value.data
        setSale(currentSale)
        setPayments(currentPayments)
        setRate(currentRate)
        if (currentSession) setSession(currentSession)
        validatePayment(values, currentSale, currentPayments, currentSession, currentRate)
        if (Number(currentRate.tasa) !== Number(rate?.tasa))
          throw new Error('La tasa cambió. Revisa el monto y confirma nuevamente.')
        const response = await paymentService.register(values)
        if (!alive()) return
        setReceipt(response.data)
        setMode('')
        setSuccess('Pago registrado. El servidor confirmó los totales mostrados abajo.')
        // Invalidate the previous snapshot even if the subsequent GET fails.
        setPayments(null)
        const updated = await paymentService.listForSale(sale.id_venta, controller.current.signal)
        if (alive()) setPayments(listData(updated))
      },
      true,
    )
  return (
    <CCard>
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <h1 className="h4">Caja y pagos</h1>
          <CButton
            color="secondary"
            disabled={busy || loading}
            onClick={() =>
              run('read', async () => {
                await load(controller.current.signal)
                if (session) {
                  const id = session.id_sesion_caja
                  setSession(null)
                  const record = await getSession(id)
                  if (alive()) setSession(record)
                }
                if (sale) {
                  setPayments(null)
                  const updated = await paymentService.listForSale(
                    sale.id_venta,
                    controller.current.signal,
                  )
                  if (alive()) setPayments(listData(updated))
                }
              })
            }
          >
            Actualizar
          </CButton>
        </div>
        <p>
          Usuario de operaciones: {usuario?.username || 'usuario autenticado'} · Moneda base NIO
        </p>
        {error && <CAlert color="danger">{error}</CAlert>}
        {warnings.map((w) => (
          <CAlert key={w} color="warning">
            {w}
          </CAlert>
        ))}
        {success && <CAlert color="success">{success}</CAlert>}
        {busy && <p role="status">Procesando solicitud…</p>}
        <h3>Caja</h3>
        {loading ? (
          <p role="status">Cargando cajas y ventas…</p>
        ) : (
          <CTable responsive hover>
            <CTableHead>
              <CTableRow>
                {['Código', 'Caja', 'Sucursal', 'Disponibilidad'].map((h) => (
                  <CTableHeaderCell key={h}>{h}</CTableHeaderCell>
                ))}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {boxes.map((b) => (
                <CTableRow key={b.id_caja}>
                  <CTableDataCell>{b.codigo}</CTableDataCell>
                  <CTableDataCell>{b.nombre}</CTableDataCell>
                  <CTableDataCell>{b.sucursal}</CTableDataCell>
                  <CTableDataCell>{Number(b.activo) === 1 ? 'Activa' : 'Inactiva'}</CTableDataCell>
                </CTableRow>
              ))}
              {!boxes.length && (
                <CTableRow>
                  <CTableDataCell colSpan={4}>
                    No hay cajas disponibles en el catálogo consultado.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        )}
        <p className="text-body-secondary">
          El catálogo no informa si las cajas tienen una sesión abierta. Consulta una sesión por su
          ID; al abrir, el servidor impide sesiones duplicadas.
        </p>
        <CButton
          color="primary"
          className="mb-3"
          disabled={
            busy || loading || blocked('CAJA_ABRIR') || !boxes.some((b) => Number(b.activo) === 1)
          }
          onClick={() => {
            setError('')
            if (!blocked('CAJA_ABRIR')) setMode('open')
          }}
        >
          Abrir caja
        </CButton>
        <CashSessions sessions={consultedSessions} busy={busy} onSelect={lookupSession} />
        <CForm
          className="d-flex flex-wrap gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            lookupSession()
          }}
        >
          <CFormInput
            aria-label="ID de sesión de caja"
            placeholder="ID de sesión de caja"
            type="number"
            min="1"
            step="1"
            value={sessionId}
            disabled={busy}
            onChange={(e) => setSessionId(e.target.value)}
            required
          />
          <CButton color="secondary" type="submit" disabled={busy || blocked('CAJA_VER')}>
            Consultar sesión
          </CButton>
        </CForm>
        {session && (
          <>
            <CashDetail session={session} />
            <div className="d-flex flex-wrap gap-2 mb-3">
              <CButton
                color="secondary"
                disabled={busy || session.estado !== 'ABIERTA' || blocked('CAJA_MOVIMIENTO')}
                onClick={() => {
                  setError('')
                  if (!blocked('CAJA_MOVIMIENTO')) setMode('movement')
                }}
              >
                Ingreso / egreso manual
              </CButton>
              <CButton
                color="danger"
                disabled={busy || session.estado !== 'ABIERTA' || blocked('CAJA_CERRAR')}
                onClick={() => {
                  setError('')
                  if (!blocked('CAJA_CERRAR')) setMode('close')
                }}
              >
                Cerrar caja
              </CButton>
            </div>
          </>
        )}
        {movement && <CashMovementResult result={movement} />}
        {closeResult && (
          <CAlert color="info" role="status">
            Resultado de cierre confirmado por servidor: {closeResult.resultado} · Esperado C${' '}
            {money(closeResult.monto_sistema)} · Contado C$ {money(closeResult.monto_real)} ·
            Diferencia C$ {money(closeResult.diferencia)}.
          </CAlert>
        )}
        <hr />
        <h3>Pagos por venta</h3>
        <p>
          Selecciona una venta para consultar sus pagos y saldo. CONFIRMADA no significa pagada. Los
          abonos de CREDITO se gestionan por cuotas.
        </p>
        <CForm
          className="d-flex flex-wrap gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            lookupSale()
          }}
        >
          <CFormSelect
            aria-label="Seleccionar venta"
            value={saleId}
            disabled={busy || loading}
            onChange={(e) => setSaleId(e.target.value)}
            required
          >
            <option value="">Selecciona venta</option>
            {sales.map((s) => (
              <option key={s.id_venta} value={s.id_venta}>
                {s.numero_venta} · {s.cliente} · {s.tipo_venta} / {s.estado} · C$ {money(s.total)}
              </option>
            ))}
          </CFormSelect>
          <CButton
            type="submit"
            color="primary"
            disabled={busy || !saleId || blocked('VENTA_VER') || blocked('PAGO_REGISTRAR')}
          >
            Consultar venta y pagos
          </CButton>
        </CForm>
        {sale && (
          <section aria-label="Pagos de la venta">
            <h4>
              {sale.numero_venta} · {sale.cliente}
            </h4>
            <p>
              {sale.sucursal} · {sale.estado} / {sale.tipo_venta} · Total C$ {money(sale.total)}
            </p>
            <PaymentsTable sale={sale} payments={payments} />
            <div className="d-flex gap-2 mb-3">
              <CButton
                color="primary"
                disabled={
                  busy ||
                  payments === null ||
                  !paymentBalance(sale, payments) ||
                  paymentBalance(sale, payments).pending <= 0 ||
                  sale.estado !== 'CONFIRMADA' ||
                  sale.tipo_venta !== 'CONTADO' ||
                  blocked('PAGO_REGISTRAR')
                }
                onClick={() => {
                  setError('')
                  setRate(null)
                  if (!blocked('PAGO_REGISTRAR')) setMode('payment')
                }}
              >
                Registrar pago
              </CButton>
              <CButton
                color="secondary"
                disabled={busy}
                href={`#/ventas?buscar=${encodeURIComponent(sale.numero_venta)}`}
              >
                Ver venta en Ventas
              </CButton>
            </div>
          </section>
        )}
        {receipt && (
          <CAlert color="success">
            Pago #{receipt.pago.id_pago} · {receipt.pago.estado} · {receipt.pago.moneda}{' '}
            {money(receipt.pago.monto)} · Tipo de cambio histórico: {receipt.pago.tipo_cambio} ·
            Monto base C$ {money(receipt.pago.monto_base)} · Sesión:{' '}
            {receipt.pago.id_sesion_caja || 'Sin sesión (no efectivo)'}. Total venta: C${' '}
            {money(receipt.total_venta)} · Total pagado: C$ {money(receipt.total_pagado)} · Saldo
            pendiente: C$ {money(receipt.saldo_pendiente)} (confirmados por servidor al registrar).{' '}
            {receipt.pago.metodo === 'EFECTIVO' &&
              'El servidor registra un movimiento VENTA con referencia PAGO en esta misma transacción. No hay endpoint para consultarlo individualmente.'}
          </CAlert>
        )}
        <CModal
          visible={!!mode}
          scrollable
          backdrop="static"
          keyboard={!busy}
          onClose={() => {
            if (!busy) setMode('')
          }}
          size="lg"
        >
          <CModalHeader closeButton={!busy}>
            <CModalTitle>
              {
                {
                  open: 'Abrir caja',
                  close: 'Cerrar caja',
                  movement: 'Movimiento manual',
                  payment: 'Registrar pago',
                }[mode]
              }
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {['open', 'close', 'movement'].includes(mode) && (
              <CashOperation
                key={mode}
                mode={mode}
                boxes={boxes}
                session={session}
                busy={busy}
                onSave={saveCash}
              />
            )}
            {mode === 'payment' && sale && (
              <PaymentForm
                sale={sale}
                payments={payments}
                session={session}
                rate={rate}
                busy={busy}
                onSave={registerPayment}
                onRate={(id) =>
                  run('rate', async () => {
                    setRate(null)
                    const record = (await paymentService.rate(id, controller.current.signal)).data
                    if (!['NIO', 'USD'].includes(record?.moneda))
                      throw new Error('Este módulo admite NIO y USD.')
                    if (alive()) setRate(record)
                  })
                }
              />
            )}
          </CModalBody>
        </CModal>
      </CCardBody>
    </CCard>
  )
}
export default Cash
