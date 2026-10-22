const creditService = require('../services/creditService');

function manejarError(res, error) {
  console.error(error);

  return res.status(error.status || 500).json({
    ok: false,
    message: error.message || 'Error interno del servidor'
  });
}

// ============================================================
// LISTAR CRÉDITOS
// ============================================================

async function listar(req, res) {
  try {
    const creditos =
      await creditService.listarCreditos();

    return res.status(200).json({
      ok: true,
      data: creditos
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

// ============================================================
// OBTENER CRÉDITO
// ============================================================

async function obtener(req, res) {
  try {
    const credito =
      await creditService.obtenerCredito(
        req.params.idCredito
      );

    return res.status(200).json({
      ok: true,
      data: credito
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

// ============================================================
// CREAR CRÉDITO
// ============================================================

async function crear(req, res) {
  try {
    const credito =
      await creditService.crearCredito(
        req.body
      );

    return res.status(201).json({
      ok: true,
      message: 'Crédito creado correctamente',
      data: credito
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

// ============================================================
// PAGAR CUOTA
// ============================================================

async function pagarCuota(req, res) {
  try {
    const resultado =
  await creditService.pagarCuota(
    req.params.idCuota,
    req.body,
    req.usuario.id_usuario
  );

    return res.status(201).json({
      ok: true,
      message: 'Pago de cuota registrado correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

// ============================================================
// ANULAR CRÉDITO
// ============================================================

async function anular(req, res) {
  try {
    const credito =
      await creditService.anularCredito(
        req.params.idCredito
      );

    return res.status(200).json({
      ok: true,
      message: 'Crédito anulado correctamente',
      data: credito
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  pagarCuota,
  anular
};