const serializedUnitService = require(
  '../services/serializedUnitService'
);

async function disponibles(req, res) {
  try {
    const data = await serializedUnitService.unidadesDisponibles(
      req.usuario.id_usuario, Number(req.query.id_producto), Number(req.query.id_sucursal)
    );
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listar(req, res) {
  try {
    const unidades =
      await serializedUnitService.listarUnidades();

    return res.status(200).json({
      ok: true,
      data: unidades
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const unidad =
      await serializedUnitService.obtenerUnidad(
        req.params.idUnidad
      );

    return res.status(200).json({
      ok: true,
      data: unidad
    });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function registrar(req, res) {
  try {
    const resultado =
      await serializedUnitService.registrarUnidad(
        req.body,
        req.usuario.id_usuario
      );

    return res.status(201).json({
      ok: true,
      message: 'Unidad serializada registrada correctamente',
      data: resultado
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
  disponibles,
  listar,
  obtenerPorId,
  registrar
};
