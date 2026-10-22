const express = require('express');

const categoryController = require('../controllers/categoryController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarIdCategoria,
  validarCrearCategoria,
  validarActualizarCategoria,
  manejarErroresValidacion
} = require('../validators/categoryValidator');

const router = express.Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('PRODUCTOS_VER'),
  categoryController.listar
);

router.get(
  '/:id',
  verificarPermiso('PRODUCTOS_VER'),
  validarIdCategoria,
  manejarErroresValidacion,
  categoryController.obtener
);

router.post(
  '/',
  verificarPermiso('PRODUCTOS_CREAR'),
  validarCrearCategoria,
  manejarErroresValidacion,
  categoryController.crear
);

router.put(
  '/:id',
  verificarPermiso('PRODUCTOS_EDITAR'),
  validarActualizarCategoria,
  manejarErroresValidacion,
  categoryController.actualizar
);

router.delete(
  '/:id',
  verificarPermiso('PRODUCTOS_ELIMINAR'),
  validarIdCategoria,
  manejarErroresValidacion,
  categoryController.desactivar
);

module.exports = router;