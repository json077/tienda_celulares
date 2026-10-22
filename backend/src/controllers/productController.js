const productService = require('../services/productService');

async function listar(req, res) {
  try {
    const productos = await productService.listarProductos();

    return res.status(200).json({
      ok: true,
      data: productos
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtener(req, res) {
  try {
    const producto = await productService.obtenerProducto(req.params.id);

    return res.status(200).json({
      ok: true,
      data: producto
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const producto = await productService.crearProducto(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Producto creado correctamente',
      data: producto
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const producto = await productService.actualizarProducto(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Producto actualizado correctamente',
      data: producto
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function desactivar(req, res) {
  try {
    const resultado = await productService.desactivarProducto(
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