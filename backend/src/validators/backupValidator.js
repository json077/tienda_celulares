const { param, body, validationResult } = require('express-validator');
const { validarId } = require('../services/backupService');

const validarIdRespaldo = [param('idRespaldo').custom((id) => { validarId(id); return true; })];
const validarSinDatos = [body().custom((datos) => {
  if (datos !== undefined && (datos === null || typeof datos !== 'object' ||
      Array.isArray(datos) || Object.keys(datos).length)) {
    throw new Error('Esta operacion no acepta datos en el cuerpo');
  }
  return true;
})];

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    // No reflejar valores del cliente: pueden contener secretos.
    return res.status(400).json({ ok: false, message: 'Datos invalidos',
      errores: errores.array().map(({ msg, path, location }) => ({ msg, path, location })) });
  }
  next();
}

module.exports = { validarIdRespaldo, validarSinDatos, manejarErroresValidacion };
