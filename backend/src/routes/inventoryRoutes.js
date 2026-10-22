const express = require('express');

const inventoryController = require('../controllers/inventoryController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarAjuste,
  validarStockMinimo,
  manejarErroresValidacion
} = require('../validators/inventoryValidator');

const router = express.Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('INVENTARIO_VER'),
  inventoryController.listar
);

router.get(
  '/movimientos',
  verificarPermiso('MOVIMIENTO_VER'),
  inventoryController.movimientos
);

router.post(
  '/ajustes',
  verificarPermiso('INVENTARIO_AJUSTAR'),
  validarAjuste,
  manejarErroresValidacion,
  inventoryController.ajustar
);

router.put(
  '/:idSucursal/:idProducto/stock-minimo',
  verificarPermiso('INVENTARIO_AJUSTAR'),
  validarStockMinimo,
  manejarErroresValidacion,
  inventoryController.stockMinimo
);

module.exports = router;