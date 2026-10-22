const clientService = require('../services/clientService');

async function listar(req, res) {
  try {
    const clientes = await clientService.listarClientes();

    return res.status(200).json({
      ok: true,
      data: clientes
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const cliente = await clientService.obtenerCliente(
      req.params.idCliente
    );

    return res.status(200).json({
      ok: true,
      data: cliente
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const cliente = await clientService.crearCliente(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Cliente creado correctamente',
      data: cliente
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const cliente = await clientService.actualizarCliente(
      req.params.idCliente,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Cliente actualizado correctamente',
      data: cliente
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function desactivar(req, res) {
  try {
    const cliente = await clientService.desactivarCliente(
      req.params.idCliente
    );

    return res.status(200).json({
      ok: true,
      message: 'Cliente desactivado correctamente',
      data: cliente
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

function manejarError(res, error) {
  console.error(error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    ok: false,
    message:
      statusCode === 500
        ? 'Error interno del servidor'
        : error.message
  });
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  desactivar
};