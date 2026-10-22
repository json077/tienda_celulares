const express = require('express');

const paymentController = require('../controllers/paymentController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarRegistrarPago,
  validarIdVenta,
  validarIdPago,
  manejarErroresValidacion
} = require('../validators/paymentValidator');

const router = express.Router();

// Todas las rutas de pagos requieren autenticación.
router.use(verificarToken);

// ============================================================
// REGISTRAR PAGO
// POST /api/pagos
// ============================================================

router.post(
  '/',
  verificarPermiso('PAGO_REGISTRAR'),
  validarRegistrarPago,
  manejarErroresValidacion,
  paymentController.registrar
);

// ============================================================
// ANULAR PAGO
// POST /api/pagos/:idPago/anular
// ============================================================

router.post(
  '/:idPago/anular',
  verificarPermiso('PAGO_ANULAR'),
  validarIdPago,
  manejarErroresValidacion,
  paymentController.anular
);

// ============================================================
// LISTAR PAGOS DE UNA VENTA
// GET /api/pagos/venta/:idVenta
// ============================================================

router.get(
  '/venta/:idVenta',
  verificarPermiso('PAGO_REGISTRAR'),
  validarIdVenta,
  manejarErroresValidacion,
  paymentController.listarPorVenta
);

module.exports = router;