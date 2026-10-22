const supplierService = require('../services/supplierService');

async function listar(req, res) {
  try {
    const proveedores = await supplierService.listarProveedores();

    return res.status(200).json({
      ok: true,
      data: proveedores
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const proveedor = await supplierService.obtenerProveedor(
      req.params.idProveedor
    );

    return res.status(200).json({
      ok: true,
      data: proveedor
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crear(req, res) {
  try {
    const proveedor = await supplierService.crearProveedor(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Proveedor registrado correctamente',
      data: proveedor
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function actualizar(req, res) {
  try {
    const proveedor = await supplierService.actualizarProveedor(
      req.params.idProveedor,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Proveedor actualizado correctamente',
      data: proveedor
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function desactivar(req, res) {
  try {
    const resultado = await supplierService.desactivarProveedor(
      req.params.idProveedor
    );

    return res.status(200).json({
      ok: true,
      message: resultado.mensaje,
      data: {
        id_proveedor: resultado.id_proveedor
      }
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

function manejarError(res, error) {
  console.error(error);

  return res.status(error.status || 500).json({
    ok: false,
    message: error.status
      ? error.message
      : 'Error interno del servidor'
  });
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  desactivar
};