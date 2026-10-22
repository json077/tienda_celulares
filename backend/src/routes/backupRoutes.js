const express = require('express');
const controller = require('../controllers/backupController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');
const { validarIdRespaldo, validarSinDatos, manejarErroresValidacion } = require('../validators/backupValidator');

const router = express.Router();
router.use(verificarToken);
router.get('/', verificarPermiso('BACKUP_CREAR'), controller.listar);
router.post('/', verificarPermiso('BACKUP_CREAR'), validarSinDatos, manejarErroresValidacion, controller.crear);
router.post('/:idRespaldo/restaurar', verificarPermiso('BACKUP_RESTAURAR'),
  validarIdRespaldo, validarSinDatos, manejarErroresValidacion, controller.restaurar);
router.get('/:idRespaldo/descargar', verificarPermiso('BACKUP_CREAR'),
  validarIdRespaldo, manejarErroresValidacion, controller.descargar);

module.exports = router;
