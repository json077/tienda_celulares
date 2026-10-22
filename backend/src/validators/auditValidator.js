const { query, param, validationResult } = require('express-validator');
const { normalizarId, fechaValida } = require('../services/auditService');

const validarListado = [
  ...['id_usuario', 'id_sucursal', 'id_entidad'].map(campo =>
    query(campo).optional().custom(valor => normalizarId(valor, true))
      .withMessage(`${campo} debe ser un entero positivo válido`)),
  ...['modulo', 'accion', 'entidad'].map(campo =>
    query(campo).optional().isString().bail().matches(/^[A-Za-z][A-Za-z0-9_]{0,79}$/)
      .withMessage(`${campo} admite hasta 80 caracteres alfanuméricos y guion bajo`)),
  ...['fecha_desde', 'fecha_hasta'].map(campo =>
    query(campo).optional().custom(fechaValida)
      .withMessage(`${campo} debe ser una fecha YYYY-MM-DD válida`)),
  query('pagina').optional().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER })
    .withMessage('pagina debe ser un entero positivo'),
  query('limite').optional().isInt({ min: 1, max: 100 })
    .withMessage('limite debe estar entre 1 y 100')
];

const validarIdAuditoria = [
  param('idAuditoria').custom(valor => normalizarId(valor, true))
    .withMessage('El ID de auditoría debe ser un entero positivo válido')
];

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      ok: false, message: 'Datos de entrada inválidos', errores: errores.array()
    });
  }
  return next();
}

module.exports = { validarListado, validarIdAuditoria, manejarErroresValidacion };
