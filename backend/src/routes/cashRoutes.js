const express = require('express');

const cashController = require('../controllers/cashController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarAbrirCaja,
  validarCerrarCaja,
  validarMovimientoManual,
  validarIdSesionCaja,
  manejarErroresValidacion
} = require('../validators/cashValidator');

const router = express.Router();

// Todas las rutas de caja requieren autenticación.
router.use(verificarToken);

// ============================================================
// LISTAR CAJAS
// GET /api/cajas
// ============================================================

router.get(
  '/',
  verificarPermiso('CAJA_VER'),
  cashController.listarCajas
);

// ============================================================
// ABRIR CAJA
// POST /api/cajas/abrir
// ============================================================

router.post(
  '/abrir',
  verificarPermiso('CAJA_ABRIR'),
  validarAbrirCaja,
  manejarErroresValidacion,
  cashController.abrirCaja
);

// ============================================================
// CERRAR SESIÓN DE CAJA
// POST /api/cajas/sesiones/:idSesionCaja/cerrar
// ============================================================

router.post(
  '/sesiones/:idSesionCaja/cerrar',
  verificarPermiso('CAJA_CERRAR'),
  validarIdSesionCaja,
  validarCerrarCaja,
  manejarErroresValidacion,
  cashController.cerrarCaja
);

// ============================================================
// REGISTRAR MOVIMIENTO MANUAL DE CAJA
// POST /api/cajas/sesiones/:idSesionCaja/movimientos
// ============================================================

router.post(
  '/sesiones/:idSesionCaja/movimientos',
  verificarPermiso('CAJA_MOVIMIENTO'),
  validarIdSesionCaja,
  validarMovimientoManual,
  manejarErroresValidacion,
  cashController.registrarMovimientoManual
);

// ============================================================
// OBTENER SESIÓN DE CAJA
// GET /api/cajas/sesiones/:idSesionCaja
// ============================================================

router.get(
  '/sesiones/:idSesionCaja',
  verificarPermiso('CAJA_VER'),
  validarIdSesionCaja,
  manejarErroresValidacion,
  cashController.obtenerSesion
);

module.exports = router;