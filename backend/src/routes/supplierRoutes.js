const express = require('express');

const supplierController = require('../controllers/supplierController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const {
  validarCrearProveedor,
  validarActualizarProveedor,
  validarIdProveedor,
  manejarErroresValidacion
} = require('../validators/supplierValidator');

const router = express.Router();

// Todas las rutas de proveedores requieren autenticación.
router.use(verificarToken);

// Listar proveedores
router.get(
  '/',
  verificarPermiso('PROVEEDORES_VER'),
  supplierController.listar
);

// Obtener proveedor por ID
router.get(
  '/:idProveedor',
  verificarPermiso('PROVEEDORES_VER'),
  validarIdProveedor,
  manejarErroresValidacion,
  supplierController.obtenerPorId
);

// Crear proveedor
router.post(
  '/',
  verificarPermiso('PROVEEDORES_CREAR'),
  validarCrearProveedor,
  manejarErroresValidacion,
  supplierController.crear
);

// Actualizar proveedor
router.put(
  '/:idProveedor',
  verificarPermiso('PROVEEDORES_EDITAR'),
  validarIdProveedor,
  validarActualizarProveedor,
  manejarErroresValidacion,
  supplierController.actualizar
);

// Desactivar proveedor
router.delete(
  '/:idProveedor',
  verificarPermiso('PROVEEDORES_ELIMINAR'),
  validarIdProveedor,
  manejarErroresValidacion,
  supplierController.desactivar
);

module.exports = router;