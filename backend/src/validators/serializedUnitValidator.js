const {
  body,
  param,
  validationResult
} = require('express-validator');

const validarRegistroUnidad = [
  body('id_producto')
    .isInt({ min: 1 })
    .withMessage('El producto es obligatorio y debe ser válido'),

  body('id_sucursal')
    .isInt({ min: 1 })
    .withMessage('La sucursal es obligatoria y debe ser válida'),

  body('imei1')
    .trim()
    .notEmpty()
    .withMessage('El IMEI1 es obligatorio')
    .isLength({ min: 1, max: 30 })
    .withMessage('El IMEI1 no puede superar 30 caracteres'),

  body('imei2')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('El IMEI2 no puede superar 30 caracteres'),

  body('numero_serie')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage(
      'El número de serie no puede superar 80 caracteres'
    ),

  body('observacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage(
      'La observación no puede superar 500 caracteres'
    )
];

const validarIdUnidad = [
  param('idUnidad')
    .isInt({ min: 1 })
    .withMessage('El ID de la unidad no es válido')
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
  validarRegistroUnidad,
  validarIdUnidad,
  manejarErroresValidacion
};