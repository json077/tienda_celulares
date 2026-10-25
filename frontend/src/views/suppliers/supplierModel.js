export const normalizeSupplier = (supplier, expectedId) => {
  const id = Number(supplier?.id_proveedor)
  if (
    !supplier ||
    !Number.isInteger(id) ||
    id < 1 ||
    (expectedId !== undefined && id !== Number(expectedId)) ||
    supplier.activo == null ||
    supplier.activo === '' ||
    ![0, 1].includes(Number(supplier.activo)) ||
    typeof supplier.nombre !== 'string' ||
    !supplier.nombre.trim() ||
    ['tipo_identificacion', 'identificacion', 'telefono', 'email', 'direccion'].some(
      (key) => supplier[key] != null && typeof supplier[key] !== 'string',
    )
  )
    throw new Error('El servidor devolvió un proveedor inválido. Actualiza el listado.')
  return { ...supplier, id_proveedor: id, activo: Number(supplier.activo) }
}

export const supplierList = (response) => {
  if (!Array.isArray(response?.data))
    throw new Error('El servidor devolvió un listado de proveedores inválido.')
  return response.data.map((supplier) => normalizeSupplier(supplier))
}

export const filterSuppliers = (suppliers, search = '', status = '') => {
  const query = search.trim().toLocaleLowerCase('es')
  return suppliers.filter(
    (supplier) =>
      (status === '' || String(Number(supplier.activo)) === status) &&
      ['nombre', 'tipo_identificacion', 'identificacion', 'telefono', 'email', 'direccion'].some(
        (key) =>
          String(supplier[key] ?? '')
            .toLocaleLowerCase('es')
            .includes(query),
      ),
  )
}

export const validateSupplier = (values) => {
  for (const [key, label, max, required] of [
    ['nombre', 'Nombre del proveedor', 160, true],
    ['tipo_identificacion', 'Tipo de identificación', 30],
    ['identificacion', 'Identificación', 50],
    ['telefono', 'Teléfono', 30],
    ['email', 'Correo electrónico', 150],
    ['direccion', 'Dirección', 255],
  ]) {
    const value = String(values[key] ?? '').trim()
    if (required && !value) return `El campo «${label}» es obligatorio.`
    if (value.length > max) return `El campo «${label}» no puede superar ${max} caracteres.`
  }
  const email = String(values.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    return 'El correo electrónico no es válido.'
  return ''
}
