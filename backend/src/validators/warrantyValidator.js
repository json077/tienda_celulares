const { body, param, validationResult } = require('express-validator');

const validarIdGarantia = [param('idGarantia').isInt({ min: 1 }).withMessage('Garantía no válida')];
const validarIdReclamo = [param('idReclamo').isInt({ min: 1 }).withMessage('Reclamo no válido')];

const validarCrearGarantia = [
  body('id_venta').isInt({ min: 1 }).withMessage('Venta no válida'),
  body('id_detalle_venta').isInt({ min: 1 }).withMessage('Detalle de venta no válido'),
  body('id_unidad').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Unidad no válida')
];

const validarCrearReclamo = [
  ...validarIdGarantia,
  body('id_garantia').optional().isInt({ min: 1 }).withMessage('Garantía no válida'),
  body('id_sucursal').isInt({ min: 1 }).withMessage('Sucursal no válida'),
  body('numero_reclamo').isString().bail().trim().notEmpty().isLength({ max: 50 })
    .withMessage('El número de reclamo es obligatorio (máximo 50 caracteres)'),
  body('motivo').isString().bail().trim().notEmpty().isLength({ max: 500 })
    .withMessage('El motivo es obligatorio (máximo 500 caracteres)'),
  body('observacion').optional({ nullable: true }).isString().bail().trim().isLength({ max: 500 })
    .withMessage('La observación admite hasta 500 caracteres')
];

const validarResolverReclamo = [
  ...validarIdReclamo,
  body('estado').isString().bail()
    .isIn(['RECIBIDO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'RESUELTO'])
    .withMessage('Estado de reclamo no válido'),
  body('solucion').optional({ nullable: true }).isString().bail()
    .isIn(['REPARACION', 'REEMPLAZO', 'DEVOLUCION', 'SIN_COBERTURA'])
    .withMessage('Solución no válida'),
  body('diagnostico').optional({ nullable: true }).isString().bail().trim().isLength({ max: 1000 })
    .withMessage('El diagnóstico admite hasta 1000 caracteres'),
  body('observacion').optional({ nullable: true }).isString().bail().trim().isLength({ max: 500 })
    .withMessage('La observación admite hasta 500 caracteres')
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
  validarIdGarantia, validarIdReclamo, validarCrearGarantia,
  validarCrearReclamo, validarResolverReclamo, manejarErroresValidacion
};
