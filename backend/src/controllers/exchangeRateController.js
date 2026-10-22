const exchangeRateService = require(
  '../services/exchangeRateService'
);

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
// OBTENER ÚLTIMO TIPO DE CAMBIO
// ============================================================

async function obtenerUltimo(req, res) {
  try {
    const idMoneda = Number(req.params.idMoneda);

    const tipoCambio =
      await exchangeRateService.obtenerUltimo(idMoneda);

    return res.status(200).json({
      ok: true,
      data: tipoCambio
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// REGISTRAR TIPO DE CAMBIO
// ============================================================

async function registrar(req, res) {
  try {
    const tipoCambio =
      await exchangeRateService.registrar(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Tipo de cambio registrado correctamente',
      data: tipoCambio
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

module.exports = {
  obtenerUltimo,
  registrar
};