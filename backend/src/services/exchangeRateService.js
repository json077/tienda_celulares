const exchangeRateRepository = require(
  '../repositories/exchangeRateRepository'
);

function crearError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// ============================================================
// OBTENER ÚLTIMO TIPO DE CAMBIO
// ============================================================

async function obtenerUltimo(idMoneda) {
  const moneda = await exchangeRateRepository.obtenerMonedaPorId(
    idMoneda
  );

  if (!moneda) {
    throw crearError('La moneda indicada no existe', 404);
  }

  if (!moneda.activo) {
    throw crearError('La moneda indicada se encuentra inactiva', 400);
  }

  // La moneda base NIO siempre tiene equivalencia 1:1.
  if (moneda.codigo === 'NIO') {
    return {
      id_tipo_cambio: null,
      id_moneda: moneda.id_moneda,
      moneda: moneda.codigo,
      nombre_moneda: moneda.nombre,
      simbolo: moneda.simbolo,
      tasa: 1,
      fecha: null,
      activo: 1
    };
  }

  const tipoCambio =
    await exchangeRateRepository.obtenerUltimoPorMoneda(idMoneda);

  if (!tipoCambio) {
    throw crearError(
      `No existe un tipo de cambio activo para ${moneda.codigo}`,
      404
    );
  }

  return tipoCambio;
}

// ============================================================
// REGISTRAR NUEVO TIPO DE CAMBIO
// ============================================================

async function registrar(datos) {
  const idMoneda = Number(datos.id_moneda);
  const tasa = Number(datos.tasa);

  if (!Number.isInteger(idMoneda) || idMoneda <= 0) {
    throw crearError('El ID de la moneda no es válido');
  }

  if (!Number.isFinite(tasa) || tasa <= 0) {
    throw crearError('La tasa debe ser mayor que cero');
  }

  const moneda = await exchangeRateRepository.obtenerMonedaPorId(
    idMoneda
  );

  if (!moneda) {
    throw crearError('La moneda indicada no existe', 404);
  }

  if (!moneda.activo) {
    throw crearError('La moneda indicada se encuentra inactiva');
  }

  // No necesitamos registrar tipos de cambio para la moneda base.
  if (moneda.codigo === 'NIO') {
    throw crearError(
      'No se registra tipo de cambio para NIO porque es la moneda base'
    );
  }

  const idTipoCambio = await exchangeRateRepository.crear({
    id_moneda: idMoneda,
    tasa
  });

  const tipoCambio =
    await exchangeRateRepository.obtenerPorId(idTipoCambio);

  return tipoCambio;
}

module.exports = {
  obtenerUltimo,
  registrar
};