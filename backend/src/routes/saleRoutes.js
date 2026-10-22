const express = require('express');

const saleController = require('../controllers/saleController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarCrearVenta,
  validarIdVenta,
  manejarErroresValidacion
} = require('../validators/saleValidator');

const router = express.Router();

// Todas las rutas de ventas requieren autenticación.
router.use(verificarToken);

// ============================================================
// LISTAR VENTAS
// GET /api/ventas
// ============================================================

router.get(
  '/',
  verificarPermiso('VENTA_VER'),
  saleController.listar
);

// ============================================================
// CREAR VENTA
// POST /api/ventas
// ============================================================

router.post(
  '/',
  verificarPermiso('VENTA_CREAR'),
  validarCrearVenta,
  manejarErroresValidacion,
  saleController.crear
);

// ============================================================
// CONFIRMAR VENTA
// POST /api/ventas/:idVenta/confirmar
// ============================================================

router.post(
  '/:idVenta/confirmar',
  verificarPermiso('VENTA_CONFIRMAR'),
  validarIdVenta,
  manejarErroresValidacion,
  saleController.confirmar
);

// ============================================================
// ANULAR VENTA
// POST /api/ventas/:idVenta/anular
// ============================================================

router.post(
  '/:idVenta/anular',
  verificarPermiso('VENTA_ANULAR'),
  validarIdVenta,
  manejarErroresValidacion,
  saleController.anular
);

// ============================================================
// OBTENER FACTURA
// GET /api/ventas/:idVenta/factura
// ============================================================

router.get(
  '/:idVenta/factura',
  verificarPermiso('FACTURA_IMPRIMIR'),
  validarIdVenta,
  manejarErroresValidacion,
  saleController.obtenerFactura
);

// ============================================================
// OBTENER VENTA POR ID
// GET /api/ventas/:idVenta
// ============================================================

router.get(
  '/:idVenta',
  verificarPermiso('VENTA_VER'),
  validarIdVenta,
  manejarErroresValidacion,
  saleController.obtenerPorId
);

module.exports = router;