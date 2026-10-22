const { body, param, validationResult } = require('express-validator');

const validarCrearDevolucion = [
  body('numero_devolucion').isString().bail().trim().notEmpty()
    .isLength({ max: 50 }).withMessage('El número de devolución es obligatorio (máximo 50 caracteres)'),
  body('id_venta').isInt({ min: 1 }).withMessage('La venta debe ser un entero positivo'),
  body('motivo').isString().bail().trim().notEmpty()
    .isLength({ max: 500 }).withMessage('El motivo es obligatorio (máximo 500 caracteres)'),
  body('observacion').optional({ nullable: true }).isString().bail().trim()
    .isLength({ max: 500 }).withMessage('La observación no puede superar 500 caracteres'),
  body('detalles').isArray({ min: 1 }).withMessage('Debe indicar al menos un detalle'),
  body('detalles.*').isObject({ strict: true }).withMessage('Cada detalle debe ser un objeto'),
  body('detalles.*.id_detalle_venta').isInt({ min: 1 })
    .withMessage('Cada detalle de venta debe tener un ID válido'),
  body('detalles.*.cantidad').isInt({ min: 1, max: 4294967295 })
    .withMessage('La cantidad debe ser un entero positivo válido'),
  body('detalles.*.id_unidad').optional({ nullable: true }).isInt({ min: 1 })
    .withMessage('La unidad debe tener un ID válido'),
  body('detalles.*.condicion').optional().isString().bail().trim().toUpperCase()
    .isIn(['APTO', 'DEFECTUOSO']).withMessage('La condición debe ser APTO o DEFECTUOSO'),
  body('detalles.*.reintegra_inventario').optional().isBoolean()
    .withMessage('reintegra_inventario debe ser booleano'),
  body('detalles.*.motivo').optional({ nullable: true }).isString().bail().trim()
    .isLength({ max: 500 }).withMessage('El motivo del detalle no puede superar 500 caracteres')
];

const validarIdDevolucion = [
  param('idDevolucion').isInt({ min: 1 })
    .withMessage('El ID de la devolución debe ser un entero positivo')
];

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      ok: false, message: 'Datos de entrada inválidos', errores: errores.array()
    });
  }
  next();
}

module.exports = {
  validarCrearDevolucion, validarIdDevolucion, manejarErroresValidacion
};
