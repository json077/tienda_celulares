const { body, param, validationResult } = require('express-validator');

// ============================================================
// VALIDAR REGISTRO DE PAGO
// ============================================================

const validarRegistrarPago = [
  body('id_venta')
    .notEmpty()
    .withMessage('El ID de la venta es obligatorio')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El ID de la venta debe ser un entero positivo'),

  body('id_moneda')
    .notEmpty()
    .withMessage('El ID de la moneda es obligatorio')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El ID de la moneda debe ser un entero positivo'),

  body('metodo')
    .notEmpty()
    .withMessage('El método de pago es obligatorio')
    .bail()
    .isIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'])
    .withMessage(
      'El método debe ser EFECTIVO, TARJETA o TRANSFERENCIA'
    ),

  body('monto')
    .notEmpty()
    .withMessage('El monto del pago es obligatorio')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('El monto del pago debe ser mayor que cero'),

  body('id_sesion_caja')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage(
      'El ID de la sesión de caja debe ser un entero positivo'
    ),

  body('referencia')
    .optional({ nullable: true })
    .isString()
    .withMessage('La referencia debe ser texto')
    .bail()
    .isLength({ max: 150 })
    .withMessage(
      'La referencia no puede superar los 150 caracteres'
    )
];

// ============================================================
// VALIDAR ID DE VENTA
// ============================================================

const validarIdVenta = [
  param('idVenta')
    .isInt({ min: 1 })
    .withMessage(
      'El ID de la venta debe ser un entero positivo'
    )
];

// ============================================================
// VALIDAR ID DE PAGO
// ============================================================

const validarIdPago = [
  param('idPago')
    .isInt({ min: 1 })
    .withMessage(
      'El ID del pago debe ser un entero positivo'
    )
];

// ============================================================
// MANEJAR ERRORES
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
  validarRegistrarPago,
  validarIdVenta,
  validarIdPago,
  manejarErroresValidacion
};