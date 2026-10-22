const express = require('express');

const { login } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.post('/login', login);

router.get('/me', verificarToken, (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Token válido',
    usuario: req.usuario
  });
});

router.get(
  '/prueba-permiso',
  verificarToken,
  verificarPermiso('PRODUCTOS_CREAR'),
  (req, res) => {
    res.status(200).json({
      ok: true,
      message: 'Tiene permiso para crear productos'
    });
  }
);

module.exports = router;