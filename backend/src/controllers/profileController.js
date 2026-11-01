const bcrypt = require('bcrypt');

function createProfileController(repository, photos) {
  const attempts = new Map();
  const passwordPolicy = value => typeof value === 'string' && [...value].length >= 12 &&
    Buffer.byteLength(value, 'utf8') <= 72 && !value.includes('\0');
  const safe = handler => async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { await handler(req, res); }
    catch (error) {
      res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : 'No se pudo completar la operación de tu perfil.' });
    }
  };
  return {
    get: safe(async (req, res) => {
      const { id_usuario, nombres, apellidos, username, email, roles } = req.usuario;
      res.json({ ok: true, data: { id_usuario, nombres, apellidos, username, email, roles,
        sucursales: await repository.sucursales(id_usuario) } });
    }),
    photo: safe(async (req, res) => {
      const photo = await photos.read(req.usuario.id_usuario);
      if (!photo) return res.status(404).json({ ok: false, message: 'No tienes fotografía de perfil.' });
      res.set('Content-Type', 'image/png');
      res.set('X-Content-Type-Options', 'nosniff');
      res.send(photo);
    }),
    upload: safe(async (req, res) => {
      if (!req.is('image/png')) return res.status(415).json({ ok: false, message: 'Envía una fotografía PNG.' });
      await photos.write(req.usuario.id_usuario, req.body);
      res.json({ ok: true, message: 'Fotografía de perfil actualizada.' });
    }),
    remove: safe(async (req, res) => {
      await photos.remove(req.usuario.id_usuario);
      res.json({ ok: true, message: 'Fotografía de perfil eliminada.' });
    }),
    password: safe(async (req, res) => {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['actual', 'nueva', 'confirmacion'].includes(key)) ||
        typeof body.actual !== 'string' || !body.actual || Buffer.byteLength(body.actual, 'utf8') > 72 || body.actual.includes('\0') ||
        !passwordPolicy(body.nueva) || body.confirmacion !== body.nueva) {
        return res.status(400).json({ ok: false, message: 'Introduce la contraseña actual y confirma una nueva de al menos 12 caracteres y hasta 72 bytes, sin caracteres nulos.' });
      }
      const id = req.usuario.id_usuario, now = Date.now();
      // Bounded, per-user throttling; failed checks never disclose credentials or hashes.
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      const entry = attempts.get(id) || { count: 0, until: now + 15 * 60 * 1000 };
      if (entry.count >= 5 || attempts.size >= 10000) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - now) / 1000))));
        return res.status(429).json({ ok: false, message: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' });
      }
      entry.count++;
      attempts.set(id, entry);
      const current = await repository.credencial(id);
      if (!current || !await bcrypt.compare(body.actual, current.password_hash)) {
        return res.status(400).json({ ok: false, message: 'La contraseña actual no es correcta.' });
      }
      if (await bcrypt.compare(body.nueva, current.password_hash)) return res.status(400).json({ ok: false, message: 'La nueva contraseña debe ser diferente de la actual.' });
      const next = await bcrypt.hash(body.nueva, 12);
      if (!await repository.cambiarPassword(id, current.password_hash, next)) {
        return res.status(409).json({ ok: false, message: 'Tu cuenta cambió durante la operación. Vuelve a intentarlo.' });
      }
      attempts.delete(id);
      res.json({ ok: true, message: 'Tu contraseña se actualizó correctamente.' });
    }),
  };
}
module.exports = { createProfileController };
