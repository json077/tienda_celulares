const { body, param, validationResult } = require('express-validator');

const validarIdProducto = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un entero positivo')
];

const reglasProducto = [
  body('id_categoria')
    .isInt({ min: 1 })
    .withMessage('La categoría es obligatoria'),

  body('id_marca')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('La marca debe ser válida'),

  body('sku')
    .trim()
    .notEmpty()
    .withMessage('El SKU es obligatorio')
    .isLength({ min: 1, max: 50 })
    .withMessage('El SKU no puede superar 50 caracteres'),

  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 160 })
    .withMessage('El nombre debe tener entre 2 y 160 caracteres'),

  body('descripcion')
    .optional({ nullable: true })
    .trim(),

  body('tipo_control')
    .isIn(['CANTIDAD', 'SERIALIZADO'])
    .withMessage('El tipo de control debe ser CANTIDAD o SERIALIZADO'),

  body('precio_venta')
    .isFloat({ min: 0 })
    .withMessage('El precio de venta debe ser un número mayor o igual a 0'),

  body('permite_descuento')
    .isBoolean()
    .withMessage('permite_descuento debe ser verdadero o falso'),

  body('porcentaje_descuento_maximo')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento máximo debe estar entre 0 y 100'),

  body('dias_garantia')
    .optional()
    .isInt({ min: 0, max: 65535 })
    .withMessage('Los días de garantía deben ser un entero positivo')
];

const validarCrearProducto = [
  ...reglasProducto
];

const validarActualizarProducto = [
  ...validarIdProducto,
  ...reglasProducto,

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
  validarIdProducto,
  validarCrearProducto,
  validarActualizarProducto,
  manejarErroresValidacion
};