const brandRepository = require('../repositories/brandRepository');

async function listarMarcas() {
  return brandRepository.obtenerTodas();
}

async function obtenerMarca(idMarca) {
  const marca = await brandRepository.obtenerPorId(idMarca);

  if (!marca) {
    const error = new Error('Marca no encontrada');
    error.status = 404;
    throw error;
  }

  return marca;
}

async function crearMarca(datos) {
  const nombre = datos.nombre.trim();
  const descripcion = datos.descripcion
    ? datos.descripcion.trim()
    : null;

  const existente = await brandRepository.obtenerPorNombre(nombre);

  if (existente) {
    const error = new Error('Ya existe una marca con ese nombre');
    error.status = 409;
    throw error;
  }

  const idMarca = await brandRepository.crear({
    nombre,
    descripcion
  });

  return brandRepository.obtenerPorId(idMarca);
}

async function actualizarMarca(idMarca, datos) {
  const marca = await brandRepository.obtenerPorId(idMarca);

  if (!marca) {
    const error = new Error('Marca no encontrada');
    error.status = 404;
    throw error;
  }

  const nombre = datos.nombre.trim();
  const descripcion = datos.descripcion
    ? datos.descripcion.trim()
    : null;

  const existente = await brandRepository.obtenerPorNombre(nombre);

  if (
    existente &&
    Number(existente.id_marca) !== Number(idMarca)
  ) {
    const error = new Error('Ya existe otra marca con ese nombre');
    error.status = 409;
    throw error;
  }

  await brandRepository.actualizar(idMarca, {
    nombre,
    descripcion,
    activo: datos.activo
  });

  return brandRepository.obtenerPorId(idMarca);
}

async function desactivarMarca(idMarca) {
  const marca = await brandRepository.obtenerPorId(idMarca);

  if (!marca) {
    const error = new Error('Marca no encontrada');
    error.status = 404;
    throw error;
  }

  if (!marca.activo) {
    const error = new Error('La marca ya está inactiva');
    error.status = 409;
    throw error;
  }

  await brandRepository.desactivar(idMarca);

  return {
    id_marca: Number(idMarca),
    message: 'Marca desactivada correctamente'
  };
}

module.exports = {
  listarMarcas,
  obtenerMarca,
  crearMarca,
  actualizarMarca,
  desactivarMarca
};