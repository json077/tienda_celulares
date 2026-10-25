export const clientName = (client) => [client.nombres, client.apellidos].filter(Boolean).join(' ')

export const normalizeClient = (client, expectedId) => {
  const id = Number(client?.id_cliente)
  if (
    !client ||
    !Number.isInteger(id) ||
    id < 1 ||
    (expectedId !== undefined && id !== Number(expectedId)) ||
    ![0, 1].includes(Number(client.activo)) ||
    client.activo == null ||
    client.activo === '' ||
    ['tipo_identificacion', 'identificacion', 'nombres'].some(
      (key) => typeof client[key] !== 'string' || !client[key].trim(),
    ) ||
    ['apellidos', 'telefono', 'email', 'direccion'].some(
      (key) => client[key] != null && typeof client[key] !== 'string',
    )
  ) {
    throw new Error('El servidor devolvió un cliente inválido. Actualiza el listado.')
  }
  return { ...client, id_cliente: id, activo: Number(client.activo) }
}

export const clientList = (response) => {
  if (!Array.isArray(response?.data))
    throw new Error('El servidor devolvió un listado de clientes inválido.')
  return response.data.map((client) => normalizeClient(client))
}

export const filterClients = (clients, search = '', status = '') => {
  const query = search.trim().toLocaleLowerCase('es')
  return clients.filter(
    (client) =>
      (status === '' || String(Number(client.activo)) === status) &&
      [
        clientName(client),
        client.tipo_identificacion,
        client.identificacion,
        client.telefono,
        client.email,
        client.direccion,
      ].some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('es')
          .includes(query),
      ),
  )
}

export const validateClient = (values) => {
  for (const [key, label, max, required] of [
    ['tipo_identificacion', 'Tipo de identificación', 30, true],
    ['identificacion', 'Identificación', 50, true],
    ['nombres', 'Nombres', 100, true],
    ['apellidos', 'Apellidos', 100],
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
