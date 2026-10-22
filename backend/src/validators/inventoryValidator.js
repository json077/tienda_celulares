const { body, param, validationResult } = require('express-validator');

const validarAjuste = [
  body('id_sucursal')
    .isInt({ min: 1 })
    .withMessage('La sucursal es obligatoria'),

  body('id_producto')
    .isInt({ min: 1 })
    .withMessage('El producto es obligatorio'),

  body('tipo')
    .isIn(['ENTRADA', 'SALIDA'])
    .withMessage('El tipo debe ser ENTRADA o SALIDA'),

  body('cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser mayor que cero'),

  body('observacion')
    .trim()
    .notEmpty()
    .withMessage('La observación es obligatoria')
    .isLength({ max: 500 })
    .withMessage('La observación no puede superar 500 caracteres')
];

const validarStockMinimo = [
  param('idSucursal')
    .isInt({ min: 1 })
    .withMessage('Sucursal inválida'),

  param('idProducto')
    .isInt({ min: 1 })
    .withMessage('Producto inválido'),

  body('stock_minimo')
    .isInt({ min: 0 })
    .withMessage('El stock mínimo debe ser cero o mayor')
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
  validarAjuste,
  validarStockMinimo,
  manejarErroresValidacion
};