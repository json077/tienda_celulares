const cashService = require('../services/cashService');

// ============================================================
// MANEJO CENTRAL DE ERRORES
// ============================================================

function manejarError(error, res) {
  console.error(error);

  const status = error.status || 500;

  return res.status(status).json({
    ok: false,
    message:
      status === 500
        ? 'Ocurrió un error interno en el servidor'
        : error.message
  });
}

// ============================================================
// LISTAR CAJAS
// ============================================================

async function listarCajas(req, res) {
  try {
    const cajas = await cashService.listarCajas();

    return res.status(200).json({
      ok: true,
      data: cajas
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// OBTENER SESIÓN DE CAJA
// ============================================================

async function obtenerSesion(req, res) {
  try {
    const idSesionCaja = Number(req.params.idSesionCaja);

    const sesion = await cashService.obtenerSesion(idSesionCaja);

    return res.status(200).json({
      ok: true,
      data: sesion
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// ABRIR CAJA
// ============================================================

async function abrirCaja(req, res) {
  try {
    const idUsuario = req.usuario.id_usuario;

    const sesion = await cashService.abrirCaja(
      req.body,
      idUsuario
    );

    return res.status(201).json({
      ok: true,
      message: 'Caja abierta correctamente',
      data: sesion
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// CERRAR CAJA
// ============================================================

async function cerrarCaja(req, res) {
  try {
    const idSesionCaja = Number(req.params.idSesionCaja);
    const idUsuario = req.usuario.id_usuario;

    const resultado = await cashService.cerrarCaja(
      idSesionCaja,
      req.body,
      idUsuario
    );

    return res.status(200).json({
      ok: true,
      message: 'Caja cerrada correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

// ============================================================
// REGISTRAR MOVIMIENTO MANUAL DE CAJA
// ============================================================

async function registrarMovimientoManual(req, res) {
  try {
    const idSesionCaja = Number(req.params.idSesionCaja);
    const idUsuario = req.usuario.id_usuario;

    const resultado =
      await cashService.registrarMovimientoManual(
        idSesionCaja,
        req.body,
        idUsuario
      );

    return res.status(201).json({
      ok: true,
      message: 'Movimiento de caja registrado correctamente',
      data: resultado
    });
  } catch (error) {
    return manejarError(error, res);
  }
}

module.exports = {
  listarCajas,
  obtenerSesion,
  abrirCaja,
  cerrarCaja,
  registrarMovimientoManual
};