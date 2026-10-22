const paymentService = require('../services/paymentService');

// ============================================================
// MANEJO CENTRAL DE ERRORES
// ============================================================

function manejarError(error, res) {
  console.error(error);

  const status = error.status || 500;

  return res.status(status).json({
    ok: false,
    message:
      status === 500
        ? 'Ocurrió un error interno en el servidor'
        : error.message
  });
}

// ============================================================
// REGISTRAR PAGO
// ============================================================

async function registrar(req, res) {
  try {
    const idUsuario = req.usuario.id_usuario;

    const resultado = await paymentService.registrarPago(
      req.body,
      idUsuario
    );

    return res.status(201).json({
      ok: true,
      message: 'Pago registrado correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// LISTAR PAGOS DE UNA VENTA
// ============================================================

async function listarPorVenta(req, res) {
  try {
    const idVenta = Number(req.params.idVenta);

    const pagos = await paymentService.listarPagosVenta(
      idVenta
    );

    return res.status(200).json({
      ok: true,
      data: pagos
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// ANULAR PAGO
// ============================================================

async function anular(req, res) {
  try {
    const idPago = Number(req.params.idPago);
    const idUsuario = req.usuario.id_usuario;

    const resultado = await paymentService.anularPago(
      idPago,
      idUsuario
    );

    return res.status(200).json({
      ok: true,
      message: 'Pago anulado correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

module.exports = {
  registrar,
  listarPorVenta,
  anular
};