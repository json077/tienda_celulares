import React from 'react'
import { CCard, CCardBody, CCol, CRow } from '@coreui/react'

const metrics = [
  'Ventas de hoy',
  'Ingresos de hoy',
  'Productos con stock bajo',
  'Créditos pendientes',
]
const charts = ['Ventas por período', 'Productos más vendidos', 'Estado del inventario']

const Dashboard = () => (
  <>
    <h1 className="h4">Dashboard</h1>
    <p className="text-body-secondary">Resumen de inventario y facturación de Tienda Celulares.</p>
    <CRow className="g-4 mb-4">
      {metrics.map((title) => (
        <CCol xs={12} sm={6} xl={3} key={title}>
          <CCard className="h-100">
            <CCardBody>
              <h2 className="h6">{title}</h2>
              <p className="fs-3 fw-semibold mb-1">—</p>
              <p className="small text-body-secondary mb-0">
                Pendiente de obtener datos desde la API.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      ))}
    </CRow>
    <section aria-labelledby="dashboard-charts">
      <h2 id="dashboard-charts" className="h5">
        Gráficos del sistema
      </h2>
      <p className="text-body-secondary">
        Espacio reservado para gráficos basados en la base de datos. Se habilitarán al conectar los
        endpoints.
      </p>
      <CRow className="g-4 mb-4">
        {charts.map((title) => (
          <CCol xs={12} lg={4} key={title}>
            <CCard className="h-100">
              <CCardBody className="py-5 text-center">
                <h3 className="h6">{title}</h3>
                <p className="small text-body-secondary mb-0">Gráfico pendiente de integración.</p>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>
    </section>
  </>
)

export default Dashboard
