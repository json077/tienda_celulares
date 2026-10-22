const clientRepository = require('../repositories/clientRepository');

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

async function listarClientes() {
  return await clientRepository.obtenerTodos();
}

async function obtenerCliente(idCliente) {
  const cliente = await clientRepository.obtenerPorId(idCliente);

  if (!cliente) {
    throw crearError('Cliente no encontrado', 404);
  }

  return cliente;
}

async function crearCliente(datos) {
  const identificacion = limpiarTexto(datos.identificacion);

  const existente =
    await clientRepository.obtenerPorIdentificacion(identificacion);

  if (existente) {
    throw crearError(
      'Ya existe un cliente con esa identificación',
      409
    );
  }

  const nuevoCliente = {
    tipo_identificacion: limpiarTexto(datos.tipo_identificacion),
    identificacion,
    nombres: limpiarTexto(datos.nombres),
    apellidos: limpiarTexto(datos.apellidos),
    telefono: limpiarTexto(datos.telefono),
    email: limpiarTexto(datos.email),
    direccion: limpiarTexto(datos.direccion),
    activo: datos.activo === undefined ? 1 : Number(datos.activo)
  };

  try {
    const idCliente = await clientRepository.crear(nuevoCliente);

    return await clientRepository.obtenerPorId(idCliente);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'Ya existe un cliente con esa identificación',
        409
      );
    }

    throw error;
  }
}

async function actualizarCliente(idCliente, datos) {
  const clienteActual =
    await clientRepository.obtenerPorId(idCliente);

  if (!clienteActual) {
    throw crearError('Cliente no encontrado', 404);
  }

  const identificacion = limpiarTexto(datos.identificacion);

  const clienteConIdentificacion =
    await clientRepository.obtenerPorIdentificacion(identificacion);

  if (
    clienteConIdentificacion &&
    Number(clienteConIdentificacion.id_cliente) !== Number(idCliente)
  ) {
    throw crearError(
      'Ya existe otro cliente con esa identificación',
      409
    );
  }

  const clienteActualizado = {
    tipo_identificacion: limpiarTexto(datos.tipo_identificacion),
    identificacion,
    nombres: limpiarTexto(datos.nombres),
    apellidos: limpiarTexto(datos.apellidos),
    telefono: limpiarTexto(datos.telefono),
    email: limpiarTexto(datos.email),
    direccion: limpiarTexto(datos.direccion),
    activo: Number(datos.activo)
  };

  try {
    await clientRepository.actualizar(
      idCliente,
      clienteActualizado
    );

    return await clientRepository.obtenerPorId(idCliente);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'Ya existe otro cliente con esa identificación',
        409
      );
    }

    throw error;
  }
}

async function desactivarCliente(idCliente) {
  const cliente = await clientRepository.obtenerPorId(idCliente);

  if (!cliente) {
    throw crearError('Cliente no encontrado', 404);
  }

  if (!cliente.activo) {
    throw crearError(
      'El cliente ya se encuentra inactivo',
      409
    );
  }

  const filasAfectadas =
    await clientRepository.desactivar(idCliente);

  if (filasAfectadas !== 1) {
    throw crearError(
      'No fue posible desactivar el cliente',
      409
    );
  }

  return await clientRepository.obtenerPorId(idCliente);
}

module.exports = {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  desactivarCliente
};