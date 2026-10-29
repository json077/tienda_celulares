const express = require('express');
const controller = require('../controllers/userController');
const validator = require('../validators/userValidator');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const router = express.Router();
router.use(verificarToken);
router.get('/', verificarPermiso('USUARIO_VER'), validator.listado, validator.validar, controller.listar);
router.get('/roles', verificarPermiso('ROL_VER'), controller.roles);
router.get('/:idUsuario', verificarPermiso('USUARIO_VER'), validator.id, validator.validar, controller.obtener);
router.post('/', verificarPermiso('USUARIO_CREAR'), verificarPermiso('USUARIO_ROLES'),
  validator.crear, validator.validar, controller.crear);
router.put('/:idUsuario', verificarPermiso('USUARIO_EDITAR'), validator.id, validator.editar, validator.validar, controller.editar);
router.patch('/:idUsuario/estado', verificarPermiso('USUARIO_EDITAR'), validator.id, validator.estado, validator.validar, controller.estado);
router.put('/:idUsuario/roles', verificarPermiso('USUARIO_ROLES'), validator.id, validator.asignarRoles, validator.validar, controller.asignarRoles);

module.exports = router;
