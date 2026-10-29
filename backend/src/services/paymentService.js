const paymentRepository = require('../repositories/paymentRepository');
const creditRepository = require('../repositories/creditRepository');

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
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// ============================================================
// OBTENER PAGOS DE UNA VENTA
// ============================================================

async function listarPagosVenta(idVenta) {
  const pagos = await paymentRepository.obtenerPagosPorVenta(idVenta);

  return pagos;
}

// ============================================================
// REGISTRAR PAGO
// ============================================================

async function registrarPago(datos, idUsuario) {
  const connection = await paymentRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idVenta = Number(datos.id_venta);
    const idMoneda = Number(datos.id_moneda);
    const monto = Number(datos.monto);
    const metodo = String(datos.metodo || '').trim().toUpperCase();

    if (!Number.isInteger(idVenta) || idVenta <= 0) {
      throw crearError('La venta indicada no es válida');
    }

    if (!Number.isInteger(idMoneda) || idMoneda <= 0) {
      throw crearError('La moneda indicada no es válida');
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      throw crearError('El monto del pago debe ser mayor que cero');
    }

    if (!['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].includes(metodo)) {
      throw crearError('El método de pago no es válido');
    }

    // --------------------------------------------------------
    // 1. VALIDAR VENTA
    // --------------------------------------------------------

    const venta = await paymentRepository.obtenerVentaParaPago(
      connection,
      idVenta
    );

    if (!venta) {
      throw crearError('La venta no existe', 404);
    }

    if (venta.estado !== 'CONFIRMADA') {
      throw crearError(
        'Solo se pueden registrar pagos sobre ventas confirmadas'
      );
    }

    // La venta bloqueada serializa este control con crearCredito.
    // Cualquier plan asociado, incluso ANULADO, exige usar Créditos.
    const credito = await creditRepository.obtenerCreditoPorVenta(connection, idVenta);

    if (credito) {
      throw crearError(
        'La venta tiene un plan de crédito asociado. Los abonos deben gestionarse desde el módulo Créditos mediante el pago de cuotas',
        409
      );
    }

    // --------------------------------------------------------
    // 2. VALIDAR MONEDA Y DETERMINAR TIPO DE CAMBIO
    // --------------------------------------------------------

    const moneda = await paymentRepository.obtenerMoneda(
      connection,
      idMoneda
    );

    if (!moneda) {
      throw crearError('La moneda no existe', 404);
    }

    if (!moneda.activo) {
      throw crearError('La moneda seleccionada está inactiva');
    }

    let tipoCambio;

    if (moneda.codigo === 'NIO') {
      tipoCambio = 1;
    } else {
      const cambio =
        await paymentRepository.obtenerUltimoTipoCambio(
          connection,
          idMoneda
        );

      if (!cambio) {
        throw crearError(
          `No existe un tipo de cambio activo para ${moneda.codigo}`
        );
      }

      tipoCambio = Number(cambio.tasa);

      if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
        throw crearError(
          `El tipo de cambio configurado para ${moneda.codigo} no es válido`
        );
      }
    }

    const montoBase = redondear(monto * tipoCambio);

    // --------------------------------------------------------
    // 3. EVITAR SOBREPAGO
    // --------------------------------------------------------

    const totalPagado =
      await paymentRepository.obtenerTotalPagado(
        connection,
        idVenta
      );

    const saldoPendiente = redondear(
      Number(venta.total) - totalPagado
    );

    if (saldoPendiente <= 0) {
      throw crearError(
        'La venta ya se encuentra completamente pagada',
        409
      );
    }

    if (montoBase > saldoPendiente) {
      throw crearError(
        `El pago supera el saldo pendiente de la venta. Saldo pendiente: C$${saldoPendiente.toFixed(2)}`,
        409
      );
    }

    // --------------------------------------------------------
    // 4. VALIDAR SESIÓN DE CAJA CUANDO ES EFECTIVO
    // --------------------------------------------------------

    let idSesionCaja = null;

    if (metodo === 'EFECTIVO') {
      idSesionCaja = Number(datos.id_sesion_caja);

      if (
        !Number.isInteger(idSesionCaja) ||
        idSesionCaja <= 0
      ) {
        throw crearError(
          'Para pagos en efectivo debe indicar una sesión de caja'
        );
      }

      const sesion =
        await paymentRepository.obtenerSesionCaja(
          connection,
          idSesionCaja
        );

      if (!sesion) {
        throw crearError('La sesión de caja no existe', 404);
      }

      if (sesion.estado !== 'ABIERTA') {
        throw crearError(
          'La sesión de caja se encuentra cerrada'
        );
      }

      if (!sesion.caja_activa) {
        throw crearError('La caja se encuentra inactiva');
      }

      if (
        Number(sesion.id_sucursal) !==
        Number(venta.id_sucursal)
      ) {
        throw crearError(
          'La sesión de caja no pertenece a la sucursal de la venta'
        );
      }
    }

    // --------------------------------------------------------
    // 5. REFERENCIA PARA TARJETA / TRANSFERENCIA
    // --------------------------------------------------------

    const referencia = limpiarTexto(datos.referencia);

    if (
      ['TARJETA', 'TRANSFERENCIA'].includes(metodo) &&
      !referencia
    ) {
      throw crearError(
        `Debe indicar una referencia para pagos por ${metodo.toLowerCase()}`
      );
    }

    // --------------------------------------------------------
    // 6. CREAR PAGO
    // --------------------------------------------------------

    const idPago = await paymentRepository.crearPago(
      connection,
      {
        id_venta: idVenta,
        id_moneda: idMoneda,
        id_sesion_caja: idSesionCaja,
        id_usuario: idUsuario,
        metodo,
        monto: redondear(monto),
        tipo_cambio: tipoCambio,
        monto_base: montoBase,
        referencia
      }
    );

    // --------------------------------------------------------
    // 7. SI ES EFECTIVO, AUMENTAR EFECTIVO FÍSICO DE CAJA
    // --------------------------------------------------------

    if (metodo === 'EFECTIVO') {
      await paymentRepository.registrarMovimientoCaja(
        connection,
        {
          id_sesion_caja: idSesionCaja,
          id_usuario: idUsuario,
          monto: montoBase,
          id_pago: idPago,
          concepto: `Pago en efectivo de venta ${venta.numero_venta}`
        }
      );
    }

    await connection.commit();

    const pago = await paymentRepository.obtenerPagoPorId(idPago);

    return {
      pago,
      total_venta: Number(venta.total),
      total_pagado: redondear(totalPagado + montoBase),
      saldo_pendiente: redondear(
        Number(venta.total) - totalPagado - montoBase
      )
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// ============================================================
// ANULAR PAGO
// ============================================================

async function anularPago(idPago, idUsuario) {
  const connection = await paymentRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = Number(idPago);

    if (!Number.isInteger(id) || id <= 0) {
      throw crearError('El pago indicado no es válido');
    }

    // --------------------------------------------------------
    // 1. OBTENER Y BLOQUEAR EL PAGO
    // --------------------------------------------------------

    const pago =
      await paymentRepository.obtenerPagoParaAnular(
        connection,
        id
      );

    if (!pago) {
      throw crearError('El pago no existe', 404);
    }

    if (pago.estado !== 'APLICADO') {
      throw crearError(
        'El pago ya se encuentra anulado',
        409
      );
    }

    // --------------------------------------------------------
// PROTEGER PAGOS ASOCIADOS A CUOTAS DE CRÉDITO
// --------------------------------------------------------

const aplicacionCredito =
  await creditRepository.obtenerAplicacionPorPago(
    connection,
    id
  );

if (aplicacionCredito) {
  throw crearError(
    'Este pago pertenece a una cuota de crédito y no puede anularse desde el módulo general de pagos',
    409
  );
}

    // --------------------------------------------------------
    // 2. BLOQUEAR LA VENTA
    // --------------------------------------------------------

    const venta =
      await paymentRepository.obtenerVentaParaPago(
        connection,
        pago.id_venta
      );

    if (!venta) {
      throw crearError('La venta asociada no existe', 404);
    }

    // --------------------------------------------------------
    // 3. SI FUE EFECTIVO, VALIDAR LA SESIÓN DE CAJA
    // --------------------------------------------------------

    if (pago.metodo === 'EFECTIVO') {
      if (!pago.id_sesion_caja) {
        throw crearError(
          'El pago en efectivo no tiene una sesión de caja asociada'
        );
      }

      const sesion =
        await paymentRepository.obtenerSesionCaja(
          connection,
          pago.id_sesion_caja
        );

      if (!sesion) {
        throw crearError(
          'La sesión de caja asociada al pago no existe',
          404
        );
      }

      if (sesion.estado !== 'ABIERTA') {
        throw crearError(
          'No se puede anular un pago en efectivo porque su sesión de caja se encuentra cerrada',
          409
        );
      }

      if (!sesion.caja_activa) {
        throw crearError(
          'La caja asociada al pago se encuentra inactiva'
        );
      }
    }

    // --------------------------------------------------------
    // 4. ANULAR EL PAGO
    // --------------------------------------------------------

    const filasAfectadas =
      await paymentRepository.anularPago(
        connection,
        id
      );

    if (filasAfectadas !== 1) {
      throw crearError(
        'No fue posible anular el pago',
        409
      );
    }

    // --------------------------------------------------------
    // 5. REVERSAR EL EFECTIVO DE CAJA
    // --------------------------------------------------------

    if (pago.metodo === 'EFECTIVO') {
      await paymentRepository.registrarAnulacionCaja(
        connection,
        {
          id_sesion_caja: pago.id_sesion_caja,
          id_usuario: idUsuario,
          monto: Number(pago.monto_base),
          id_pago: pago.id_pago,
          concepto:
            `Anulación de pago en efectivo de venta ${pago.numero_venta}`
        }
      );
    }

    // --------------------------------------------------------
    // 6. RECALCULAR SALDO DE LA VENTA
    // --------------------------------------------------------

    const totalPagado =
      await paymentRepository.obtenerTotalPagado(
        connection,
        pago.id_venta
      );

    const totalVenta = Number(venta.total);

    const saldoPendiente = redondear(
      totalVenta - totalPagado
    );

    await connection.commit();

    const pagoAnulado =
      await paymentRepository.obtenerPagoPorId(id);

    return {
      pago: pagoAnulado,
      total_venta: totalVenta,
      total_pagado: redondear(totalPagado),
      saldo_pendiente: saldoPendiente
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

module.exports = {
  listarPagosVenta,
  registrarPago,
  anularPago
};
