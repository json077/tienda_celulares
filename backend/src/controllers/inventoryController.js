const inventoryService = require('../services/inventoryService');

async function listar(req, res) {
  try {
    const inventario = await inventoryService.listarInventario();

    return res.status(200).json({
      ok: true,
      data: inventario
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function ajustar(req, res) {
  try {
    const resultado = await inventoryService.ajustarStock(
      req.body,
      req.usuario.id_usuario
    );

    return res.status(200).json({
      ok: true,
      message: 'Inventario ajustado correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function stockMinimo(req, res) {
  try {
    const resultado =
      await inventoryService.configurarStockMinimo(
        req.params.idSucursal,
        req.params.idProducto,
        req.body.stock_minimo
      );

    return res.status(200).json({
      ok: true,
      message: 'Stock mínimo actualizado correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(res, error);
  }
}
async function movimientos(req, res) {
  try {
    const data = await inventoryService.listarMovimientos();

    return res.status(200).json({
      ok: true,
      data
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
  ajustar,
  stockMinimo,
  movimientos
};