const { pipeline } = require('node:stream/promises');
const service = require('../services/backupService');

function manejarError(res, error) {
  if (res.headersSent) { res.destroy(); return; }
  return res.status(error.backupControlado ? error.status : 500).json({
    ok: false, message: error.backupControlado ? error.message : 'Error interno del servidor'
  });
}

async function listar(req, res) {
  try { return res.status(200).json({ ok: true, data: await service.listarRespaldos() }); }
  catch (error) { return manejarError(res, error); }
}

async function crear(req, res) {
  try {
    const data = await service.crearRespaldo(req.usuario.id_usuario);
    return res.status(201).json({ ok: true, message: 'Respaldo creado correctamente', data });
  } catch (error) { return manejarError(res, error); }
}

async function restaurar(req, res) {
  try {
    const data = await service.restaurarRespaldo(req.params.idRespaldo);
    return res.status(200).json({ ok: true, message: 'Respaldo restaurado correctamente', data });
  } catch (error) { return manejarError(res, error); }
}

async function descargar(req, res) {
  try {
    const archivo = await service.descargarRespaldo(req.params.idRespaldo);
    res.attachment(archivo.nombre);
    res.set('Content-Type', 'application/sql');
    res.set('Content-Length', String(archivo.size));
    res.set('Cache-Control', 'no-store');
    await pipeline(archivo.stream, res);
  } catch (error) { return manejarError(res, error); }
}

module.exports = { listar, crear, restaurar, descargar };
