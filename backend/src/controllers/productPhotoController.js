function createProductPhotoController(service) {
  const safe = (handler) => async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    try { await handler(req, res); }
    catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : 'No se pudo completar la operación de fotografía.' });
    }
  };
  return {
    get: safe(async (req, res) => {
      const bytes = await service.read(req.params.id);
      if (!bytes) return res.status(404).json({ ok: false, message: 'El producto no tiene fotografía disponible.' });
      res.type('image/webp').send(bytes);
    }),
    put: safe(async (req, res) => {
      await service.replace(req.params.id, req.body, req.get('Content-Type')?.split(';')[0].trim().toLowerCase());
      res.json({ ok: true, message: 'Fotografía del producto actualizada.' });
    }),
    remove: safe(async (req, res) => {
      await service.remove(req.params.id);
      res.json({ ok: true, message: 'Fotografía del producto eliminada.' });
    }),
  };
}
module.exports = { createProductPhotoController };
