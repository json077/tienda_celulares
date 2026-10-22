const express = require('express');

const clientController = require('../controllers/clientController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarCrearCliente,
  validarActualizarCliente,
  validarIdCliente,
  manejarErroresValidacion
} = require('../validators/clientValidator');

const router = express.Router();

// Todas las rutas de clientes requieren autenticación.
router.use(verificarToken);

// Listar clientes
router.get(
  '/',
  verificarPermiso('CLIENTES_VER'),
  clientController.listar
);

// Obtener cliente por ID
router.get(
  '/:idCliente',
  verificarPermiso('CLIENTES_VER'),
  validarIdCliente,
  manejarErroresValidacion,
  clientController.obtenerPorId
);

// Crear cliente
router.post(
  '/',
  verificarPermiso('CLIENTES_CREAR'),
  validarCrearCliente,
  manejarErroresValidacion,
  clientController.crear
);

// Actualizar cliente
router.put(
  '/:idCliente',
  verificarPermiso('CLIENTES_EDITAR'),
  validarIdCliente,
  validarActualizarCliente,
  manejarErroresValidacion,
  clientController.actualizar
);

// Desactivar cliente
router.delete(
  '/:idCliente',
  verificarPermiso('CLIENTES_ELIMINAR'),
  validarIdCliente,
  manejarErroresValidacion,
  clientController.desactivar
);

module.exports = router;