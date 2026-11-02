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
const { MAX_BYTES, createProductPhotoService } = require('../services/productPhoto');
const { createProductPhotoController } = require('../controllers/productPhotoController');
const photos = createProductPhotoController(createProductPhotoService(require('../repositories/productRepository')));

router.use(verificarToken);

router.get('/:id/foto', verificarPermiso('PRODUCTO_VER'), validarIdProducto, manejarErroresValidacion, photos.get);
router.put('/:id/foto', verificarPermiso('PRODUCTOS_EDITAR'), validarIdProducto, manejarErroresValidacion,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }), photos.put);
router.delete('/:id/foto', verificarPermiso('PRODUCTOS_EDITAR'), validarIdProducto, manejarErroresValidacion, photos.remove);
router.use((error, req, res, next) => {
  if (!/^\/[^/]+\/foto\/?$/.test(req.path)) return next(error);
  return res.status(error.type === 'entity.too.large' ? 413 : 400)
    .json({ ok: false, message: error.type === 'entity.too.large' ? 'La fotografía supera el máximo de 2 MB.' : 'Solicitud de fotografía inválida.' });
});

router.get(
  '/',
  verificarPermiso('PRODUCTO_VER'),
  productController.listar
);

router.get(
  '/:id',
  verificarPermiso('PRODUCTO_VER'),
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
