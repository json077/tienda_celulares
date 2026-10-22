const {
  body,
  param,
  validationResult
} = require('express-validator');

const validarCrearTransferencia = [
  body('numero_transferencia')
    .trim()
    .notEmpty()
    .withMessage(
      'El número de transferencia es obligatorio'
    )
    .isLength({ max: 50 })
    .withMessage(
      'El número de transferencia no puede superar 50 caracteres'
    ),

  body('id_sucursal_origen')
    .isInt({ min: 1 })
    .withMessage(
      'La sucursal de origen debe ser válida'
    ),

  body('id_sucursal_destino')
    .isInt({ min: 1 })
    .withMessage(
      'La sucursal de destino debe ser válida'
    ),

  body('observacion')
    .optional({
      nullable: true,
      checkFalsy: true
    })
    .trim()
    .isLength({ max: 500 })
    .withMessage(
      'La observación no puede superar 500 caracteres'
    ),

  body('detalles')
    .isArray({ min: 1 })
    .withMessage(
      'Debe incluir al menos un producto'
    ),

  body('detalles.*.id_producto')
    .isInt({ min: 1 })
    .withMessage(
      'Cada producto debe tener un ID válido'
    ),

  body('detalles.*.cantidad')
    .optional()
    .isInt({ min: 1 })
    .withMessage(
      'La cantidad debe ser un entero mayor que cero'
    ),

  body('detalles.*.unidades')
    .optional()
    .isArray({ min: 1 })
    .withMessage(
      'Las unidades deben enviarse como un arreglo'
    ),

  body('detalles.*.unidades.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage(
      'Cada unidad debe tener un ID válido'
    )
];

const validarIdTransferencia = [
  param('id')
    .isInt({ min: 1 })
    .withMessage(
      'El ID de la transferencia debe ser válido'
    )
];

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);

  if (!errores.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: 'Error de validación',
      errors: errores.array()
    });
  }

  next();
}

module.exports = {
  validarCrearTransferencia,
  validarIdTransferencia,
  manejarErroresValidacion
};