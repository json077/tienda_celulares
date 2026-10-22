const express = require('express');

const brandController = require('../controllers/brandController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarIdMarca,
  validarCrearMarca,
  validarActualizarMarca,
  manejarErroresValidacion
} = require('../validators/brandValidator');

const router = express.Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('PRODUCTOS_VER'),
  brandController.listar
);

router.get(
  '/:id',
  verificarPermiso('PRODUCTOS_VER'),
  validarIdMarca,
  manejarErroresValidacion,
  brandController.obtener
);

router.post(
  '/',
  verificarPermiso('PRODUCTOS_CREAR'),
  validarCrearMarca,
  manejarErroresValidacion,
  brandController.crear
);

router.put(
  '/:id',
  verificarPermiso('PRODUCTOS_EDITAR'),
  validarActualizarMarca,
  manejarErroresValidacion,
  brandController.actualizar
);

router.delete(
  '/:id',
  verificarPermiso('PRODUCTOS_ELIMINAR'),
  validarIdMarca,
  manejarErroresValidacion,
  brandController.desactivar
);

module.exports = router;