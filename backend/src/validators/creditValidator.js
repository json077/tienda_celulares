const { body, param, validationResult } = require('express-validator');

// ============================================================
// VALIDAR CREACIÓN DE CRÉDITO
// ============================================================

const validarCrearCredito = [
  body('id_venta')
    .isInt({ min: 1 })
    .withMessage('La venta es obligatoria y debe ser válida'),

  body('tasa_interes')
    .isFloat({ min: 0, max: 100 })
    .withMessage('La tasa de interés debe estar entre 0 y 100'),

  body('numero_cuotas')
    .isInt({ min: 1, max: 120 })
    .withMessage(
      'El número de cuotas debe estar entre 1 y 120'
    ),

  body('frecuencia')
    .trim()
    .toUpperCase()
    .isIn(['SEMANAL', 'QUINCENAL', 'MENSUAL'])
    .withMessage(
      'La frecuencia debe ser SEMANAL, QUINCENAL o MENSUAL'
    ),

  body('fecha_inicio')
    .isISO8601({ strict: true })
    .withMessage(
      'La fecha de inicio debe tener formato YYYY-MM-DD'
    ),

  body('observacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage(
      'La observación no puede superar 500 caracteres'
    )
];

// ============================================================
// VALIDAR ID DE CRÉDITO
// ============================================================

const validarIdCredito = [
  param('idCredito')
    .isInt({ min: 1 })
    .withMessage(
      'El ID del crédito debe ser un entero positivo'
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
      errores: errores.array()
    });
  }

  next();
}

const validarPagarCuota = [
  param('idCuota')
    .isInt({ min: 1 })
    .withMessage('El ID de la cuota debe ser un entero positivo'),

  body('id_moneda')
    .isInt({ min: 1 })
    .withMessage('La moneda es obligatoria y debe ser válida'),

  body('metodo')
    .trim()
    .toUpperCase()
    .isIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
    .withMessage(
      'El método debe ser EFECTIVO, TRANSFERENCIA o TARJETA'
    ),

  body('monto')
    .isFloat({ gt: 0 })
    .withMessage('El monto debe ser mayor que cero'),

  body('id_sesion_caja')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('La sesión de caja debe ser válida'),

  body('referencia')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('La referencia no puede superar 100 caracteres')
];

module.exports = {
  validarCrearCredito,
  validarIdCredito,
  validarPagarCuota,
  manejarErroresValidacion
};