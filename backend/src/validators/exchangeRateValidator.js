const { body, param, validationResult } = require('express-validator');

// ============================================================
// VALIDAR REGISTRO DE TIPO DE CAMBIO
// ============================================================

const validarRegistrarTipoCambio = [
  body('id_moneda')
    .notEmpty()
    .withMessage('El ID de la moneda es obligatorio')
    .bail()
    .isInt({ min: 1 })
    .withMessage(
      'El ID de la moneda debe ser un entero positivo'
    ),

  body('tasa')
    .notEmpty()
    .withMessage('La tasa de cambio es obligatoria')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage(
      'La tasa de cambio debe ser mayor que cero'
    )
];

// ============================================================
// VALIDAR ID DE MONEDA
// ============================================================

const validarIdMoneda = [
  param('idMoneda')
    .isInt({ min: 1 })
    .withMessage(
      'El ID de la moneda debe ser un entero positivo'
    )
];

// ============================================================
// MANEJAR ERRORES DE VALIDACIÓN
// ============================================================

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);

  if (!errores.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: 'Datos de entrada inválidos',
      errors: errores.array().map((error) => ({
        campo: error.path,
        mensaje: error.msg
      }))
    });
  }

  next();
}

module.exports = {
  validarRegistrarTipoCambio,
  validarIdMoneda,
  manejarErroresValidacion
};