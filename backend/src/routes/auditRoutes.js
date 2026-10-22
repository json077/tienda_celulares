const express = require('express');
const auditController = require('../controllers/auditController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');
const { validarListado, validarIdAuditoria, manejarErroresValidacion } = require('../validators/auditValidator');

const router = express.Router();
router.use(verificarToken);
router.use(verificarPermiso('AUDITORIA_VER'));

router.get('/', validarListado, manejarErroresValidacion, auditController.listar);
router.get('/filtros', auditController.filtros);
router.get('/:idAuditoria', validarIdAuditoria, manejarErroresValidacion, auditController.obtenerPorId);

module.exports = router;
