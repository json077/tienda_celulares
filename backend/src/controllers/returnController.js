const returnService = require('../services/returnService');

function manejarError(res, error) {
  console.error(error);
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    ok: false,
    message: statusCode === 500 ? 'Error interno del servidor' : error.message
  });
}

async function listar(req, res) {
  try {
    const data = await returnService.listarDevoluciones();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const data = await returnService.obtenerDevolucion(req.params.idDevolucion);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const data = await returnService.crearDevolucion(req.body, req.usuario.id_usuario);
    return res.status(201).json({
      ok: true, message: 'Devolución creada correctamente', data
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function confirmar(req, res) {
  try {
    const data = await returnService.confirmarDevolucion(
      req.params.idDevolucion, req.usuario.id_usuario
    );
    return res.status(200).json({
      ok: true, message: 'Devolución confirmada correctamente', data
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function anular(req, res) {
  try {
    const data = await returnService.anularDevolucion(req.params.idDevolucion);
    return res.status(200).json({
      ok: true, message: 'Devolución anulada correctamente', data
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listar, obtenerPorId, crear, confirmar, anular };
