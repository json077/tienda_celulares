const brandService = require('../services/brandService');

async function listar(req, res) {
  try {
    const marcas = await brandService.listarMarcas();

    return res.status(200).json({
      ok: true,
      data: marcas
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtener(req, res) {
  try {
    const marca = await brandService.obtenerMarca(req.params.id);

    return res.status(200).json({
      ok: true,
      data: marca
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const marca = await brandService.crearMarca(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Marca creada correctamente',
      data: marca
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const marca = await brandService.actualizarMarca(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Marca actualizada correctamente',
      data: marca
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function desactivar(req, res) {
  try {
    const resultado = await brandService.desactivarMarca(req.params.id);

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