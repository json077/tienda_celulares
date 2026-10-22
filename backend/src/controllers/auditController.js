const auditService = require('../services/auditService');

function manejarError(res, error) {
  // Evita volcar SQL, parámetros o JSON del historial en logs.
  const statusCode = error.statusCode || 500;
  if (statusCode === 500) auditService.informarFallo();
  return res.status(statusCode).json({
    ok: false, message: statusCode === 500 ? 'Error interno del servidor' : error.message
  });
}

async function listar(req, res) {
  try {
    const data = await auditService.listarAuditoria(req.query);
    return res.status(200).json({ ok: true, message: 'Auditoría obtenida correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function filtros(req, res) {
  try {
    const data = await auditService.obtenerFiltros();
    return res.status(200).json({ ok: true, message: 'Filtros obtenidos correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const data = await auditService.obtenerAuditoria(req.params.idAuditoria);
    return res.status(200).json({ ok: true, message: 'Registro de auditoría obtenido correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listar, filtros, obtenerPorId };
