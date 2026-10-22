const { body, param, validationResult } = require('express-validator');

const validarIdMarca = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID de la marca debe ser un entero positivo')
];

const validarCrearMarca = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),

  body('descripcion')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('La descripción no puede superar 255 caracteres')
];

const validarActualizarMarca = [
  ...validarIdMarca,

  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),

  body('descripcion')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('La descripción no puede superar 255 caracteres'),

  body('activo')
    .isBoolean()
    .withMessage('El campo activo debe ser verdadero o falso')
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
  validarIdMarca,
  validarCrearMarca,
  validarActualizarMarca,
  manejarErroresValidacion
};