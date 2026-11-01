// Keep API ranking and full product metadata aligned by index, even for duplicate names.
export function topProductsChart(products, animation, appearance = {}) {
  const {
    chartAction = '#2563EB',
    chartSurface = '#FFFFFF',
    chartText = '#0F172A',
    chartMuted = '#475569',
    chartGrid = '#E2E8F0',
    chartBorder = '#CBD5E1',
  } = appearance
  return {
    data: {
      labels: products.map((product) => product.producto),
      datasets: [
        {
          label: 'Unidades vendidas',
          data: products.map((product) => Number(product.cantidad)),
          borderColor: chartAction,
          backgroundColor: chartAction,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 36,
          categoryPercentage: 0.85,
          barPercentage: 0.9,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'x',
      animation,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      layout: { padding: 8 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chartSurface,
          titleColor: chartText,
          bodyColor: chartMuted,
          borderColor: chartBorder,
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => products[items[0]?.dataIndex]?.producto || '',
            label: (context) => [
              `SKU: ${products[context.dataIndex].sku}`,
              `Unidades vendidas: ${context.parsed.y}`,
            ],
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: chartMuted,
            maxRotation: 0,
            autoSkip: true,
            font: { size: 11 },
            callback(value) {
              const label = String(this.getLabelForValue(value))
              const limit = this.chart.width < 480 ? 12 : 22
              return label.length > limit ? `${label.slice(0, limit - 1)}…` : label
            },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          title: { display: true, text: 'Unidades vendidas', color: chartMuted },
          ticks: { precision: 0, color: chartMuted },
          grid: { color: chartGrid, drawTicks: false },
        },
      },
    },
  }
}
