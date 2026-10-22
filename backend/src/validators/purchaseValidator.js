const { body, param, validationResult } = require('express-validator');

const validarCrearCompra = [
  body('id_proveedor')
    .isInt({ min: 1 })
    .withMessage('El proveedor es obligatorio y debe ser válido'),

  body('id_sucursal')
    .isInt({ min: 1 })
    .withMessage('La sucursal es obligatoria y debe ser válida'),

  body('numero_documento')
    .trim()
    .notEmpty()
    .withMessage('El número de documento es obligatorio')
    .isLength({ max: 80 })
    .withMessage('El número de documento no puede superar 80 caracteres'),

  body('observacion')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('La observación no puede superar 500 caracteres'),

  body('detalles')
    .isArray({ min: 1 })
    .withMessage('La compra debe contener al menos un producto'),

  body('detalles.*.id_producto')
    .isInt({ min: 1 })
    .withMessage('Cada detalle debe tener un producto válido'),

  body('detalles.*.cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero mayor que cero'),

  body('detalles.*.costo_unitario')
    .isFloat({ min: 0 })
    .withMessage('El costo unitario debe ser un número mayor o igual a cero'),

  body('detalles.*.descuento')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El descuento debe ser un número mayor o igual a cero'),

  body('detalles.*.impuesto')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El impuesto debe ser un número mayor o igual a cero')
];

const validarIdCompra = [
  param('idCompra')
    .isInt({ min: 1 })
    .withMessage('El ID de la compra no es válido')
];

const validarConfirmarCompra = [
  param('idCompra')
    .isInt({ min: 1 })
    .withMessage('El ID de la compra no es válido'),

  body('unidades')
    .optional()
    .isArray()
    .withMessage('Las unidades deben enviarse como un arreglo'),

  body('unidades.*.id_detalle_compra')
    .if(body('unidades').exists())
    .isInt({ min: 1 })
    .withMessage('Cada unidad debe indicar un detalle de compra válido'),

  body('unidades.*.imei1')
    .if(body('unidades').exists())
    .trim()
    .matches(/^\d{15}$/)
    .withMessage('El IMEI 1 debe contener exactamente 15 dígitos'),

  body('unidades.*.imei2')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\d{15}$/)
    .withMessage('El IMEI 2 debe contener exactamente 15 dígitos'),

  body('unidades.*.numero_serie')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('El número de serie no puede superar 100 caracteres')
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
  validarCrearCompra,
  validarIdCompra,
  validarConfirmarCompra,
  manejarErroresValidacion
};