import React from 'react'
import PropTypes from 'prop-types'
import { CChartBar, CChartDoughnut } from '@coreui/react-chartjs'
import {
  CCard,
  CCardBody,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { MetricCards, managementNumber } from '../../components/management/ManagementUI'

const ChartPanel = ({ title, description, labels, values, money = false, doughnut = false }) => {
  const Chart = doughnut ? CChartDoughnut : CChartBar
  const empty = labels.length === 0 || (doughnut && values.every((v) => v === 0))
  return (
    <CCard className="management-panel h-100">
      <CCardBody>
        <h2 className="h5">{title}</h2>
        <p className="small text-body-secondary">{description}</p>
        {empty ? (
          <div className="management-empty">
            No hay resultados para los filtros y sucursales autorizadas.
          </div>
        ) : (
          <>
            <div className="management-chart">
              <Chart
                role="img"
                aria-label={title}
                data={{
                  labels,
                  datasets: [
                    {
                      label: money ? 'Ventas confirmadas (C$)' : 'Cantidad',
                      data: values,
                      backgroundColor: doughnut ? ['#198754', '#f0ad4e', '#dc3545'] : '#4263eb',
                      borderRadius: doughnut ? 0 : 5,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: doughnut, position: 'bottom' } },
                  ...(doughnut
                    ? { cutout: '68%' }
                    : {
                        scales: { y: { beginAtZero: true, ticks: { precision: money ? 2 : 0 } } },
                      }),
                }}
              />
            </div>
            <details className="mt-3">
              <summary className="small text-primary">Ver datos del gráfico</summary>
              <CTable small responsive className="management-table mt-2">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell scope="col">
                      {doughnut ? 'Estado' : money ? 'Día' : 'Producto'}
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col">
                      {money ? 'Ventas (C$)' : 'Cantidad'}
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {labels.map((label, i) => (
                    <CTableRow key={label}>
                      <CTableDataCell>{label}</CTableDataCell>
                      <CTableDataCell>{managementNumber(values[i], money)}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </details>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}
ChartPanel.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  labels: PropTypes.array.isRequired,
  values: PropTypes.array.isRequired,
  money: PropTypes.bool,
  doughnut: PropTypes.bool,
}

const DashboardResults = ({ data, filters, branches }) => (
  <>
    <p className="small text-body-secondary">
      Período aplicado: {filters.desde} al {filters.hasta} ·{' '}
      {filters.id_sucursal
        ? branches.find((b) => String(b.id_sucursal) === String(filters.id_sucursal))?.nombre
        : 'Todas las sucursales autorizadas'}
    </p>
    <MetricCards
      items={[
        {
          label: 'Ventas confirmadas',
          value: data.total,
          type: 'money',
          note: 'Importe de ventas del período',
        },
        {
          label: 'Número de ventas confirmadas',
          value: data.count,
          note: 'Documentos confirmados',
        },
        {
          label: 'Unidades vendidas',
          value: data.units,
          note: 'Ventas confirmadas, sin descontar devoluciones',
        },
        {
          label: 'Existencias actuales',
          value: data.stock,
          note: 'Unidades registradas en inventario',
        },
      ]}
    />
    <CRow className="g-4 mb-4">
      <CCol xl={8}>
        <ChartPanel
          title="Ventas por día"
          description="Importe en córdobas de ventas CONFIRMADAS. Solo se muestran días con ventas confirmadas."
          labels={data.daily.map((r) => r.fecha)}
          values={data.daily.map((r) => r.total)}
          money
        />
      </CCol>
      <CCol xl={4}>
        <ChartPanel
          title="Ventas por estado"
          description="Número de documentos en cada estado dentro del período."
          labels={data.states.map((r) => r.estado)}
          values={data.states.map((r) => r.cantidad)}
          doughnut
        />
      </CCol>
      <CCol xs={12}>
        <ChartPanel
          title="Productos más vendidos"
          description="Hasta 10 productos por cantidad en ventas confirmadas. Cantidades brutas, sin descontar devoluciones."
          labels={data.products.map((r) => `${r.sku} · ${r.producto}`)}
          values={data.products.map((r) => Number(r.cantidad))}
        />
      </CCol>
    </CRow>
  </>
)
DashboardResults.propTypes = {
  data: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  branches: PropTypes.array.isRequired,
}
export default DashboardResults
