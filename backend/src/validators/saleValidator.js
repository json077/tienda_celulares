const { body, param, validationResult } = require('express-validator');

const validarCrearVenta = [
  body('id_cliente')
    .isInt({ min: 1 })
    .withMessage('El cliente es obligatorio y debe ser válido'),

  body('id_sucursal')
    .isInt({ min: 1 })
    .withMessage('La sucursal es obligatoria y debe ser válida'),

  body('numero_venta')
    .trim()
    .notEmpty()
    .withMessage('El número de venta es obligatorio')
    .isLength({ max: 50 })
.withMessage('El número de venta no puede superar 50 caracteres'),
   

  body('tipo_venta')
    .trim()
    .toUpperCase()
    .isIn(['CONTADO', 'CREDITO'])
    .withMessage('El tipo de venta debe ser CONTADO o CREDITO'),

  body('observacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('La observación no puede superar 500 caracteres'),

  body('detalles')
    .isArray({ min: 1 })
    .withMessage('La venta debe contener al menos un producto'),

  body('detalles.*.id_producto')
    .isInt({ min: 1 })
    .withMessage('Cada producto debe tener un ID válido'),

  body('detalles.*.cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un entero mayor que cero'),

  body('detalles.*.descuento')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El descuento debe ser un número mayor o igual a cero'),

  body('detalles.*.impuesto')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El impuesto debe ser un número mayor o igual a cero')
];

const validarIdVenta = [
  param('idVenta')
    .isInt({ min: 1 })
    .withMessage('El ID de la venta debe ser un entero positivo')
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
  validarCrearVenta,
  validarIdVenta,
  manejarErroresValidacion
};