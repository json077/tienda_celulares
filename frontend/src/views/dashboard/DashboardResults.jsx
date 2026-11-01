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
import { useChartAppearance } from './chartAppearance'
import TopProductsChart from './TopProductsChart'
import DailySalesChart from './DailySalesChart'

const ChartPanel = ({
  title,
  description,
  labels,
  values,
  money = false,
  doughnut = false,
  horizontal = false,
}) => {
  const Chart = doughnut ? CChartDoughnut : CChartBar
  const appearance = useChartAppearance()
  const empty = labels.length === 0 || (doughnut && values.every((v) => v === 0))
  return (
    <CCard className="management-panel dashboard-chart-panel h-100">
      <CCardBody>
        <h2 className="h6 mb-2">{title}</h2>
        <p className="small text-body-secondary mb-3">{description}</p>
        {empty ? (
          <div className="management-empty">
            No hay resultados para los filtros y sucursales autorizadas.
          </div>
        ) : (
          <>
            <div
              className="management-chart"
              style={horizontal ? { height: Math.max(256, labels.length * 40) } : undefined}
            >
              <Chart
                wrapper={false}
                role="img"
                aria-label={title}
                data={{
                  labels,
                  datasets: [
                    {
                      label: money ? 'Ventas confirmadas (C$)' : 'Cantidad',
                      data: values,
                      backgroundColor: doughnut
                        ? [appearance.positive, appearance.warning, appearance.danger]
                        : appearance.action,
                      borderRadius: doughnut ? 0 : 4,
                      ...(appearance.dark && { borderColor: appearance.chartSurface }),
                      ...(!doughnut && {
                        maxBarThickness: horizontal ? 20 : 32,
                        categoryPercentage: 0.72,
                        barPercentage: 0.8,
                      }),
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  animation: appearance.animation,
                  color: appearance.text,
                  plugins: {
                    ...(appearance.dark && {
                      tooltip: {
                        backgroundColor: appearance.chartSurface,
                        titleColor: appearance.chartText,
                        bodyColor: appearance.chartMuted,
                        borderColor: appearance.chartBorder,
                        borderWidth: 1,
                      },
                    }),
                    legend: {
                      display: doughnut,
                      position: 'bottom',
                      labels: {
                        color: appearance.text,
                        padding: 16,
                        usePointStyle: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        font: { size: 12 },
                      },
                    },
                  },
                  ...(doughnut
                    ? { cutout: '64%', radius: '94%' }
                    : {
                        indexAxis: horizontal ? 'y' : 'x',
                        scales: {
                          x: horizontal
                            ? {
                                beginAtZero: true,
                                ticks: { precision: 0, color: appearance.muted },
                                grid: { color: appearance.grid },
                              }
                            : {
                                ticks: {
                                  color: appearance.muted,
                                  maxRotation: 0,
                                  maxTicksLimit: 8,
                                  callback(value) {
                                    return String(this.getLabelForValue(value)).slice(5)
                                  },
                                },
                                grid: { display: false },
                              },
                          y: horizontal
                            ? {
                                ticks: {
                                  color: appearance.muted,
                                  autoSkip: false,
                                  font: { size: 11 },
                                  callback(value) {
                                    const label = String(this.getLabelForValue(value))
                                    const limit = this.chart.width < 480 ? 22 : 48
                                    if (label.length <= limit) return label
                                    const split = label.lastIndexOf(' ', limit)
                                    const end = split > 0 ? split : limit
                                    const rest = label.slice(end).trim()
                                    return [
                                      label.slice(0, end),
                                      rest.length > limit ? rest.slice(0, limit - 1) + '…' : rest,
                                    ]
                                  },
                                },
                                afterFit(scale) {
                                  scale.width = Math.min(scale.width, scale.chart.width * 0.45)
                                },
                                grid: { display: false },
                              }
                            : {
                                beginAtZero: true,
                                ticks: { color: appearance.muted },
                                grid: { color: appearance.grid },
                              },
                        },
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
  horizontal: PropTypes.bool,
}

const DashboardResults = ({ data, filters, branches }) => (
  <>
    <p className="visually-hidden">
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
          note: 'Importe del mes',
        },
        {
          label: 'Ventas confirmadas (n.º)',
          value: data.count,
          note: 'Documentos confirmados',
        },
        {
          label: 'Unidades vendidas',
          value: data.units,
          note: 'Brutas, sin restar devoluciones',
        },
        {
          label: 'Existencias actuales',
          value: data.stock,
          note: 'Unidades en inventario',
        },
      ]}
    />
    <CRow className="g-4 mb-4">
      <CCol lg={8}>
        <DailySalesChart rows={data.monetaryDaily} period={filters} />
      </CCol>
      <CCol lg={4}>
        <ChartPanel
          title="Ventas por estado"
          description="Documentos por estado."
          labels={data.states.map((r) => r.estado)}
          values={data.states.map((r) => r.cantidad)}
          doughnut
        />
      </CCol>
      <CCol xs={12}>
        <TopProductsChart products={data.products} />
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
