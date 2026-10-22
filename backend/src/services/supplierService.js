const supplierRepository = require('../repositories/supplierRepository');

async function listarProveedores() {
  return supplierRepository.obtenerTodos();
}

async function obtenerProveedor(idProveedor) {
  const proveedor = await supplierRepository.obtenerPorId(idProveedor);

  if (!proveedor) {
    throw crearError('El proveedor no existe', 404);
  }

  return proveedor;
}

async function crearProveedor(datos) {
  const datosLimpios = prepararDatos(datos);

  if (datosLimpios.identificacion) {
    const existente = await supplierRepository.obtenerPorIdentificacion(
      datosLimpios.identificacion
    );

    if (existente) {
      throw crearError(
        `Ya existe un proveedor con la identificación ${datosLimpios.identificacion}`,
        409
      );
    }
  }

  try {
    const idProveedor = await supplierRepository.crear(datosLimpios);

    return supplierRepository.obtenerPorId(idProveedor);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'Ya existe un proveedor con esa identificación',
        409
      );
    }

    throw error;
  }
}

async function actualizarProveedor(idProveedor, datos) {
  const proveedorActual = await supplierRepository.obtenerPorId(idProveedor);

  if (!proveedorActual) {
    throw crearError('El proveedor no existe', 404);
  }

  const datosLimpios = prepararDatos(datos);

  if (datosLimpios.identificacion) {
    const existente = await supplierRepository.obtenerPorIdentificacion(
      datosLimpios.identificacion
    );

    if (
      existente &&
      Number(existente.id_proveedor) !== Number(idProveedor)
    ) {
      throw crearError(
        `Ya existe otro proveedor con la identificación ${datosLimpios.identificacion}`,
        409
      );
    }
  }

  try {
    await supplierRepository.actualizar(idProveedor, datosLimpios);

    return supplierRepository.obtenerPorId(idProveedor);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'Ya existe otro proveedor con esa identificación',
        409
      );
    }

    throw error;
  }
}

async function desactivarProveedor(idProveedor) {
  const proveedor = await supplierRepository.obtenerPorId(idProveedor);

  if (!proveedor) {
    throw crearError('El proveedor no existe', 404);
  }

  if (!proveedor.activo) {
    throw crearError('El proveedor ya se encuentra inactivo', 400);
  }

  await supplierRepository.desactivar(idProveedor);

  return {
    id_proveedor: Number(idProveedor),
    mensaje: 'Proveedor desactivado correctamente'
  };
}

function prepararDatos(datos) {
  return {
    tipo_identificacion: limpiarTexto(datos.tipo_identificacion),
    identificacion: limpiarTexto(datos.identificacion),
    nombre: limpiarTexto(datos.nombre),
    telefono: limpiarTexto(datos.telefono),
    email: limpiarTexto(datos.email),
    direccion: limpiarTexto(datos.direccion),
    activo:
      datos.activo === undefined || datos.activo === null
        ? true
        : Boolean(datos.activo)
  };
}

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();

  return texto === '' ? null : texto;
}

function crearError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  listarProveedores,
  obtenerProveedor,
  crearProveedor,
  actualizarProveedor,
  desactivarProveedor
};
