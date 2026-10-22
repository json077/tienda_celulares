const express = require('express');

const exchangeRateController = require(
  '../controllers/exchangeRateController'
);

const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarRegistrarTipoCambio,
  validarIdMoneda,
  manejarErroresValidacion
} = require('../validators/exchangeRateValidator');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// ============================================================
// REGISTRAR NUEVO TIPO DE CAMBIO
// POST /api/tipos-cambio
// ============================================================

router.post(
  '/',
  verificarPermiso('TIPO_CAMBIO_GESTIONAR'),
  validarRegistrarTipoCambio,
  manejarErroresValidacion,
  exchangeRateController.registrar
);

// ============================================================
// OBTENER ÚLTIMO TIPO DE CAMBIO DE UNA MONEDA
// GET /api/tipos-cambio/moneda/:idMoneda
// ============================================================

router.get(
  '/moneda/:idMoneda',
  validarIdMoneda,
  manejarErroresValidacion,
  exchangeRateController.obtenerUltimo
);

module.exports = router;