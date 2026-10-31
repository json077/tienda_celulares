import React, { useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { apiErrorMessage } from '../../services/api'
import { reportService } from '../../services/reportService'
import ReportResult from './ReportResult'
import { cilChartLine } from '@coreui/icons'
import { PageHeading } from '../../components/management/ManagementUI'

const Reports = () => {
  const { can } = useAuth()
  const [catalog, setCatalog] = useState(null)
  const [selection, setSelection] = useState('ventas')
  const [filters, setFilters] = useState({})
  const [request, setRequest] = useState({})
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const exportController = useRef(null)
  const allowed = can('REPORTE_VER')

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    reportService
      .catalog(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setCatalog(response.data)
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(e))
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [allowed])

  useEffect(() => {
    if (!allowed || !catalog) return
    const controller = new AbortController()
    reportService
      .read(selection, request, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setData(response.data)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
      exportController.current?.abort()
    }
  }, [allowed, catalog, selection, request])

  const definition = catalog?.reports.find((r) => r.id === selection)
  const set = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }))
  const download = async () => {
    if (!can('REPORTE_VER') || !can('REPORTE_EXPORTAR') || !data || exporting || loading) return
    const controller = new AbortController()
    exportController.current?.abort()
    exportController.current = controller
    setExporting(true)
    setError('')
    try {
      const blob = await reportService.export(data.id, data.filters, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte-${data.id}.xlsx`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      if (!controller.signal.aborted) setError(apiErrorMessage(e))
    } finally {
      if (exportController.current === controller) setExporting(false)
    }
  }

  if (!allowed) return <CAlert color="warning">No tienes permiso para consultar reportes.</CAlert>
  return (
    <>
      <PageHeading
        title="Reportes"
        description="Consulta tus operaciones y descarga información lista para presentar en Excel."
        icon={cilChartLine}
      />
      <CCard className="management-panel mb-4">
        <CCardBody>
          <h2 className="h6 mb-1">Configura tu consulta</h2>
          <p className="small text-body-secondary mb-4">
            Selecciona uno de los ocho reportes y aplica los filtros de tus sucursales autorizadas.
          </p>
          {error && <CAlert color="danger">{error}</CAlert>}
          {catalog && (
            <CForm
              onSubmit={(e) => {
                e.preventDefault()
                if (can('REPORTE_VER')) {
                  setLoading(true)
                  setData(null)
                  setError('')
                  setRequest({ ...filters })
                }
              }}
            >
              <CRow className="g-3 mb-3">
                <CCol md={6}>
                  <CFormLabel htmlFor="report-type" className="fw-semibold text-primary">
                    Reporte
                  </CFormLabel>
                  <CFormSelect
                    id="report-type"
                    className="border-primary"
                    value={selection}
                    onChange={(e) => {
                      setLoading(true)
                      setData(null)
                      setError('')
                      setSelection(e.target.value)
                      setFilters({})
                      setRequest({})
                    }}
                  >
                    {catalog.reports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="report-branch">Sucursal</CFormLabel>
                  <CFormSelect
                    id="report-branch"
                    value={filters.id_sucursal || ''}
                    onChange={(e) => set('id_sucursal', e.target.value)}
                  >
                    <option value="">Todas las autorizadas</option>
                    {catalog.branches.map((b) => (
                      <option key={b.id_sucursal} value={b.id_sucursal}>
                        {b.nombre}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                {definition?.dates !== false &&
                  ['desde', 'hasta'].map((key) => (
                    <CCol md={3} key={key}>
                      <CFormLabel htmlFor={`report-${key}`}>
                        {key === 'desde' ? 'Desde' : 'Hasta (inclusive)'}
                      </CFormLabel>
                      <CFormInput
                        id={`report-${key}`}
                        type="date"
                        value={filters[key] || ''}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </CCol>
                  ))}
                {definition?.states && (
                  <CCol md={3}>
                    <CFormLabel htmlFor="report-state">Estado</CFormLabel>
                    <CFormSelect
                      id="report-state"
                      value={filters.estado || ''}
                      onChange={(e) => set('estado', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {definition.states.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                )}
                {definition?.product && (
                  <CCol md={3}>
                    <CFormLabel htmlFor="report-product">Producto</CFormLabel>
                    <CFormSelect
                      id="report-product"
                      value={filters.id_producto || ''}
                      onChange={(e) => set('id_producto', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {catalog.products.map((p) => (
                        <option key={p.id_producto} value={p.id_producto}>
                          {p.sku} · {p.nombre}
                        </option>
                      ))}
                    </CFormSelect>
                  </CCol>
                )}
                {definition?.methods && (
                  <CCol md={3}>
                    <CFormLabel htmlFor="report-method">Método de pago</CFormLabel>
                    <CFormSelect
                      id="report-method"
                      value={filters.metodo || ''}
                      onChange={(e) => set('metodo', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {definition.methods.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                )}
              </CRow>
              {selection === 'creditos' && (
                <CAlert color="info">
                  Desde y Hasta filtran la fecha de inicio del crédito, no la fecha de la venta.
                  Deja ambas fechas vacías para consultar todos los créditos pendientes autorizados.
                </CAlert>
              )}
              <div className="d-flex flex-wrap gap-2 mb-4">
                <CButton type="submit" color="primary" disabled={loading || exporting}>
                  Consultar / aplicar filtros
                </CButton>
                <CButton
                  type="button"
                  color="success"
                  disabled={loading || exporting || !data || !can('REPORTE_EXPORTAR')}
                  onClick={download}
                >
                  {exporting ? 'Generando Excel…' : 'Exportar a Excel (.xlsx)'}
                </CButton>
              </div>
              {!can('REPORTE_EXPORTAR') && <p>No tienes permiso para exportar reportes.</p>}
              <p className="text-body-secondary">
                Excel consulta nuevamente los datos con los filtros aplicados a la tabla.
              </p>
              {!catalog.branches.length && (
                <CAlert color="warning">
                  No tienes sucursales activas asignadas; las consultas devolverán resultados
                  vacíos.
                </CAlert>
              )}
            </CForm>
          )}
          {loading && (
            <div className="py-3 text-center" role="status">
              <CSpinner size="sm" aria-label="Cargando reporte" /> Consultando reporte…
            </div>
          )}
        </CCardBody>
      </CCard>
      {!loading && data && <ReportResult data={data} />}
    </>
  )
}
export default Reports
