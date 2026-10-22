const creditRepository = require('../repositories/creditRepository');
const paymentRepository = require('../repositories/paymentRepository');

function crearError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function redondear(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();
  return texto || null;
}

function sumarPeriodo(fecha, frecuencia, numeroCuota) {
  const resultado = new Date(`${fecha}T12:00:00`);

  if (Number.isNaN(resultado.getTime())) {
    throw crearError('La fecha de inicio no es válida');
  }

  if (frecuencia === 'SEMANAL') {
    resultado.setDate(
      resultado.getDate() + (7 * numeroCuota)
    );
  } else if (frecuencia === 'QUINCENAL') {
    resultado.setDate(
      resultado.getDate() + (15 * numeroCuota)
    );
  } else if (frecuencia === 'MENSUAL') {
    resultado.setMonth(
      resultado.getMonth() + numeroCuota
    );
  } else {
    throw crearError(
      'La frecuencia del crédito no es válida'
    );
  }

  return resultado.toISOString().slice(0, 10);
}

// ============================================================
// LISTAR CRÉDITOS
// ============================================================

async function listarCreditos() {
  return creditRepository.obtenerTodos();
}

// ============================================================
// OBTENER CRÉDITO
// ============================================================

async function obtenerCredito(idCredito) {
  const id = Number(idCredito);

  if (!Number.isInteger(id) || id <= 0) {
    throw crearError(
      'El crédito indicado no es válido'
    );
  }

  const credito =
    await creditRepository.obtenerPorId(id);

  if (!credito) {
    throw crearError(
      'El crédito no existe',
      404
    );
  }

  const cuotas =
    await creditRepository.obtenerCuotasPorCredito(id);

  return {
    ...credito,
    cuotas
  };
}

// ============================================================
// CREAR CRÉDITO
// ============================================================

async function crearCredito(datos) {
  const connection =
    await creditRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idVenta = Number(datos.id_venta);
    const tasaInteres = Number(datos.tasa_interes);
    const numeroCuotas = Number(datos.numero_cuotas);

    const frecuencia = String(
      datos.frecuencia || ''
    )
      .trim()
      .toUpperCase();

    const fechaInicio = String(
      datos.fecha_inicio || ''
    ).trim();

    if (
      !Number.isInteger(idVenta) ||
      idVenta <= 0
    ) {
      throw crearError(
        'La venta indicada no es válida'
      );
    }

    if (
      !Number.isFinite(tasaInteres) ||
      tasaInteres < 0 ||
      tasaInteres > 100
    ) {
      throw crearError(
        'La tasa de interés debe estar entre 0 y 100'
      );
    }

    if (
      !Number.isInteger(numeroCuotas) ||
      numeroCuotas <= 0
    ) {
      throw crearError(
        'El número de cuotas debe ser un entero mayor que cero'
      );
    }

    if (numeroCuotas > 120) {
      throw crearError(
        'El número de cuotas no puede ser mayor que 120'
      );
    }

    if (
      ![
        'SEMANAL',
        'QUINCENAL',
        'MENSUAL'
      ].includes(frecuencia)
    ) {
      throw crearError(
        'La frecuencia debe ser SEMANAL, QUINCENAL o MENSUAL'
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)
    ) {
      throw crearError(
        'La fecha de inicio debe tener formato YYYY-MM-DD'
      );
    }

    // --------------------------------------------------------
    // 1. VALIDAR VENTA
    // --------------------------------------------------------

    const venta =
      await creditRepository.obtenerVentaParaCredito(
        connection,
        idVenta
      );

    if (!venta) {
      throw crearError(
        'La venta no existe',
        404
      );
    }

    if (venta.estado !== 'CONFIRMADA') {
      throw crearError(
        'Solo se puede crear crédito para una venta confirmada',
        409
      );
    }

    if (venta.tipo_venta !== 'CREDITO') {
      throw crearError(
        'La venta seleccionada no es una venta a crédito',
        409
      );
    }

    if (!venta.id_cliente) {
      throw crearError(
        'La venta debe tener un cliente asociado'
      );
    }

    // --------------------------------------------------------
    // 2. EVITAR MÁS DE UN CRÉDITO POR VENTA
    // --------------------------------------------------------

    const creditoExistente =
      await creditRepository.obtenerCreditoPorVenta(
        connection,
        idVenta
      );

    if (creditoExistente) {
      throw crearError(
        'La venta ya tiene un crédito asociado',
        409
      );
    }

    // --------------------------------------------------------
    // 3. CALCULAR MONTO FINANCIADO
    // --------------------------------------------------------

    const totalVenta =
      redondear(Number(venta.total));

    const totalPagado =
      await creditRepository.obtenerTotalPagadoVenta(
        connection,
        idVenta
      );

    const montoFinanciado = redondear(
      totalVenta - totalPagado
    );

    if (montoFinanciado <= 0) {
      throw crearError(
        'La venta ya se encuentra completamente pagada',
        409
      );
    }

    // --------------------------------------------------------
    // 4. CALCULAR INTERÉS
    // --------------------------------------------------------

    const montoInteres = redondear(
      montoFinanciado *
      (tasaInteres / 100)
    );

    const montoTotal = redondear(
      montoFinanciado + montoInteres
    );

    if (montoTotal <= 0) {
      throw crearError(
        'El monto total del crédito no es válido'
      );
    }

    // --------------------------------------------------------
    // 5. CREAR CRÉDITO
    // --------------------------------------------------------

    const idCredito =
      await creditRepository.crearCredito(
        connection,
        {
          id_venta: idVenta,
          id_cliente: venta.id_cliente,
          monto_financiado: montoFinanciado,
          tasa_interes: tasaInteres,
          numero_cuotas: numeroCuotas,
          monto_interes: montoInteres,
          monto_total: montoTotal,
          saldo_pendiente: montoTotal,
          frecuencia,
          fecha_inicio: fechaInicio,
          observacion:
            limpiarTexto(datos.observacion)
        }
      );

    // --------------------------------------------------------
    // 6. GENERAR CUOTAS
    // --------------------------------------------------------

    const cuotaBase = redondear(
      montoTotal / numeroCuotas
    );

    let acumulado = 0;

    for (
      let i = 1;
      i <= numeroCuotas;
      i += 1
    ) {
      let montoCuota;

      if (i === numeroCuotas) {
        montoCuota = redondear(
          montoTotal - acumulado
        );
      } else {
        montoCuota = cuotaBase;

        acumulado = redondear(
          acumulado + montoCuota
        );
      }

      const fechaVencimiento =
        sumarPeriodo(
          fechaInicio,
          frecuencia,
          i
        );

      await creditRepository.crearCuota(
        connection,
        {
          id_credito: idCredito,
          numero_cuota: i,
          fecha_vencimiento:
            fechaVencimiento,
          monto_cuota: montoCuota
        }
      );
    }

    await connection.commit();

    return obtenerCredito(idCredito);

  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'La venta ya tiene un crédito asociado',
        409
      );
    }

    throw error;

  } finally {
    connection.release();
  }
}

// ============================================================
// PAGAR CUOTA
// ============================================================

async function pagarCuota(
  idCuota,
  datos,
  idUsuario
) {
  const connection =
    await creditRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = Number(idCuota);
    const idMoneda = Number(datos.id_moneda);
    const monto = Number(datos.monto);

    const metodo = String(
      datos.metodo || ''
    )
      .trim()
      .toUpperCase();

    // --------------------------------------------------------
    // 1. VALIDACIONES BÁSICAS
    // --------------------------------------------------------

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      throw crearError(
        'La cuota indicada no es válida'
      );
    }

    if (
      !Number.isInteger(idMoneda) ||
      idMoneda <= 0
    ) {
      throw crearError(
        'La moneda indicada no es válida'
      );
    }

    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      throw crearError(
        'El monto del pago debe ser mayor que cero'
      );
    }

    if (
      ![
        'EFECTIVO',
        'TARJETA',
        'TRANSFERENCIA'
      ].includes(metodo)
    ) {
      throw crearError(
        'El método de pago no es válido'
      );
    }

    // --------------------------------------------------------
    // 2. OBTENER Y BLOQUEAR CUOTA
    // --------------------------------------------------------

    const cuota =
      await creditRepository.obtenerCuotaParaPago(
        connection,
        id
      );

    if (!cuota) {
      throw crearError(
        'La cuota no existe',
        404
      );
    }

    if (cuota.estado_credito !== 'ACTIVO') {
      throw crearError(
        'El crédito no se encuentra activo',
        409
      );
    }

    if (cuota.estado_venta !== 'CONFIRMADA') {
      throw crearError(
        'La venta asociada al crédito no se encuentra confirmada',
        409
      );
    }

    if (
      ['PAGADA', 'ANULADA'].includes(
        cuota.estado
      )
    ) {
      throw crearError(
        cuota.estado === 'PAGADA'
          ? 'La cuota ya se encuentra pagada'
          : 'La cuota se encuentra anulada',
        409
      );
    }

    const saldoCuotaActual =
      redondear(Number(cuota.saldo_cuota));

    const saldoCreditoActual =
      redondear(
        Number(cuota.saldo_credito)
      );

    if (saldoCuotaActual <= 0) {
      throw crearError(
        'La cuota no tiene saldo pendiente',
        409
      );
    }

    // --------------------------------------------------------
    // 3. VALIDAR MONEDA Y TIPO DE CAMBIO
    // --------------------------------------------------------

    const moneda =
      await paymentRepository.obtenerMoneda(
        connection,
        idMoneda
      );

    if (!moneda) {
      throw crearError(
        'La moneda no existe',
        404
      );
    }

    if (!moneda.activo) {
      throw crearError(
        'La moneda seleccionada está inactiva'
      );
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

      tipoCambio =
        Number(cambio.tasa);

      if (
        !Number.isFinite(tipoCambio) ||
        tipoCambio <= 0
      ) {
        throw crearError(
          `El tipo de cambio configurado para ${moneda.codigo} no es válido`
        );
      }
    }

    const montoBase = redondear(
      monto * tipoCambio
    );

    // --------------------------------------------------------
    // 4. EVITAR SOBREPAGO DE CUOTA Y CRÉDITO
    // --------------------------------------------------------

    if (montoBase > saldoCuotaActual) {
      throw crearError(
        `El pago supera el saldo pendiente de la cuota. Saldo pendiente: C$${saldoCuotaActual.toFixed(2)}`,
        409
      );
    }

    if (montoBase > saldoCreditoActual) {
      throw crearError(
        `El pago supera el saldo pendiente del crédito. Saldo pendiente: C$${saldoCreditoActual.toFixed(2)}`,
        409
      );
    }

    // --------------------------------------------------------
    // 5. VALIDAR CAJA PARA EFECTIVO
    // --------------------------------------------------------

    let idSesionCaja = null;

    if (metodo === 'EFECTIVO') {
      idSesionCaja =
        Number(datos.id_sesion_caja);

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

      if (!sesion.caja_activa) {
        throw crearError(
          'La caja se encuentra inactiva'
        );
      }

      if (
        Number(sesion.id_sucursal) !==
        Number(cuota.id_sucursal)
      ) {
        throw crearError(
          'La sesión de caja no pertenece a la sucursal de la venta'
        );
      }
    }

    // --------------------------------------------------------
    // 6. VALIDAR REFERENCIA
    // --------------------------------------------------------

    const referencia =
      limpiarTexto(datos.referencia);

    if (
      [
        'TARJETA',
        'TRANSFERENCIA'
      ].includes(metodo) &&
      !referencia
    ) {
      throw crearError(
        `Debe indicar una referencia para pagos por ${metodo.toLowerCase()}`
      );
    }

    // --------------------------------------------------------
    // 7. CREAR PAGO
    // --------------------------------------------------------

    const idPago =
      await paymentRepository.crearPago(
        connection,
        {
          id_venta: cuota.id_venta,
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
    // 8. RELACIONAR PAGO CON CUOTA
    // --------------------------------------------------------

    await creditRepository.crearPagoCuota(
      connection,
      {
        id_cuota: cuota.id_cuota,
        id_pago: idPago,
        monto_aplicado: montoBase
      }
    );

    // --------------------------------------------------------
    // 9. ACTUALIZAR CUOTA
    // --------------------------------------------------------

    const nuevoMontoPagado = redondear(
      Number(cuota.monto_pagado) +
      montoBase
    );

    const nuevoSaldoCuota = redondear(
      saldoCuotaActual - montoBase
    );

    const nuevoEstadoCuota =
      nuevoSaldoCuota <= 0
        ? 'PAGADA'
        : 'PARCIAL';

    await creditRepository.actualizarCuotaPago(
      connection,
      cuota.id_cuota,
      nuevoMontoPagado,
      nuevoSaldoCuota,
      nuevoEstadoCuota
    );

    // --------------------------------------------------------
    // 10. ACTUALIZAR CRÉDITO
    // --------------------------------------------------------

    const nuevoSaldoCredito = redondear(
      saldoCreditoActual - montoBase
    );

    const nuevoEstadoCredito =
      nuevoSaldoCredito <= 0
        ? 'PAGADO'
        : 'ACTIVO';

    await creditRepository.actualizarSaldoCredito(
      connection,
      cuota.id_credito,
      nuevoSaldoCredito,
      nuevoEstadoCredito
    );

    // --------------------------------------------------------
    // 11. MOVIMIENTO DE CAJA SI ES EFECTIVO
    // --------------------------------------------------------

    if (metodo === 'EFECTIVO') {
      await paymentRepository.registrarMovimientoCaja(
        connection,
        {
          id_sesion_caja: idSesionCaja,
          id_usuario: idUsuario,
          monto: montoBase,
          id_pago: idPago,
          concepto:
            `Pago cuota ${cuota.numero_cuota} de crédito ${cuota.id_credito}`
        }
      );
    }

    await connection.commit();

    // --------------------------------------------------------
    // 12. RESPUESTA
    // --------------------------------------------------------

    const pago =
      await paymentRepository.obtenerPagoPorId(
        idPago
      );

    const credito =
      await obtenerCredito(
        cuota.id_credito
      );

    return {
      pago,
      cuota: {
        id_cuota: cuota.id_cuota,
        numero_cuota: cuota.numero_cuota,
        monto_cuota:
          Number(cuota.monto_cuota),
        monto_pagado:
          nuevoMontoPagado,
        saldo_cuota:
          nuevoSaldoCuota,
        estado:
          nuevoEstadoCuota
      },
      credito
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// ============================================================
// ANULAR CRÉDITO
// ============================================================

async function anularCredito(idCredito) {
  const connection =
    await creditRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = Number(idCredito);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      throw crearError(
        'El crédito indicado no es válido'
      );
    }

    const credito =
      await creditRepository.obtenerCreditoParaActualizar(
        connection,
        id
      );

    if (!credito) {
      throw crearError(
        'El crédito no existe',
        404
      );
    }

    if (credito.estado !== 'ACTIVO') {
      throw crearError(
        'Solo se puede anular un crédito activo',
        409
      );
    }

    const totalPagado =
      await creditRepository.obtenerTotalPagadoCredito(
        connection,
        id
      );

    if (totalPagado > 0) {
      throw crearError(
        `El crédito no puede anularse porque posee pagos aplicados por C$${totalPagado.toFixed(2)}`,
        409
      );
    }

    await creditRepository.anularCuotas(
      connection,
      id
    );

    const filasAfectadas =
      await creditRepository.anularCredito(
        connection,
        id
      );

    if (filasAfectadas !== 1) {
      throw crearError(
        'No fue posible anular el crédito',
        409
      );
    }

    await connection.commit();

    return obtenerCredito(id);

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

module.exports = {
  listarCreditos,
  obtenerCredito,
  crearCredito,
  pagarCuota,
  anularCredito
};