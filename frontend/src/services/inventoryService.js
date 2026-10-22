import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })

export const inventoryService = {
  stock: (signal) => api.get('/inventario', options(signal)),
  units: (signal) => api.get('/unidades', options(signal)),
  movements: (signal) => api.get('/inventario/movimientos', options(signal)),
  adjust: (row, values) =>
    api.post(
      '/inventario/ajustes',
      {
        id_sucursal: Number(row.id_sucursal),
        id_producto: Number(row.id_producto),
        tipo: values.tipo,
        cantidad: Number(values.cantidad),
        observacion: values.observacion.trim(),
      },
      options(),
    ),
  setMinimum: (row, minimum) =>
    api.put(
      `/inventario/${row.id_sucursal}/${row.id_producto}/stock-minimo`,
      { stock_minimo: Number(minimum) },
      options(),
    ),
}
