import React, { useEffect, useState } from 'react'
import { CAlert, CButton, CSpinner } from '@coreui/react'
import { cilSpeedometer } from '@coreui/icons'
import { useAuth } from '../../contexts/AuthContext'
import { reportService } from '../../services/reportService'
import { apiErrorMessage } from '../../services/api'
import { PageHeading } from '../../components/management/ManagementUI'
import DashboardResults from './DashboardResults'
import { currentDashboardPeriod, dashboardPeriodLabel, loadDashboard } from './dashboardModel'

const DashboardContent = () => {
  const [period, setPeriod] = useState(() => currentDashboardPeriod())
  const [catalog, setCatalog] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const { can } = useAuth()
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      reportService.catalog(controller.signal),
      loadDashboard(reportService, period, controller.signal),
    ])
      .then(([response, result]) => {
        if (!controller.signal.aborted) {
          setCatalog(response.data)
          setData(result)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [period])
  return (
    <div className="dashboard-view">
      <PageHeading
        title="Dashboard"
        description={dashboardPeriodLabel(period)}
        icon={cilSpeedometer}
      />
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <p className="small text-body-secondary mb-0">
          Ventas y unidades del mes. Existencias actuales al consultar.
        </p>
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            if (!can('REPORTE_VER')) return
            setLoading(true)
            setError('')
            setData(null)
            setCatalog(null)
            setPeriod(currentDashboardPeriod())
          }}
        >
          Actualizar resumen
        </CButton>
      </div>
      {error && (
        <CAlert color="danger" role="alert">
          {error}
        </CAlert>
      )}
      {catalog && !catalog.branches.length && (
        <CAlert color="warning">
          No tienes sucursales autorizadas; los indicadores estarán vacíos.
        </CAlert>
      )}
      {loading && (
        <div className="py-5 text-center" role="status">
          <CSpinner size="sm" className="me-2" />
          Cargando indicadores…
        </div>
      )}
      {!loading && data && (
        <DashboardResults data={data} filters={period} branches={catalog.branches} />
      )}
    </div>
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
