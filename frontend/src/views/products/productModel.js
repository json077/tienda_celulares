export const filterProducts = (
  products,
  { search = '', category = '', brand = '', status = '', control = '' } = {},
) => {
  const query = search.trim().toLocaleLowerCase('es')
  return products.filter(
    (p) =>
      [p.nombre, p.sku].some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('es')
          .includes(query),
      ) &&
      (!category || String(p.id_categoria) === category) &&
      (!brand || (brand === 'none' ? p.id_marca == null : String(p.id_marca) === brand)) &&
      (status === '' || String(Number(p.activo)) === status) &&
      (!control || p.tipo_control === control),
  )
}

export const validateProduct = (values, categories, brands) => {
  if (!values.sku.trim() || values.sku.trim().length > 50)
    return 'El SKU es obligatorio y admite hasta 50 caracteres.'
  if (values.nombre.trim().length < 2 || values.nombre.trim().length > 160)
    return 'El nombre debe tener entre 2 y 160 caracteres.'
  if (
    !categories.some(
      (c) => Number(c.activo) === 1 && String(c.id_categoria) === String(values.id_categoria),
    )
  )
    return 'Selecciona una categoría activa.'
  if (
    values.id_marca !== '' &&
    values.id_marca != null &&
    !brands.some((b) => Number(b.activo) === 1 && String(b.id_marca) === String(values.id_marca))
  )
    return 'Selecciona una marca activa o sin marca.'
  if (!['CANTIDAD', 'SERIALIZADO'].includes(values.tipo_control))
    return 'Selecciona un tipo de control válido.'
  if (
    String(values.precio_venta).trim() === '' ||
    !Number.isFinite(Number(values.precio_venta)) ||
    Number(values.precio_venta) < 0
  )
    return 'El precio debe ser un número mayor o igual a cero.'
  const discount = Number(values.porcentaje_descuento_maximo || 0)
  if (values.permite_descuento && (!Number.isFinite(discount) || discount < 0 || discount > 100))
    return 'El descuento máximo debe estar entre 0 y 100.'
  const warranty = Number(values.dias_garantia || 0)
  if (!Number.isInteger(warranty) || warranty < 0 || warranty > 65535)
    return 'La garantía debe ser un entero entre 0 y 65535 días.'
  return ''
}
