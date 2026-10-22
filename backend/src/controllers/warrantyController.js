const warrantyService = require('../services/warrantyService');

function manejarError(res, error) {
  console.error(error);
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    ok: false, message: statusCode === 500 ? 'Error interno del servidor' : error.message
  });
}

async function listar(req, res) {
  try {
    const data = await warrantyService.listarGarantias();
    return res.status(200).json({ ok: true, message: 'Garantías obtenidas correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const data = await warrantyService.obtenerGarantia(req.params.idGarantia);
    return res.status(200).json({ ok: true, message: 'Garantía obtenida correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const data = await warrantyService.crearGarantia(req.body);
    return res.status(201).json({ ok: true, message: 'Garantía creada correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarReclamos(req, res) {
  try {
    const data = await warrantyService.listarReclamos(req.params.idGarantia);
    return res.status(200).json({ ok: true, message: 'Reclamos obtenidos correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerReclamo(req, res) {
  try {
    const data = await warrantyService.obtenerReclamo(req.params.idReclamo);
    return res.status(200).json({ ok: true, message: 'Reclamo obtenido correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearReclamo(req, res) {
  try {
    const data = await warrantyService.crearReclamo(
      req.params.idGarantia, req.body, req.usuario.id_usuario
    );
    return res.status(201).json({ ok: true, message: 'Reclamo registrado correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function resolverReclamo(req, res) {
  try {
    const data = await warrantyService.resolverReclamo(
      req.params.idReclamo, req.body, req.usuario.id_usuario
    );
    return res.status(200).json({ ok: true, message: 'Reclamo actualizado correctamente', data });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listar, obtenerPorId, crear, listarReclamos, obtenerReclamo, crearReclamo, resolverReclamo };
