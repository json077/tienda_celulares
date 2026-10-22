import { api, TOKEN_KEY } from './api'

const options = (signal) => ({ token: localStorage.getItem(TOKEN_KEY), signal })

// PUT requiere el producto completo. No enviar IDs propios ni nombres de relaciones.
export const productPayload = (product, includeStatus = false) => ({
  id_categoria: Number(product.id_categoria),
  id_marca: product.id_marca === '' || product.id_marca == null ? null : Number(product.id_marca),
  sku: product.sku.trim().toUpperCase(),
  nombre: product.nombre.trim(),
  descripcion: product.descripcion?.trim() || null,
  tipo_control: product.tipo_control,
  precio_venta: Number(product.precio_venta),
  permite_descuento: Number(product.permite_descuento) === 1,
  porcentaje_descuento_maximo:
    Number(product.permite_descuento) === 1 ? Number(product.porcentaje_descuento_maximo || 0) : 0,
  dias_garantia: Number(product.dias_garantia || 0),
  ...(includeStatus && { activo: Number(product.activo) === 1 }),
})

export { apiErrorMessage as productErrorMessage } from './api'

export const productService = {
  list: (signal) => api.get('/productos', options(signal)),
  get: (id, signal) => api.get(`/productos/${id}`, options(signal)),
  create: (product) => api.post('/productos', productPayload(product), options()),
  update: (id, product) => api.put(`/productos/${id}`, productPayload(product, true), options()),
  deactivate: (id) => api.delete(`/productos/${id}`, options()),
  categories: (signal) => api.get('/categorias', options(signal)),
  brands: (signal) => api.get('/marcas', options(signal)),
}
