import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody } from '@coreui/react'
import { CChartLine } from '@coreui/react-chartjs'
import { useChartAppearance } from './chartAppearance'
import { dailySalesChart, dailyAmount, dailyDate } from './dailySalesChartConfig'

const DailySalesChart = ({ rows, period }) => {
  const appearance = useChartAppearance()
  const chart = dailySalesChart(rows, period, appearance.animation, appearance)
  return (
    <CCard className="management-panel dashboard-chart-panel h-100">
      <CCardBody>
        <h2 className="h6 mb-2">Ventas por día</h2>
        <p className="small text-body-secondary mb-3">
          Importes en C$ por fecha de venta y estado actual: CONFIRMADA y ANULADA.
        </p>
        {rows.length === 0 ? (
          <div className="management-empty">
            No hay resultados para los filtros y sucursales autorizadas.
          </div>
        ) : (
          <>
            <div
              style={{ height: 300, backgroundColor: 'var(--tc-chart-surface)', borderRadius: 8 }}
            >
              <CChartLine
                wrapper={false}
                role="img"
                aria-label="Ventas por día: importes en córdobas de ventas confirmadas y anuladas. Datos completos en la tabla siguiente."
                {...chart}
              />
            </div>
            <details className="mt-3">
              <summary className="small text-primary">Ver datos del gráfico</summary>
              <div className="table-responsive">
                <table className="table table-sm management-table mt-2">
                  <caption className="visually-hidden">
                    Importes por fecha de venta y estado actual
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">CONFIRMADA (C$)</th>
                      <th scope="col">ANULADA (C$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.data.labels.map((day, index) => (
                      <tr key={day}>
                        <th scope="row">{dailyDate(day)}</th>
                        {chart.data.datasets.map((series) => (
                          <td key={series.label}>{dailyAmount(series.data[index])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}
DailySalesChart.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      fecha: PropTypes.string.isRequired,
      CONFIRMADA: PropTypes.number.isRequired,
      ANULADA: PropTypes.number.isRequired,
    }),
  ).isRequired,
  period: PropTypes.shape({
    desde: PropTypes.string.isRequired,
    hasta: PropTypes.string.isRequired,
  }).isRequired,
}
export default DailySalesChart
