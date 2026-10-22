const express = require('express');
const warrantyController = require('../controllers/warrantyController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');
const {
  validarIdGarantia, validarIdReclamo, validarCrearGarantia,
  validarCrearReclamo, validarResolverReclamo, manejarErroresValidacion
} = require('../validators/warrantyValidator');

const router = express.Router();
router.use(verificarToken);

router.get('/', verificarPermiso('GARANTIAS_VER'), warrantyController.listar);
router.post(
  '/', verificarPermiso('GARANTIAS_CREAR'), validarCrearGarantia,
  manejarErroresValidacion, warrantyController.crear
);

// Rutas estáticas antes del parámetro de garantía.
router.get(
  '/reclamos/:idReclamo', verificarPermiso('GARANTIAS_VER'), validarIdReclamo,
  manejarErroresValidacion, warrantyController.obtenerReclamo
);
router.post(
  '/reclamos/:idReclamo/resolver', verificarPermiso('GARANTIAS_RESOLVER'), validarResolverReclamo,
  manejarErroresValidacion, warrantyController.resolverReclamo
);
router.get(
  '/:idGarantia/reclamos', verificarPermiso('GARANTIAS_VER'), validarIdGarantia,
  manejarErroresValidacion, warrantyController.listarReclamos
);
router.post(
  '/:idGarantia/reclamos', verificarPermiso('GARANTIAS_RECLAMAR'), validarCrearReclamo,
  manejarErroresValidacion, warrantyController.crearReclamo
);
router.get(
  '/:idGarantia', verificarPermiso('GARANTIAS_VER'), validarIdGarantia,
  manejarErroresValidacion, warrantyController.obtenerPorId
);

module.exports = router;
