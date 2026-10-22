const { body, param, validationResult } = require('express-validator');

const validarCrearProveedor = [
  body('tipo_identificacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('El tipo de identificación no puede superar 30 caracteres'),

  body('identificacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('La identificación no puede superar 50 caracteres'),

  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre del proveedor es obligatorio')
    .isLength({ max: 160 })
    .withMessage('El nombre no puede superar 160 caracteres'),

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
    .withMessage('La dirección no puede superar 255 caracteres')
];

const validarActualizarProveedor = [
  body('tipo_identificacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage('El tipo de identificación no puede superar 30 caracteres'),

  body('identificacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('La identificación no puede superar 50 caracteres'),

  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre del proveedor es obligatorio')
    .isLength({ max: 160 })
    .withMessage('El nombre no puede superar 160 caracteres'),

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

const validarIdProveedor = [
  param('idProveedor')
    .isInt({ min: 1 })
    .withMessage('El ID del proveedor no es válido')
];

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);

  if (!errores.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: 'Datos inválidos',
      errores: errores.array()
    });
  }

  next();
}

module.exports = {
  validarCrearProveedor,
  validarActualizarProveedor,
  validarIdProveedor,
  manejarErroresValidacion
};