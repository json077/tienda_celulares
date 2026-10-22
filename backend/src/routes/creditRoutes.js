const express = require('express');

const creditController =
  require('../controllers/creditController');

const {
  verificarToken
} = require('../middlewares/authMiddleware');

const {
  verificarPermiso
} = require('../middlewares/permissionMiddleware');

const {
  validarCrearCredito,
  validarIdCredito,
  validarPagarCuota,
  manejarErroresValidacion
} = require('../validators/creditValidator');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// ============================================================
// LISTAR CRÉDITOS
// GET /api/creditos
// ============================================================

router.get(
  '/',
  verificarPermiso('CREDITOS_VER'),
  creditController.listar
);

// ============================================================
// CREAR CRÉDITO
// POST /api/creditos
// ============================================================

router.post(
  '/',
  verificarPermiso('CREDITOS_CREAR'),
  validarCrearCredito,
  manejarErroresValidacion,
  creditController.crear
);

// ============================================================
// PAGAR CUOTA
// POST /api/creditos/cuotas/:idCuota/pagar
// ============================================================

router.post(
  '/cuotas/:idCuota/pagar',
  verificarPermiso('CREDITOS_PAGAR'),
  validarPagarCuota,
  manejarErroresValidacion,
  creditController.pagarCuota
);

// ============================================================
// ANULAR CRÉDITO
// POST /api/creditos/:idCredito/anular
// ============================================================

router.post(
  '/:idCredito/anular',
  verificarPermiso('CREDITOS_ANULAR'),
  validarIdCredito,
  manejarErroresValidacion,
  creditController.anular
);

// ============================================================
// OBTENER CRÉDITO
// GET /api/creditos/:idCredito
// ============================================================

router.get(
  '/:idCredito',
  verificarPermiso('CREDITOS_VER'),
  validarIdCredito,
  manejarErroresValidacion,
  creditController.obtener
);

module.exports = router;