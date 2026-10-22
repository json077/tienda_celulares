const express = require('express');
const returnController = require('../controllers/returnController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');
const {
  validarCrearDevolucion, validarIdDevolucion, manejarErroresValidacion
} = require('../validators/returnValidator');

const router = express.Router();
router.use(verificarToken);

router.get('/', verificarPermiso('DEVOLUCIONES_VER'), returnController.listar);

router.post(
  '/', verificarPermiso('DEVOLUCIONES_CREAR'),
  validarCrearDevolucion, manejarErroresValidacion, returnController.crear
);

router.post(
  '/:idDevolucion/confirmar', verificarPermiso('DEVOLUCIONES_CONFIRMAR'),
  validarIdDevolucion, manejarErroresValidacion, returnController.confirmar
);

router.post(
  '/:idDevolucion/anular', verificarPermiso('DEVOLUCIONES_ANULAR'),
  validarIdDevolucion, manejarErroresValidacion, returnController.anular
);

router.get(
  '/:idDevolucion', verificarPermiso('DEVOLUCIONES_VER'),
  validarIdDevolucion, manejarErroresValidacion, returnController.obtenerPorId
);

module.exports = router;
