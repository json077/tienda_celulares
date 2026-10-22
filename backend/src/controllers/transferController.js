const transferService =
  require('../services/transferService');

async function listar(req, res, next) {
  try {
    const data =
      await transferService.listarTransferencias();

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const data =
      await transferService.obtenerTransferencia(
        req.params.id
      );

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const data =
      await transferService.crearTransferencia(
        req.body,
        req.usuario.id_usuario
      );

    res.status(201).json({
      ok: true,
      message: 'Transferencia creada correctamente',
      data
    });
  } catch (error) {
    next(error);
  }
}

async function confirmar(req, res, next) {
  try {
    const data =
      await transferService.confirmarTransferencia(
        req.params.id,
        req.usuario.id_usuario
      );

    res.json({
      ok: true,
      message: 'Transferencia confirmada correctamente',
      data
    });
  } catch (error) {
    next(error);
  }
}

async function anular(req, res, next) {
  try {
    const data =
      await transferService.anularTransferencia(
        req.params.id
      );

    res.json({
      ok: true,
      message: 'Transferencia anulada correctamente',
      data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  confirmar,
  anular
};