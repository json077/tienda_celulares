const cashRepository = require('../repositories/cashRepository');

function crearError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();
  return texto || null;
}

function redondear(valor) {
  return Math.round(
    (Number(valor) + Number.EPSILON) * 100
  ) / 100;
}

// ============================================================
// LISTAR CAJAS
// ============================================================

async function listarCajas() {
  return cashRepository.obtenerCajas();
}

// ============================================================
// OBTENER SESIÓN
// ============================================================

async function obtenerSesion(idSesionCaja) {
  const sesion = await cashRepository.obtenerSesionPorId(
    idSesionCaja
  );

  if (!sesion) {
    throw crearError('La sesión de caja no existe', 404);
  }

  return sesion;
}

// ============================================================
// ABRIR CAJA
// ============================================================

async function abrirCaja(datos, idUsuario) {
  const connection = await cashRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idCaja = Number(datos.id_caja);
    const montoApertura = Number(datos.monto_apertura ?? 0);

    if (!Number.isInteger(idCaja) || idCaja <= 0) {
      throw crearError('La caja indicada no es válida');
    }

    if (
      !Number.isFinite(montoApertura) ||
      montoApertura < 0
    ) {
      throw crearError(
        'El monto de apertura debe ser un valor mayor o igual a cero'
      );
    }

    const caja = await cashRepository.obtenerCajaPorId(
      connection,
      idCaja
    );

    if (!caja) {
      throw crearError('La caja no existe', 404);
    }

    if (!caja.activo) {
      throw crearError('La caja se encuentra inactiva');
    }

    const sesionAbierta =
      await cashRepository.obtenerSesionAbiertaPorCaja(
        connection,
        idCaja
      );

    if (sesionAbierta) {
      throw crearError(
        `La caja ya tiene una sesión abierta con ID ${sesionAbierta.id_sesion_caja}`,
        409
      );
    }

    const idSesionCaja =
      await cashRepository.crearSesion(connection, {
        id_caja: idCaja,
        id_usuario: idUsuario,
        monto_apertura: montoApertura,
        observacion: limpiarTexto(datos.observacion)
      });

    await cashRepository.registrarMovimiento(connection, {
      id_sesion_caja: idSesionCaja,
      id_usuario: idUsuario,
      tipo: 'APERTURA',
      monto: montoApertura,
      tipo_referencia: 'SESION_CAJA',
      id_referencia: idSesionCaja,
      concepto: 'Monto inicial de apertura de caja'
    });

    await connection.commit();

    return await obtenerSesion(idSesionCaja);

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// ============================================================
// CERRAR CAJA
// ============================================================

async function cerrarCaja(
  idSesionCaja,
  datos,
  idUsuario
) {
  const connection = await cashRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idSesion = Number(idSesionCaja);
    const montoCierreReal = Number(datos.monto_cierre_real);

    if (!Number.isInteger(idSesion) || idSesion <= 0) {
      throw crearError(
        'La sesión de caja indicada no es válida'
      );
    }

    if (
      !Number.isFinite(montoCierreReal) ||
      montoCierreReal < 0
    ) {
      throw crearError(
        'El monto real de cierre debe ser mayor o igual a cero'
      );
    }

    // Bloqueamos la sesión mientras se realiza el cierre.
    const sesion =
      await cashRepository.obtenerSesionPorIdParaActualizar(
        connection,
        idSesion
      );

    if (!sesion) {
      throw crearError('La sesión de caja no existe', 404);
    }

    if (sesion.estado !== 'ABIERTA') {
      throw crearError(
        'La sesión de caja ya se encuentra cerrada',
        409
      );
    }

    // Calculamos cuánto efectivo debería existir según
    // todos los movimientos registrados en la sesión.
    const montoSistema =
      await cashRepository.calcularMontoSistema(
        connection,
        idSesion
      );

    const montoSistemaRedondeado = redondear(montoSistema);
    const montoRealRedondeado = redondear(montoCierreReal);

    // Positivo = sobrante
    // Negativo = faltante
    // Cero = caja cuadrada
    const diferencia = redondear(
      montoRealRedondeado - montoSistemaRedondeado
    );

    await cashRepository.cerrarSesion(connection, {
      id_sesion_caja: idSesion,
      id_usuario: idUsuario,
      monto_cierre_sistema: montoSistemaRedondeado,
      monto_cierre_real: montoRealRedondeado,
      diferencia,
      observacion: limpiarTexto(datos.observacion)
    });

    await connection.commit();

    const sesionCerrada = await obtenerSesion(idSesion);

    return {
      sesion: sesionCerrada,
      resumen: {
        monto_sistema: montoSistemaRedondeado,
        monto_real: montoRealRedondeado,
        diferencia,
        resultado:
          diferencia === 0
            ? 'CUADRADA'
            : diferencia > 0
              ? 'SOBRANTE'
              : 'FALTANTE'
      }
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// ============================================================
// REGISTRAR MOVIMIENTO MANUAL DE CAJA
// ============================================================

async function registrarMovimientoManual(
  idSesionCaja,
  datos,
  idUsuario
) {
  const connection = await cashRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idSesion = Number(idSesionCaja);
    const tipo = String(datos.tipo || '').trim().toUpperCase();
    const monto = redondear(Number(datos.monto));
    const concepto = limpiarTexto(datos.concepto);

    // --------------------------------------------------------
    // VALIDACIONES DE NEGOCIO
    // --------------------------------------------------------

    if (!Number.isInteger(idSesion) || idSesion <= 0) {
      throw crearError(
        'La sesión de caja indicada no es válida'
      );
    }

    if (!['INGRESO', 'EGRESO'].includes(tipo)) {
      throw crearError(
        'El tipo de movimiento debe ser INGRESO o EGRESO'
      );
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      throw crearError(
        'El monto del movimiento debe ser mayor que cero'
      );
    }

    if (!concepto) {
      throw crearError(
        'El concepto del movimiento es obligatorio'
      );
    }

    // Bloqueamos la sesión para evitar movimientos mientras
    // otro proceso intenta cerrarla.
    const sesion =
      await cashRepository.obtenerSesionPorIdParaActualizar(
        connection,
        idSesion
      );

    if (!sesion) {
      throw crearError(
        'La sesión de caja no existe',
        404
      );
    }

    if (sesion.estado !== 'ABIERTA') {
      throw crearError(
        'La sesión de caja se encuentra cerrada',
        409
      );
    }

    // --------------------------------------------------------
    // VALIDAR SALDO PARA EGRESOS
    // --------------------------------------------------------

    const saldoActual = redondear(
      await cashRepository.calcularMontoSistema(
        connection,
        idSesion
      )
    );

    if (tipo === 'EGRESO' && monto > saldoActual) {
      throw crearError(
        `El egreso supera el saldo disponible en caja. Saldo actual: C$ ${saldoActual.toFixed(2)}`,
        409
      );
    }

    // --------------------------------------------------------
    // REGISTRAR MOVIMIENTO
    // --------------------------------------------------------

    const idMovimientoCaja =
      await cashRepository.registrarMovimiento(
        connection,
        {
          id_sesion_caja: idSesion,
          id_usuario: idUsuario,
          tipo,
          monto,
          tipo_referencia: 'MOVIMIENTO_MANUAL',
          id_referencia: null,
          concepto
        }
      );

    await connection.commit();

    const movimiento =
      await cashRepository.obtenerMovimientoPorId(
        idMovimientoCaja
      );

    const nuevoSaldo = redondear(
      tipo === 'INGRESO'
        ? saldoActual + monto
        : saldoActual - monto
    );

    return {
      movimiento,
      saldo_anterior: saldoActual,
      saldo_actual: nuevoSaldo
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

module.exports = {
  listarCajas,
  obtenerSesion,
  abrirCaja,
  cerrarCaja,
  registrarMovimientoManual
};