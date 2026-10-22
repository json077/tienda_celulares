const express = require('express');

const transferController =
  require('../controllers/transferController');

const {
  verificarToken
} = require('../middlewares/authMiddleware');

const {
  verificarPermiso
} = require('../middlewares/permissionMiddleware');

const {
  validarCrearTransferencia,
  validarIdTransferencia,
  manejarErroresValidacion
} = require('../validators/transferValidator');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// LISTAR TRANSFERENCIAS
router.get(
  '/',
  verificarPermiso('TRANSFERENCIAS_VER'),
  transferController.listar
);

// CREAR TRANSFERENCIA
router.post(
  '/',
  verificarPermiso('TRANSFERENCIAS_CREAR'),
  validarCrearTransferencia,
  manejarErroresValidacion,
  transferController.crear
);

// CONFIRMAR TRANSFERENCIA
router.post(
  '/:id/confirmar',
  verificarPermiso('TRANSFERENCIAS_CONFIRMAR'),
  validarIdTransferencia,
  manejarErroresValidacion,
  transferController.confirmar
);

// ANULAR TRANSFERENCIA
router.post(
  '/:id/anular',
  verificarPermiso('TRANSFERENCIAS_ANULAR'),
  validarIdTransferencia,
  manejarErroresValidacion,
  transferController.anular
);

// OBTENER TRANSFERENCIA POR ID
router.get(
  '/:id',
  verificarPermiso('TRANSFERENCIAS_VER'),
  validarIdTransferencia,
  manejarErroresValidacion,
  transferController.obtener
);

module.exports = router;
