import React, { useEffect, useState } from 'react'
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
import { cilSpeedometer } from '@coreui/icons'
import { useAuth } from '../../contexts/AuthContext'
import { reportService } from '../../services/reportService'
import { apiErrorMessage } from '../../services/api'
import { PageHeading } from '../../components/management/ManagementUI'
import DashboardResults from './DashboardResults'
import { initialDashboardFilters, loadDashboard, validateDashboardFilters } from './dashboardModel'

const DashboardContent = () => {
  const { can } = useAuth()
  const allowed = can('REPORTE_VER')
  const [filters, setFilters] = useState({ ...initialDashboardFilters })
  const [request, setRequest] = useState({ ...initialDashboardFilters })
  const [catalog, setCatalog] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    reportService
      .catalog(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setLoading(true)
          setData(null)
          setError('')
          setCatalog(response.data)
        }
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
    loadDashboard(reportService, request, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [allowed, catalog, request])
  return (
    <>
      <PageHeading
        title="Dashboard"
        description="Ventas e inventario de tus sucursales, en una sola vista."
        icon={cilSpeedometer}
      />
      {!allowed ? (
        <CAlert color="warning">
          Necesitas el permiso de consulta de reportes para ver los indicadores del Dashboard.
        </CAlert>
      ) : (
        <>
          {error && (
            <CAlert color="danger" role="alert">
              {error}
            </CAlert>
          )}
          <CCard className="management-panel mb-4">
            <CCardBody>
              <h2 className="h6 mb-3">Período y sucursal</h2>
              <CForm
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!can('REPORTE_VER')) return
                  try {
                    setRequest(validateDashboardFilters(filters))
                    setError('')
                    setData(null)
                    setLoading(true)
                  } catch (e) {
                    setError(e.message)
                  }
                }}
              >
                <CRow className="g-3 align-items-end">
                  {['desde', 'hasta'].map((key) => (
                    <CCol sm={6} lg={3} key={key}>
                      <CFormLabel htmlFor={`dashboard-${key}`}>
                        {key === 'desde' ? 'Desde' : 'Hasta (inclusive)'}
                      </CFormLabel>
                      <CFormInput
                        id={`dashboard-${key}`}
                        type="date"
                        required
                        value={filters[key]}
                        onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                      />
                    </CCol>
                  ))}
                  <CCol lg={4}>
                    <CFormLabel htmlFor="dashboard-branch">Sucursal</CFormLabel>
                    <CFormSelect
                      id="dashboard-branch"
                      value={filters.id_sucursal}
                      onChange={(e) => setFilters((p) => ({ ...p, id_sucursal: e.target.value }))}
                    >
                      <option value="">Todas las autorizadas</option>
                      {catalog?.branches.map((b) => (
                        <option key={b.id_sucursal} value={b.id_sucursal}>
                          {b.nombre}
                        </option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol lg={2}>
                    <CButton
                      type="submit"
                      color="primary"
                      className="w-100"
                      disabled={loading || !catalog}
                    >
                      Aplicar filtros
                    </CButton>
                  </CCol>
                </CRow>
              </CForm>
              <p className="small text-body-secondary mt-3 mb-0">
                Ventas y unidades corresponden al período. Existencias muestra el stock actual de la
                sucursal seleccionada.
              </p>
            </CCardBody>
          </CCard>
          {catalog && !catalog.branches.length && (
            <CAlert color="warning">
              No tienes sucursales autorizadas; los indicadores estarán vacíos.
            </CAlert>
          )}
          {loading && (
            <div className="py-5 text-center" role="status">
              <CSpinner size="sm" /> Cargando indicadores…
            </div>
          )}
          {!loading && data && (
            <DashboardResults data={data} filters={request} branches={catalog.branches} />
          )}
        </>
      )}
    </>
  )
}
const Dashboard = () => {
  const { can } = useAuth()
  return can('REPORTE_VER') ? (
    <DashboardContent />
  ) : (
    <>
      <PageHeading
        title="Dashboard"
        description="Ventas e inventario de tus sucursales, en una sola vista."
        icon={cilSpeedometer}
      />
      <CAlert color="warning">
        Necesitas el permiso de consulta de reportes para ver los indicadores del Dashboard.
      </CAlert>
    </>
  )
}
export default Dashboard
