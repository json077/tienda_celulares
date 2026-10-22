const categoryService = require('../services/categoryService');

async function listar(req, res) {
  try {
    const categorias = await categoryService.listarCategorias();

    return res.status(200).json({
      ok: true,
      data: categorias
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtener(req, res) {
  try {
    const categoria = await categoryService.obtenerCategoria(req.params.id);

    return res.status(200).json({
      ok: true,
      data: categoria
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const categoria = await categoryService.crearCategoria(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Categoría creada correctamente',
      data: categoria
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const categoria = await categoryService.actualizarCategoria(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Categoría actualizada correctamente',
      data: categoria
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function desactivar(req, res) {
  try {
    const resultado = await categoryService.desactivarCategoria(
      req.params.id
    );

    return res.status(200).json({
      ok: true,
      message: resultado.message
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

function manejarError(res, error) {
  console.error(error);

  return res.status(error.status || 500).json({
    ok: false,
    message: error.status
      ? error.message
      : 'Error interno del servidor'
  });
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  desactivar
};