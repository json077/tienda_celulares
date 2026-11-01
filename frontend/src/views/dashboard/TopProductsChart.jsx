import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody } from '@coreui/react'
import { CChartBar } from '@coreui/react-chartjs'
import { useChartAppearance } from './chartAppearance'
import { topProductsChart } from './topProductsChartConfig'

const TopProductsChart = ({ products }) => {
  const appearance = useChartAppearance()
  const chart = topProductsChart(products, appearance.animation, appearance)
  return (
    <CCard className="management-panel dashboard-chart-panel h-100">
      <CCardBody>
        <h2 className="h6 mb-2">Productos más vendidos</h2>
        <p className="small text-body-secondary mb-3">
          Top 10 · Unidades confirmadas, sin restar devoluciones.
        </p>
        {products.length === 0 ? (
          <div className="management-empty">
            No hay resultados para los filtros y sucursales autorizadas.
          </div>
        ) : (
          <>
            <div
              style={{ height: 300, backgroundColor: 'var(--tc-chart-surface)', borderRadius: 8 }}
            >
              <CChartBar
                wrapper={false}
                role="img"
                aria-label="Productos más vendidos: unidades vendidas por producto en orden de ranking. Datos completos en la tabla siguiente."
                {...chart}
              />
            </div>
            <details className="mt-3">
              <summary className="small text-primary">Ver datos del gráfico</summary>
              <div className="table-responsive">
                <table className="table table-sm management-table mt-2">
                  <caption className="visually-hidden">Productos más vendidos por ranking</caption>
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">SKU</th>
                      <th scope="col">Unidades vendidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr key={`${product.sku}-${index}`}>
                        <td>{product.producto}</td>
                        <td>{product.sku}</td>
                        <td>{Number(product.cantidad)}</td>
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

TopProductsChart.propTypes = {
  products: PropTypes.arrayOf(
    PropTypes.shape({
      producto: PropTypes.string.isRequired,
      sku: PropTypes.string.isRequired,
      cantidad: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    }),
  ).isRequired,
}

export default TopProductsChart
