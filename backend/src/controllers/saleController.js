const saleService = require('../services/saleService');

async function listar(req, res) {
  try {
    const ventas = await saleService.listarVentas();

    return res.status(200).json({
      ok: true,
      data: ventas
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const venta = await saleService.obtenerVenta(
      req.params.idVenta
    );

    return res.status(200).json({
      ok: true,
      data: venta
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const venta = await saleService.crearVenta(
      req.body,
      req.usuario.id_usuario
    );

    return res.status(201).json({
      ok: true,
      message: 'Venta creada correctamente',
      data: venta
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function confirmar(req, res) {
  try {
    const venta = await saleService.confirmarVenta(
      req.params.idVenta,
      req.usuario.id_usuario,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Venta confirmada correctamente',
      data: venta
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

// ============================================================
// ANULAR VENTA
// ============================================================

async function anular(req, res) {
  try {
    const venta = await saleService.anularVenta(
      req.params.idVenta,
      req.usuario.id_usuario
    );

    return res.status(200).json({
      ok: true,
      message: 'Venta anulada correctamente',
      data: venta
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerFactura(req, res) {
  try {
    const factura =
      await saleService.obtenerFactura(
        req.params.idVenta
      );

    return res.status(200).json({
      ok: true,
      data: factura
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

function manejarError(res, error) {
  console.error(error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    ok: false,
    message:
      statusCode === 500
        ? 'Error interno del servidor'
        : error.message
  });
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  confirmar,
  anular,
  obtenerFactura
};