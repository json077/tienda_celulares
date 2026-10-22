const express = require('express');

const purchaseController = require('../controllers/purchaseController');

const {
  verificarToken
} = require('../middlewares/authMiddleware');

const {
  verificarPermiso
} = require('../middlewares/permissionMiddleware');

const {
  validarCrearCompra,
  validarIdCompra,
  validarConfirmarCompra,
  manejarErroresValidacion
} = require('../validators/purchaseValidator');

const router = express.Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('COMPRAS_VER'),
  purchaseController.listar
);

router.post(
  '/',
  verificarPermiso('COMPRAS_CREAR'),
  validarCrearCompra,
  manejarErroresValidacion,
  purchaseController.crear
);

router.post(
  '/:idCompra/confirmar',
  verificarPermiso('COMPRAS_CONFIRMAR'),
  validarConfirmarCompra,
  manejarErroresValidacion,
  purchaseController.confirmar
);

router.post(
  '/:idCompra/anular',
  verificarPermiso('COMPRAS_ANULAR'),
  validarIdCompra,
  manejarErroresValidacion,
  purchaseController.anular
);

router.get(
  '/:idCompra',
  verificarPermiso('COMPRAS_VER'),
  validarIdCompra,
  manejarErroresValidacion,
  purchaseController.obtenerPorId
);

module.exports = router;