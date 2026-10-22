const { body, param, validationResult } = require('express-validator');

const validarCrearCliente = [
  body('tipo_identificacion')
    .trim()
    .notEmpty()
    .withMessage('El tipo de identificación es obligatorio')
    .isLength({ max: 30 })
    .withMessage('El tipo de identificación no puede superar 30 caracteres'),

  body('identificacion')
    .trim()
    .notEmpty()
    .withMessage('La identificación es obligatoria')
    .isLength({ max: 50 })
    .withMessage('La identificación no puede superar 50 caracteres'),

  body('nombres')
    .trim()
    .notEmpty()
    .withMessage('Los nombres son obligatorios')
    .isLength({ max: 100 })
    .withMessage('Los nombres no pueden superar 100 caracteres'),

  body('apellidos')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Los apellidos no pueden superar 100 caracteres'),

  body('telefono')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('El teléfono no puede superar 30 caracteres'),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('El correo electrónico no es válido')
    .isLength({ max: 150 })
    .withMessage('El correo electrónico no puede superar 150 caracteres'),

  body('direccion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('La dirección no puede superar 255 caracteres'),

  body('activo')
    .optional()
    .isBoolean()
    .withMessage('El campo activo debe ser verdadero o falso')
];

const validarActualizarCliente = [
  body('tipo_identificacion')
    .trim()
    .notEmpty()
    .withMessage('El tipo de identificación es obligatorio')
    .isLength({ max: 30 })
    .withMessage('El tipo de identificación no puede superar 30 caracteres'),

  body('identificacion')
    .trim()
    .notEmpty()
    .withMessage('La identificación es obligatoria')
    .isLength({ max: 50 })
    .withMessage('La identificación no puede superar 50 caracteres'),

  body('nombres')
    .trim()
    .notEmpty()
    .withMessage('Los nombres son obligatorios')
    .isLength({ max: 100 })
    .withMessage('Los nombres no pueden superar 100 caracteres'),

  body('apellidos')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Los apellidos no pueden superar 100 caracteres'),

  body('telefono')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('El teléfono no puede superar 30 caracteres'),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('El correo electrónico no es válido')
    .isLength({ max: 150 })
    .withMessage('El correo electrónico no puede superar 150 caracteres'),

  body('direccion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('La dirección no puede superar 255 caracteres'),

  body('activo')
    .isBoolean()
    .withMessage('El campo activo es obligatorio y debe ser verdadero o falso')
];

const validarIdCliente = [
  param('idCliente')
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un entero positivo')
];

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

module.exports = {
  validarCrearCliente,
  validarActualizarCliente,
  validarIdCliente,
  manejarErroresValidacion
};