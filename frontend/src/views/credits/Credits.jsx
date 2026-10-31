import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
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
} from '@coreui/react'
import { apiErrorMessage } from '../../services/api'
import { creditService } from '../../services/creditService'
import { paymentService } from '../../services/paymentService'
import { saleService } from '../../services/saleService'
import { cashService } from '../../services/cashService'
import { useAuth } from '../../contexts/AuthContext'
import CreditDetail, { CreditTable } from './CreditDetail'
import CreditPaymentForm from './CreditPaymentForm'
import CreditPlanForm from './CreditPlanForm'
import {
  loadCreditPlanSales,
  createCreditPlan,
  completeCreditPlanCreation,
  validateCreditPlan,
} from './creditPlanModel'
import {
  creditList,
  creditDetail,
  creditPaymentHistory,
  creditStates,
  filterCredits,
  createOperationGate,
  validateInstallment,
  money,
} from './creditModel'

const Credits = () => {
  const { can } = useAuth()
  const canPlan = can('CREDITOS_CREAR') && can('VENTA_VER')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [payments, setPayments] = useState(null)
  const [historyError, setHistoryError] = useState('')
  const [quota, setQuota] = useState(null)
  const [sale, setSale] = useState(null)
  const [rate, setRate] = useState(null)
  const [session, setSession] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const [warning, setWarning] = useState('')
  const [plan, setPlan] = useState(null)
  const [planError, setPlanError] = useState('')
  const controller = useRef(null)
  const [gate] = useState(createOperationGate)

  const load = useCallback(
    (signal) =>
      creditService
        .list(signal)
        .then(creditList)
        .then((records) => {
          if (!signal.aborted) {
            setRows(records)
            setError('')
          }
        })
        .catch((e) => {
          if (!signal.aborted) setError(apiErrorMessage(e))
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
  const alive = () => controller.current && !controller.current.signal.aborted
  const perform = (operation) =>
    gate.run(async () => {
      setBusy(true)
      try {
        await operation()
      } finally {
        if (alive()) setBusy(false)
      }
    })
  // El historial se consulta por venta, no por crédito ni por cuota.
  const loadDetail = async (record) => {
    setDetail(null)
    setDetailError('')
    setPayments(null)
    setHistoryError('')
    const results = await Promise.allSettled([
      creditService
        .get(record.id_credito, controller.current.signal)
        .then((response) => creditDetail(response, record.id_credito)),
      paymentService
        .listForSale(record.id_venta, controller.current.signal)
        .then((response) => creditPaymentHistory(response, record.id_venta)),
    ])
    if (!alive()) return
    if (results[0].status === 'fulfilled') setDetail(results[0].value)
    else setDetailError(apiErrorMessage(results[0].reason))
    if (results[1].status === 'fulfilled') setPayments(results[1].value)
    else setHistoryError(apiErrorMessage(results[1].reason))
  }
  const refresh = () =>
    perform(async () => {
      setLoading(true)
      await load(controller.current.signal)
    })
  const open = (record) =>
    perform(async () => {
      setSelected(record)
      setQuota(null)
      setSuccess('')
      await loadDetail(record)
    })
  const openPayment = (q) =>
    perform(async () => {
      if (!can('CREDITOS_PAGAR')) return
      setQuota(q)
      setRate(null)
      setSession(null)
      setSale(null)
      setPaymentError('')
      setWarning('')
      try {
        const response = await saleService.get(detail.id_venta, controller.current.signal)
        if (Number(response.data?.id_venta) !== Number(detail.id_venta))
          throw new Error('Venta consultada inválida.')
        if (alive()) setSale(response.data)
      } catch (e) {
        if (alive())
          setWarning(
            `${apiErrorMessage(e)} No se puede comprobar la sucursal para efectivo; puedes usar otro método autorizado.`,
          )
      }
    })
  const consult = (type, id) =>
    perform(async () => {
      setPaymentError('')
      if (type === 'rate') setRate(null)
      else setSession(null)
      try {
        const response =
          type === 'rate'
            ? await paymentService.rate(id, controller.current.signal)
            : await cashService.session(id, controller.current.signal)
        if (
          !response.data ||
          Number(response.data[type === 'rate' ? 'id_moneda' : 'id_sesion_caja']) !== Number(id)
        )
          throw new Error('Respuesta de consulta inválida.')
        if (alive()) {
          if (type === 'rate') setRate(response.data)
          else setSession(response.data)
        }
      } catch (e) {
        if (alive()) setPaymentError(apiErrorMessage(e))
      }
    })
  const pay = (values) =>
    perform(async () => {
      if (!can('CREDITOS_PAGAR')) return
      const invalid = validateInstallment(values, detail, quota, rate, session, sale)
      if (invalid) {
        setPaymentError(invalid)
        return
      }
      setPaymentError('')
      setSuccess('')
      let response
      try {
        response = await creditService.pay(quota.id_cuota, values)
      } catch (e) {
        if (alive())
          setPaymentError(
            `${apiErrorMessage(e)} Si hubo un fallo de conexión, consulta el detalle y los pagos antes de volver a enviar.`,
          )
        return
      }
      if (!alive()) return
      // Una escritura confirmada nunca se reintenta por un fallo posterior de lectura.
      setQuota(null)
      setSuccess(
        `${response.message || 'Abono registrado.'}${response.data?.pago ? ` Monto aplicado: ${money(response.data.pago.monto_base)}.` : ''}`,
      )
      await Promise.all([loadDetail(selected), load(controller.current.signal)])
    })
  const loadPlanSales = async () => {
    setPlanError('')
    setPlan({ sales: [] })
    try {
      const sales = await loadCreditPlanSales(
        { sales: saleService, credits: creditService },
        controller.current.signal,
      )
      if (alive()) setPlan({ sales })
    } catch (e) {
      if (alive()) setPlanError(apiErrorMessage(e))
    }
  }
  const openPlan = () =>
    perform(async () => {
      if (!canPlan) return
      setSuccess('')
      await loadPlanSales()
    })
  const savePlan = (values) =>
    perform(async () => {
      if (!canPlan) return
      const invalid = validateCreditPlan(values, plan.sales)
      if (invalid) {
        setPlanError(invalid)
        return
      }
      setPlanError('')
      let response
      try {
        response = await createCreditPlan(
          values,
          { sales: saleService, credits: creditService },
          controller.current.signal,
        )
      } catch (e) {
        if (alive())
          setPlanError(
            `${apiErrorMessage(e)} Si se perdió la conexión, actualiza los créditos antes de volver a crear el plan.`,
          )
        return
      }
      if (!alive()) return
      await completeCreditPlanCreation(
        response,
        (created) => {
          setPlan(null)
          setQuery('')
          setState('')
          setSuccess(created.message || 'Crédito creado correctamente')
          // Conservar el resultado confirmado si falla la recarga posterior.
          try {
            const newCredit = creditDetail(created, created.data?.id_credito)
            setRows((current) => [
              newCredit,
              ...current.filter((row) => row.id_credito !== newCredit.id_credito),
            ])
          } catch {
            setError(
              'El plan fue creado, pero su respuesta no pudo mostrarse. Actualiza el listado antes de continuar.',
            )
          }
        },
        () => load(controller.current.signal),
      )
    })
  const filtered = filterCredits(rows, query, state)
  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h1 className="h4">Créditos</h1>
              <p className="text-body-secondary mb-0">
                Consulta de planes de crédito y abonos por cuota.
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <CButton
                color="secondary"
                variant="outline"
                disabled={busy || loading}
                onClick={refresh}
              >
                Actualizar
              </CButton>
              <CButton color="primary" disabled={busy || loading || !canPlan} onClick={openPlan}>
                Nuevo plan de crédito
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
          <CRow className="g-3 mb-3">
            <CCol md={7}>
              <CFormLabel htmlFor="credit-search">
                Buscar cliente, identificación o venta
              </CFormLabel>
              <CFormInput
                id="credit-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </CCol>
            <CCol md={3}>
              <CFormLabel htmlFor="credit-state">Estado</CFormLabel>
              <CFormSelect
                id="credit-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Todos</option>
                {creditStates.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={12}>
              <CButton
                size="sm"
                color="secondary"
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setState('')
                }}
              >
                Limpiar filtros
              </CButton>
            </CCol>
          </CRow>
          {loading ? (
            <div role="status" className="text-center py-4">
              <CSpinner size="sm" /> Cargando créditos…
            </div>
          ) : (
            <>
              {error && rows.length > 0 && (
                <p>Se muestra el último listado cargado. Actualiza antes de operar.</p>
              )}
              <CreditTable rows={filtered} busy={busy} onOpen={open} />
              <p className="small text-body-secondary">
                {filtered.length} de {rows.length} créditos.
              </p>
            </>
          )}
        </CCardBody>
      </CCard>
      <CModal
        visible={!!plan && canPlan}
        size="lg"
        scrollable
        backdrop="static"
        keyboard={!busy}
        onClose={() => {
          if (!busy) setPlan(null)
        }}
        aria-labelledby="credit-plan-title"
      >
        <CModalHeader closeButton={!busy}>
          <CModalTitle id="credit-plan-title">Nuevo plan de crédito</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {busy && (
            <p role="status">
              <CSpinner size="sm" /> Consultando o procesando plan…
            </p>
          )}
          {plan && (
            <CreditPlanForm
              sales={plan.sales}
              busy={busy}
              error={planError}
              onSave={savePlan}
              onRefresh={() => perform(loadPlanSales)}
              onCancel={() => setPlan(null)}
            />
          )}
        </CModalBody>
      </CModal>
      <CModal
        visible={!!selected}
        size="lg"
        scrollable
        backdrop="static"
        keyboard={!busy}
        onClose={() => {
          if (!busy) {
            setSelected(null)
            setQuota(null)
          }
        }}
        aria-labelledby="credit-detail-title"
      >
        <CModalHeader closeButton={!busy}>
          <CModalTitle id="credit-detail-title">
            {quota ? 'Registrar abono' : 'Detalle del crédito'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {busy && (
            <p role="status">
              <CSpinner size="sm" /> Procesando…
            </p>
          )}
          {success && (
            <CAlert color="success" role="status">
              {success}
            </CAlert>
          )}
          {detailError && (
            <CAlert color="danger" role="alert">
              {detailError}
            </CAlert>
          )}
          {!quota && (
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              className="mb-3"
              disabled={busy}
              onClick={() => perform(() => loadDetail(selected))}
            >
              Actualizar detalle e historial
            </CButton>
          )}
          {detail &&
            (quota ? (
              <CreditPaymentForm
                credit={detail}
                quota={quota}
                sale={sale}
                rate={rate}
                session={session}
                busy={busy}
                error={paymentError}
                warning={warning}
                onConsult={consult}
                onSave={pay}
                onCancel={() => setQuota(null)}
              />
            ) : (
              <CreditDetail
                mayPay={can('CREDITOS_PAGAR')}
                credit={detail}
                payments={payments}
                historyError={historyError}
                busy={busy}
                onPay={openPayment}
              />
            ))}
        </CModalBody>
      </CModal>
    </>
  )
}
export default Credits
