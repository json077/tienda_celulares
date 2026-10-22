const { body, param, validationResult } = require('express-validator');

// ============================================================
// VALIDAR APERTURA DE CAJA
// ============================================================

const validarAbrirCaja = [
  body('id_caja')
    .notEmpty()
    .withMessage('El ID de la caja es obligatorio')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El ID de la caja debe ser un entero positivo'),

  body('monto_apertura')
    .optional()
    .isFloat({ min: 0 })
    .withMessage(
      'El monto de apertura debe ser un número mayor o igual a cero'
    ),

  body('observacion')
    .optional({ nullable: true })
    .isString()
    .withMessage('La observación debe ser texto')
    .bail()
    .isLength({ max: 500 })
    .withMessage(
      'La observación no puede superar los 500 caracteres'
    )
];

// ============================================================
// VALIDAR CIERRE DE CAJA
// ============================================================

const validarCerrarCaja = [
  body('monto_cierre_real')
    .notEmpty()
    .withMessage('El monto real de cierre es obligatorio')
    .bail()
    .isFloat({ min: 0 })
    .withMessage(
      'El monto real de cierre debe ser un número mayor o igual a cero'
    ),

  body('observacion')
    .optional({ nullable: true })
    .isString()
    .withMessage('La observación debe ser texto')
    .bail()
    .isLength({ max: 500 })
    .withMessage(
      'La observación no puede superar los 500 caracteres'
    )
];

// ============================================================
// VALIDAR MOVIMIENTO MANUAL DE CAJA
// ============================================================

const validarMovimientoManual = [
  body('tipo')
    .notEmpty()
    .withMessage('El tipo de movimiento es obligatorio')
    .bail()
    .isIn(['INGRESO', 'EGRESO'])
    .withMessage(
      'El tipo de movimiento debe ser INGRESO o EGRESO'
    ),

  body('monto')
    .notEmpty()
    .withMessage('El monto es obligatorio')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage(
      'El monto debe ser un número mayor que cero'
    ),

  body('concepto')
    .notEmpty()
    .withMessage('El concepto es obligatorio')
    .bail()
    .isString()
    .withMessage('El concepto debe ser texto')
    .bail()
    .isLength({ min: 1, max: 255 })
    .withMessage(
      'El concepto debe contener entre 1 y 255 caracteres'
    )
];

// ============================================================
// VALIDAR ID DE SESIÓN DE CAJA
// ============================================================

const validarIdSesionCaja = [
  param('idSesionCaja')
    .isInt({ min: 1 })
    .withMessage(
      'El ID de la sesión de caja debe ser un entero positivo'
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
  validarAbrirCaja,
  validarCerrarCaja,
  validarMovimientoManual,
  validarIdSesionCaja,
  manejarErroresValidacion
};