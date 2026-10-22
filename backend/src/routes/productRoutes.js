const express = require('express');

const productController = require('../controllers/productController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarIdProducto,
  validarCrearProducto,
  validarActualizarProducto,
  manejarErroresValidacion
} = require('../validators/productValidator');

const router = express.Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('PRODUCTOS_VER'),
  productController.listar
);

router.get(
  '/:id',
  verificarPermiso('PRODUCTOS_VER'),
  validarIdProducto,
  manejarErroresValidacion,
  productController.obtener
);

router.post(
  '/',
  verificarPermiso('PRODUCTOS_CREAR'),
  validarCrearProducto,
  manejarErroresValidacion,
  productController.crear
);

router.put(
  '/:id',
  verificarPermiso('PRODUCTOS_EDITAR'),
  validarActualizarProducto,
  manejarErroresValidacion,
  productController.actualizar
);

router.delete(
  '/:id',
  verificarPermiso('PRODUCTOS_ELIMINAR'),
  validarIdProducto,
  manejarErroresValidacion,
  productController.desactivar
);

module.exports = router;