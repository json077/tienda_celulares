const categoryRepository = require('../repositories/categoryRepository');

async function listarCategorias() {
  return categoryRepository.obtenerTodas();
}

async function obtenerCategoria(idCategoria) {
  const categoria = await categoryRepository.obtenerPorId(idCategoria);

  if (!categoria) {
    const error = new Error('Categoría no encontrada');
    error.status = 404;
    throw error;
  }

  return categoria;
}

async function crearCategoria(datos) {
  const nombre = datos.nombre.trim();
  const descripcion = datos.descripcion
    ? datos.descripcion.trim()
    : null;

  const existente = await categoryRepository.obtenerPorNombre(nombre);

  if (existente) {
    const error = new Error('Ya existe una categoría con ese nombre');
    error.status = 409;
    throw error;
  }

  const idCategoria = await categoryRepository.crear({
    nombre,
    descripcion
  });

  return categoryRepository.obtenerPorId(idCategoria);
}

async function actualizarCategoria(idCategoria, datos) {
  const categoria = await categoryRepository.obtenerPorId(idCategoria);

  if (!categoria) {
    const error = new Error('Categoría no encontrada');
    error.status = 404;
    throw error;
  }

  const nombre = datos.nombre.trim();
  const descripcion = datos.descripcion
    ? datos.descripcion.trim()
    : null;

  const existente = await categoryRepository.obtenerPorNombre(nombre);

  if (
    existente &&
    Number(existente.id_categoria) !== Number(idCategoria)
  ) {
    const error = new Error('Ya existe otra categoría con ese nombre');
    error.status = 409;
    throw error;
  }

  await categoryRepository.actualizar(idCategoria, {
    nombre,
    descripcion,
    activo: datos.activo
  });

  return categoryRepository.obtenerPorId(idCategoria);
}

async function desactivarCategoria(idCategoria) {
  const categoria = await categoryRepository.obtenerPorId(idCategoria);

  if (!categoria) {
    const error = new Error('Categoría no encontrada');
    error.status = 404;
    throw error;
  }

  if (!categoria.activo) {
    const error = new Error('La categoría ya está inactiva');
    error.status = 409;
    throw error;
  }

  await categoryRepository.desactivar(idCategoria);

  return {
    id_categoria: Number(idCategoria),
    message: 'Categoría desactivada correctamente'
  };
}

module.exports = {
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria
};