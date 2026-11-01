const express = require('express');
const { verificarToken } = require('../middlewares/authMiddleware');
const repository = require('../repositories/profileRepository');
const { MAX_BYTES, createPhotoStore } = require('../services/profilePhoto');
const { createProfileController } = require('../controllers/profileController');
const controller = createProfileController(repository, createPhotoStore());
const router = express.Router();
router.use(verificarToken);
router.use((req, res, next) => {
  if (Object.keys(req.query).length) return res.status(400).json({ ok: false, message: 'Mi perfil no admite IDs ni filtros de otros usuarios.' });
  return next();
});
router.get('/', controller.get);
router.get('/photo', controller.photo);
router.put('/photo', express.raw({ type: 'image/png', limit: MAX_BYTES }), controller.upload);
router.delete('/photo', (req, res, next) => {
  if (req.body && Object.keys(req.body).length) return res.status(400).json({ ok: false, message: 'No se permite seleccionar otro usuario.' });
  return next();
}, controller.remove);
router.post('/password', controller.password);
router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, message: 'La fotografía supera el máximo de 2 MB.' });
  return next(error);
});
module.exports = router;
