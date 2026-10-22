const purchaseService = require('../services/purchaseService');

async function listar(req, res) {
  try {
    const compras = await purchaseService.listarCompras();

    return res.status(200).json({
      ok: true,
      data: compras
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const compra = await purchaseService.obtenerCompra(
      req.params.idCompra
    );

    return res.status(200).json({
      ok: true,
      data: compra
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const compra = await purchaseService.crearCompra(
      req.body,
      req.usuario.id_usuario
    );

    return res.status(201).json({
      ok: true,
      message: 'Compra registrada como borrador correctamente',
      data: compra
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function confirmar(req, res) {
  try {
    const compra = await purchaseService.confirmarCompra(
      req.params.idCompra,
      req.usuario.id_usuario,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Compra confirmada correctamente',
      data: compra
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function anular(req, res) {
  try {
    const compra = await purchaseService.anularCompra(
      req.params.idCompra
    );

    return res.status(200).json({
      ok: true,
      message: 'Compra anulada correctamente',
      data: compra
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
  obtenerPorId,
  crear,
  confirmar,
  anular
};