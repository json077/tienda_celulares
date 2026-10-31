const express = require('express');

const serializedUnitController = require(
  '../controllers/serializedUnitController'
);

const {
  verificarToken
} = require('../middlewares/authMiddleware');

const {
  verificarPermiso
} = require('../middlewares/permissionMiddleware');

const {
  validarRegistroUnidad,
  validarDisponibles,
  validarIdUnidad,
  manejarErroresValidacion
} = require('../validators/serializedUnitValidator');

const router = express.Router();

// Todas las rutas requieren autenticación.
router.use(verificarToken);

// Static route before /:idUnidad. Reading availability never grants IMEI registration.
router.get(
  '/disponibles',
  verificarPermiso('IMEI_VER'),
  validarDisponibles,
  manejarErroresValidacion,
  serializedUnitController.disponibles
);

// Listar todas las unidades serializadas.
router.get(
  '/',
  verificarPermiso('IMEI_GESTIONAR'),
  serializedUnitController.listar
);

// Obtener una unidad por ID.
router.get(
  '/:idUnidad',
  verificarPermiso('IMEI_GESTIONAR'),
  validarIdUnidad,
  manejarErroresValidacion,
  serializedUnitController.obtenerPorId
);

// Registrar una nueva unidad con IMEI.
router.post(
  '/',
  verificarPermiso('IMEI_GESTIONAR'),
  validarRegistroUnidad,
  manejarErroresValidacion,
  serializedUnitController.registrar
);

module.exports = router;
