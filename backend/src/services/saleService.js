const saleRepository = require('../repositories/saleRepository');

function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();

  return texto === '' ? null : texto;
}

function redondear(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// ============================================================
// LISTAR VENTAS
// ============================================================

async function listarVentas() {
  const ventas = await saleRepository.obtenerTodas();

  for (const venta of ventas) {
    venta.detalles = await saleRepository.obtenerDetalles(
      venta.id_venta
    );
  }

  return ventas;
}

// ============================================================
// OBTENER UNA VENTA
// ============================================================

async function obtenerVenta(idVenta) {
  const venta = await saleRepository.obtenerPorId(idVenta);

  if (!venta) {
    throw crearError('Venta no encontrada', 404);
  }

  venta.detalles = await saleRepository.obtenerDetalles(idVenta);

  return venta;
}

// ============================================================
// CREAR VENTA EN BORRADOR
// ============================================================

async function crearVenta(datos, idUsuario) {
  const connection = await saleRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------------------------------------------
    // Validar cliente
    // --------------------------------------------------------

    const cliente = await saleRepository.obtenerCliente(
      connection,
      datos.id_cliente
    );

    if (!cliente) {
      throw crearError('El cliente indicado no existe', 404);
    }

    if (!cliente.activo) {
      throw crearError(
        'El cliente indicado se encuentra inactivo',
        400
      );
    }

    // --------------------------------------------------------
    // Validar sucursal
    // --------------------------------------------------------

    const sucursal = await saleRepository.obtenerSucursal(
      connection,
      datos.id_sucursal
    );

    if (!sucursal) {
      throw crearError('La sucursal indicada no existe', 404);
    }

    if (!sucursal.activo) {
      throw crearError(
        'La sucursal indicada se encuentra inactiva',
        400
      );
    }

    // --------------------------------------------------------
    // Validar tipo de venta
    // --------------------------------------------------------

    const tipoVenta = String(datos.tipo_venta || '')
      .trim()
      .toUpperCase();

    if (!['CONTADO', 'CREDITO'].includes(tipoVenta)) {
      throw crearError(
        'El tipo de venta debe ser CONTADO o CREDITO',
        400
      );
    }

    // --------------------------------------------------------
    // Validar número de venta
    // --------------------------------------------------------

    const numeroVenta = limpiarTexto(datos.numero_venta);

    if (!numeroVenta) {
      throw crearError(
        'El número de venta es obligatorio',
        400
      );
    }

    // --------------------------------------------------------
    // Validar detalles
    // --------------------------------------------------------

    if (
      !Array.isArray(datos.detalles) ||
      datos.detalles.length === 0
    ) {
      throw crearError(
        'La venta debe contener al menos un producto',
        400
      );
    }

    const detallesPreparados = [];

    let subtotalGeneral = 0;
    let descuentoGeneral = 0;
    let impuestoGeneral = 0;
    let totalGeneral = 0;

    for (const detalle of datos.detalles) {
      const producto = await saleRepository.obtenerProducto(
        connection,
        detalle.id_producto
      );

      if (!producto) {
        throw crearError(
          `El producto con ID ${detalle.id_producto} no existe`,
          404
        );
      }

      if (!producto.activo) {
        throw crearError(
          `El producto ${producto.nombre} se encuentra inactivo`,
          400
        );
      }

      const cantidad = Number(detalle.cantidad);

      if (
        !Number.isInteger(cantidad) ||
        cantidad <= 0
      ) {
        throw crearError(
          `La cantidad del producto ${producto.nombre} debe ser un número entero mayor que cero`,
          400
        );
      }

      // El precio de venta se obtiene del servidor.
      // No confiamos en un precio enviado por el frontend.
      const precioUnitario = redondear(
        Number(producto.precio_venta)
      );

      const descuento = redondear(
        Number(detalle.descuento || 0)
      );

      const impuesto = redondear(
        Number(detalle.impuesto || 0)
      );

      if (descuento < 0) {
        throw crearError(
          `El descuento del producto ${producto.nombre} no puede ser negativo`,
          400
        );
      }

      if (impuesto < 0) {
        throw crearError(
          `El impuesto del producto ${producto.nombre} no puede ser negativo`,
          400
        );
      }

      const bruto = redondear(
        cantidad * precioUnitario
      );

      if (descuento > bruto) {
        throw crearError(
          `El descuento del producto ${producto.nombre} no puede superar el importe del producto`,
          400
        );
      }

      // ------------------------------------------------------
      // Validar política de descuento
      // ------------------------------------------------------

      if (
        descuento > 0 &&
        !Boolean(producto.permite_descuento)
      ) {
        throw crearError(
          `El producto ${producto.nombre} no permite descuentos`,
          400
        );
      }

      if (
        descuento > 0 &&
        Boolean(producto.permite_descuento)
      ) {
        const porcentajeMaximo = Number(
          producto.porcentaje_descuento_maximo || 0
        );

        const descuentoMaximo = redondear(
          bruto * (porcentajeMaximo / 100)
        );

        if (descuento > descuentoMaximo) {
          throw crearError(
            `El descuento del producto ${producto.nombre} supera el máximo permitido de ${porcentajeMaximo}%`,
            400
          );
        }
      }

      const subtotalLinea = redondear(
        bruto - descuento + impuesto
      );

      detallesPreparados.push({
        id_producto: producto.id_producto,
        cantidad,
        // El costo definitivo se asignará al confirmar.
        costo_unitario: 0,
        precio_unitario: precioUnitario,
        descuento,
        impuesto,
        subtotal: subtotalLinea,
        dias_garantia: Number(
          producto.dias_garantia || 0
        )
      });

      subtotalGeneral = redondear(
        subtotalGeneral + bruto
      );

      descuentoGeneral = redondear(
        descuentoGeneral + descuento
      );

      impuestoGeneral = redondear(
        impuestoGeneral + impuesto
      );

      totalGeneral = redondear(
        totalGeneral + subtotalLinea
      );
    }

    // --------------------------------------------------------
    // Crear encabezado
    // --------------------------------------------------------

    const idVenta = await saleRepository.crearVenta(
      connection,
      {
        id_cliente: datos.id_cliente,
        id_sucursal: datos.id_sucursal,
        id_usuario: idUsuario,
        numero_venta: numeroVenta,
        tipo_venta: tipoVenta,
        subtotal: subtotalGeneral,
        descuento: descuentoGeneral,
        impuesto: impuestoGeneral,
        total: totalGeneral,
        observacion: limpiarTexto(
          datos.observacion
        )
      }
    );

    // --------------------------------------------------------
    // Crear detalles
    // --------------------------------------------------------

    for (const detalle of detallesPreparados) {
      await saleRepository.crearDetalle(
        connection,
        {
          id_venta: idVenta,
          ...detalle
        }
      );
    }

    await connection.commit();

    return await obtenerVenta(idVenta);
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la creación de la venta:',
        rollbackError
      );
    }

    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'Ya existe una venta con ese número de venta',
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// CONFIRMAR VENTA
// ============================================================

async function confirmarVenta(
  idVenta,
  idUsuario,
  datos = {}
) {
  const connection = await saleRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------------------------------------------
    // Bloquear venta
    // --------------------------------------------------------

    const venta =
      await saleRepository.obtenerVentaParaActualizar(
        connection,
        idVenta
      );

    if (!venta) {
      throw crearError('Venta no encontrada', 404);
    }

    if (venta.estado !== 'BORRADOR') {
      throw crearError(
        `La venta no puede confirmarse porque se encuentra en estado ${venta.estado}`,
        400
      );
    }

    // --------------------------------------------------------
    // Obtener detalles
    // --------------------------------------------------------

    const detalles =
      await saleRepository.obtenerDetallesParaConfirmar(
        connection,
        idVenta
      );

    if (
      !Array.isArray(detalles) ||
      detalles.length === 0
    ) {
      throw crearError(
        'La venta no contiene productos para confirmar',
        400
      );
    }

    const unidadesSolicitadas =
      Array.isArray(datos.unidades)
        ? datos.unidades
        : [];

    const idsUnidadesRecibidos = new Set();

    // Guardaremos los detalles serializados válidos
    // pertenecientes a esta venta.
    const idsDetallesSerializados = new Set(
      detalles
        .filter(
          (detalle) =>
            detalle.tipo_control === 'SERIALIZADO'
        )
        .map((detalle) =>
          Number(detalle.id_detalle_venta)
        )
    );

    // --------------------------------------------------------
    // Procesar cada detalle
    // --------------------------------------------------------

    for (const detalle of detalles) {
      if (!detalle.activo) {
        throw crearError(
          `El producto ${detalle.producto} se encuentra inactivo`,
          400
        );
      }

      if (
        !['CANTIDAD', 'SERIALIZADO'].includes(
          detalle.tipo_control
        )
      ) {
        throw crearError(
          `El producto ${detalle.producto} tiene un tipo de control inválido`,
          400
        );
      }

      const cantidad = Number(detalle.cantidad);

      // ------------------------------------------------------
      // Bloquear inventario
      // ------------------------------------------------------

      const inventario =
        await saleRepository.obtenerStock(
          connection,
          venta.id_sucursal,
          detalle.id_producto
        );

      if (!inventario) {
        throw crearError(
          `No existe inventario del producto ${detalle.producto} en la sucursal`,
          400
        );
      }

      const stockActual = Number(
        inventario.stock_actual
      );

      if (stockActual < cantidad) {
        throw crearError(
          `Stock insuficiente para ${detalle.producto}. Disponible: ${stockActual}, solicitado: ${cantidad}`,
          400
        );
      }

      // ======================================================
      // PRODUCTO CONTROLADO POR CANTIDAD
      // ======================================================

      if (detalle.tipo_control === 'CANTIDAD') {
        // ----------------------------------------------------
        // Obtener costo histórico
        // ----------------------------------------------------

        const costoUnitario =
          await saleRepository.obtenerUltimoCostoProducto(
            connection,
            detalle.id_producto
          );

        await saleRepository.actualizarCostoDetalle(
          connection,
          detalle.id_detalle_venta,
          redondear(costoUnitario)
        );

        // ----------------------------------------------------
        // Descontar inventario
        // ----------------------------------------------------

        const stockNuevo =
          stockActual - cantidad;

        await saleRepository.actualizarStock(
          connection,
          venta.id_sucursal,
          detalle.id_producto,
          stockNuevo
        );

        // ----------------------------------------------------
        // Movimiento de inventario
        // ----------------------------------------------------

        await saleRepository.registrarMovimiento(
          connection,
          {
            id_sucursal: venta.id_sucursal,
            id_producto: detalle.id_producto,
            id_unidad: null,
            id_usuario: idUsuario,
            cantidad: -cantidad,
            stock_anterior: stockActual,
            stock_nuevo: stockNuevo,
            id_referencia: venta.id_venta,
            observacion:
              `Venta ${venta.numero_venta} - ${detalle.producto}`
          }
        );

        continue;
      }

      // ======================================================
      // PRODUCTO SERIALIZADO
      // ======================================================

      if (
        detalle.tipo_control === 'SERIALIZADO'
      ) {
        const unidadesDetalle =
          unidadesSolicitadas.filter(
            (unidad) =>
              Number(unidad.id_detalle_venta) ===
              Number(detalle.id_detalle_venta)
          );

        if (
          unidadesDetalle.length !== cantidad
        ) {
          throw crearError(
            `Debe seleccionar exactamente ${cantidad} unidad(es) para el producto ${detalle.producto}`,
            400
          );
        }

        let stockTemporal = stockActual;
        let costoTotalUnidades = 0;

        for (const unidadSolicitada of unidadesDetalle) {
          const idUnidad = Number(
            unidadSolicitada.id_unidad
          );

          if (
            !Number.isInteger(idUnidad) ||
            idUnidad <= 0
          ) {
            throw crearError(
              'Se recibió un identificador de unidad inválido',
              400
            );
          }

          // --------------------------------------------------
          // Evitar repetir la misma unidad en la petición
          // --------------------------------------------------

          if (
            idsUnidadesRecibidos.has(idUnidad)
          ) {
            throw crearError(
              `La unidad con ID ${idUnidad} fue seleccionada más de una vez`,
              400
            );
          }

          idsUnidadesRecibidos.add(idUnidad);

          // --------------------------------------------------
          // Bloquear unidad
          // --------------------------------------------------

          const unidad =
            await saleRepository.obtenerUnidadParaVenta(
              connection,
              idUnidad
            );

          if (!unidad) {
            throw crearError(
              `La unidad con ID ${idUnidad} no existe`,
              404
            );
          }

          // --------------------------------------------------
          // Validar producto
          // --------------------------------------------------

          if (
            Number(unidad.id_producto) !==
            Number(detalle.id_producto)
          ) {
            throw crearError(
              `La unidad con ID ${idUnidad} no pertenece al producto ${detalle.producto}`,
              400
            );
          }

          // --------------------------------------------------
          // Validar sucursal
          // --------------------------------------------------

          if (
            Number(
              unidad.id_sucursal_actual
            ) !==
            Number(venta.id_sucursal)
          ) {
            throw crearError(
              `La unidad con ID ${idUnidad} no se encuentra en la sucursal de la venta`,
              400
            );
          }

          // --------------------------------------------------
          // Validar estado
          // --------------------------------------------------

          if (
            unidad.estado !== 'DISPONIBLE'
          ) {
            throw crearError(
              `La unidad con ID ${idUnidad} no está disponible para la venta. Estado actual: ${unidad.estado}`,
              400
            );
          }

          // --------------------------------------------------
          // Protección adicional contra doble venta
          // --------------------------------------------------

          const yaAsignada =
            await saleRepository.unidadYaAsignadaAVenta(
              connection,
              idUnidad
            );

          if (yaAsignada) {
            throw crearError(
              `La unidad con ID ${idUnidad} ya se encuentra asociada a una venta confirmada`,
              409
            );
          }

          // --------------------------------------------------
          // Obtener costo histórico de la unidad
          // --------------------------------------------------

          let costoUnidad =
            await saleRepository.obtenerCostoUnidad(
              connection,
              idUnidad
            );

          // Si la unidad no está vinculada a una compra
          // (por ejemplo una unidad de prueba), usamos
          // como respaldo el último costo confirmado.
          if (costoUnidad === null) {
            costoUnidad =
              await saleRepository.obtenerUltimoCostoProducto(
                connection,
                detalle.id_producto
              );
          }

          costoTotalUnidades = redondear(
            costoTotalUnidades +
              Number(costoUnidad || 0)
          );

          // --------------------------------------------------
          // Asociar unidad con detalle de venta
          // --------------------------------------------------

          await saleRepository.asignarUnidadAVenta(
            connection,
            detalle.id_detalle_venta,
            idUnidad
          );

          // --------------------------------------------------
          // Marcar unidad como VENDIDO
          // --------------------------------------------------

          const actualizada =
            await saleRepository.marcarUnidadVendida(
              connection,
              idUnidad
            );

          if (!actualizada) {
            throw crearError(
              `La unidad con ID ${idUnidad} dejó de estar disponible durante la operación`,
              409
            );
          }

          // --------------------------------------------------
          // Descontar stock temporal
          // --------------------------------------------------

          const stockAnteriorUnidad =
            stockTemporal;

          stockTemporal -= 1;

          // --------------------------------------------------
          // Registrar movimiento por IMEI
          // --------------------------------------------------

          await saleRepository.registrarMovimiento(
            connection,
            {
              id_sucursal: venta.id_sucursal,
              id_producto:
                detalle.id_producto,
              id_unidad: idUnidad,
              id_usuario: idUsuario,
              cantidad: -1,
              stock_anterior:
                stockAnteriorUnidad,
              stock_nuevo: stockTemporal,
              id_referencia: venta.id_venta,
              observacion:
                `Venta ${venta.numero_venta} - unidad ${idUnidad} - ${detalle.producto}`
            }
          );
        }

        // ----------------------------------------------------
        // Actualizar inventario del producto serializado
        // ----------------------------------------------------

        await saleRepository.actualizarStock(
          connection,
          venta.id_sucursal,
          detalle.id_producto,
          stockTemporal
        );

        // ----------------------------------------------------
        // Guardar costo histórico promedio
        // ----------------------------------------------------

        const costoUnitarioPromedio =
          cantidad > 0
            ? redondear(
                costoTotalUnidades / cantidad
              )
            : 0;

        await saleRepository.actualizarCostoDetalle(
          connection,
          detalle.id_detalle_venta,
          costoUnitarioPromedio
        );
      }
    }

    // --------------------------------------------------------
    // Detectar unidades adicionales que no pertenecen a un
    // detalle serializado de esta venta
    // --------------------------------------------------------

    for (const unidadSolicitada of unidadesSolicitadas) {
      const idDetalleVenta = Number(
        unidadSolicitada.id_detalle_venta
      );

      if (
        !idsDetallesSerializados.has(
          idDetalleVenta
        )
      ) {
        throw crearError(
          `El detalle de venta ${idDetalleVenta} no corresponde a un producto serializado de esta venta`,
          400
        );
      }
    }

    // --------------------------------------------------------
    // Confirmar encabezado
    // --------------------------------------------------------

    const confirmada =
  await saleRepository.confirmarVenta(
    connection,
    idVenta
  );

if (!confirmada) {
  throw crearError(
    'No fue posible confirmar la venta',
    409
  );
}

// --------------------------------------------------------
// GENERAR FACTURA
// --------------------------------------------------------

const facturaExistente =
  await saleRepository.obtenerFacturaPorVenta(
    connection,
    idVenta
  );

if (facturaExistente) {
  throw crearError(
    'La venta ya posee una factura emitida',
    409
  );
}

// Generamos un número único a partir del ID de la venta.
// Ejemplo: venta 5 -> FAC-00000005
const numeroFactura =
  `FAC-${String(idVenta).padStart(8, '0')}`;

const nombreCliente = [
  venta.nombres,
  venta.apellidos
]
  .filter(Boolean)
  .join(' ')
  .trim();

await saleRepository.crearFactura(
  connection,
  {
    id_venta: idVenta,
    numero_factura: numeroFactura,
    serie: 'A',
    nombre_cliente: nombreCliente,
    identificacion_cliente:
      venta.identificacion,
    direccion_cliente:
      venta.direccion,
    subtotal: Number(venta.subtotal),
    descuento: Number(venta.descuento),
    impuesto: Number(venta.impuesto),
    total: Number(venta.total)
  }
);

await connection.commit();

    return await obtenerVenta(idVenta);
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la confirmación de la venta:',
        rollbackError
      );
    }

    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'Una de las unidades seleccionadas ya se encuentra asociada a una venta',
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// ANULAR VENTA
// ============================================================

// ============================================================
// ANULAR VENTA
// ============================================================

async function anularVenta(idVenta, idUsuario) {
  const connection = await saleRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------------------------------------------
    // Bloquear venta
    // --------------------------------------------------------

    const venta =
      await saleRepository.obtenerVentaParaActualizar(
        connection,
        idVenta
      );

    if (!venta) {
      throw crearError('Venta no encontrada', 404);
    }

    if (venta.estado !== 'CONFIRMADA') {
      throw crearError(
        `La venta no puede anularse porque se encuentra en estado ${venta.estado}`,
        400
      );
    }

    // --------------------------------------------------------
    // Validar pagos aplicados
    // --------------------------------------------------------

    const totalPagado =
      await saleRepository.obtenerTotalPagosAplicados(
        connection,
        idVenta
      );

    if (totalPagado > 0) {
      throw crearError(
        `La venta no puede anularse porque posee pagos aplicados por C$${redondear(totalPagado).toFixed(2)}. Anule primero los pagos de la venta`,
        409
      );
    }

    // --------------------------------------------------------
    // Obtener detalles de la venta
    // --------------------------------------------------------

    const detalles =
      await saleRepository.obtenerDetallesParaConfirmar(
        connection,
        idVenta
      );

    if (
      !Array.isArray(detalles) ||
      detalles.length === 0
    ) {
      throw crearError(
        'La venta no contiene productos para revertir',
        400
      );
    }

    // --------------------------------------------------------
    // Revertir inventario
    // --------------------------------------------------------

    for (const detalle of detalles) {
      const cantidad = Number(detalle.cantidad);

      // ======================================================
      // PRODUCTO CONTROLADO POR CANTIDAD
      // ======================================================

      if (detalle.tipo_control === 'CANTIDAD') {
        const inventario =
          await saleRepository.obtenerStock(
            connection,
            venta.id_sucursal,
            detalle.id_producto
          );

        if (!inventario) {
          throw crearError(
            `No existe inventario del producto ${detalle.producto} en la sucursal`,
            409
          );
        }

        const stockAnterior = Number(
          inventario.stock_actual
        );

        const stockNuevo =
          stockAnterior + cantidad;

        await saleRepository.actualizarStock(
          connection,
          venta.id_sucursal,
          detalle.id_producto,
          stockNuevo
        );

        await saleRepository.registrarMovimientoAnulacion(
          connection,
          {
            id_sucursal: venta.id_sucursal,
            id_producto: detalle.id_producto,
            id_unidad: null,
            id_usuario: idUsuario,
            cantidad,
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
            id_venta: venta.id_venta,
            observacion:
              `Anulación venta ${venta.numero_venta} - ${detalle.producto}`
          }
        );

        continue;
      }

      // ======================================================
      // PRODUCTO SERIALIZADO
      // ======================================================

      if (detalle.tipo_control === 'SERIALIZADO') {
        const unidades =
          await saleRepository.obtenerUnidadesParaAnular(
            connection,
            detalle.id_detalle_venta
          );

        if (unidades.length !== cantidad) {
          throw crearError(
            `La cantidad de unidades serializadas asociadas a ${detalle.producto} no coincide con la venta`,
            409
          );
        }

        const inventario =
          await saleRepository.obtenerStock(
            connection,
            venta.id_sucursal,
            detalle.id_producto
          );

        if (!inventario) {
          throw crearError(
            `No existe inventario del producto ${detalle.producto} en la sucursal`,
            409
          );
        }

        let stockTemporal = Number(
          inventario.stock_actual
        );

        for (const unidad of unidades) {
          // --------------------------------------------------
          // Validar producto de la unidad
          // --------------------------------------------------

          if (
            Number(unidad.id_producto) !==
            Number(detalle.id_producto)
          ) {
            throw crearError(
              `La unidad ${unidad.id_unidad} no pertenece al producto esperado`,
              409
            );
          }

          // --------------------------------------------------
          // Validar sucursal de la unidad
          // --------------------------------------------------

          if (
            Number(unidad.id_sucursal_actual) !==
            Number(venta.id_sucursal)
          ) {
            throw crearError(
              `La unidad ${unidad.id_unidad} no se encuentra en la sucursal de la venta`,
              409
            );
          }

          // --------------------------------------------------
          // Validar estado actual
          // --------------------------------------------------

          if (unidad.estado !== 'VENDIDO') {
            throw crearError(
              `La unidad ${unidad.id_unidad} no puede restaurarse porque se encuentra en estado ${unidad.estado}`,
              409
            );
          }

          // --------------------------------------------------
          // Restaurar unidad a DISPONIBLE
          // --------------------------------------------------

          const actualizada =
            await saleRepository.marcarUnidadDisponible(
              connection,
              unidad.id_unidad
            );

          if (!actualizada) {
            throw crearError(
              `No fue posible restaurar la unidad ${unidad.id_unidad}`,
              409
            );
          }

          // --------------------------------------------------
          // Aumentar stock temporal
          // --------------------------------------------------

          const stockAnteriorUnidad =
            stockTemporal;

          stockTemporal += 1;

          // --------------------------------------------------
          // Registrar movimiento de anulación por unidad
          // --------------------------------------------------

          await saleRepository.registrarMovimientoAnulacion(
            connection,
            {
              id_sucursal: venta.id_sucursal,
              id_producto: detalle.id_producto,
              id_unidad: unidad.id_unidad,
              id_usuario: idUsuario,
              cantidad: 1,
              stock_anterior:
                stockAnteriorUnidad,
              stock_nuevo:
                stockTemporal,
              id_venta: venta.id_venta,
              observacion:
                `Anulación venta ${venta.numero_venta} - unidad ${unidad.id_unidad} - ${detalle.producto}`
            }
          );
        }

        // ----------------------------------------------------
        // Guardar stock final del producto serializado
        // ----------------------------------------------------

        await saleRepository.actualizarStock(
          connection,
          venta.id_sucursal,
          detalle.id_producto,
          stockTemporal
        );

        continue;
      }

      // ------------------------------------------------------
      // Tipo de control desconocido
      // ------------------------------------------------------

      throw crearError(
        `El producto ${detalle.producto} tiene un tipo de control inválido`,
        409
      );
    }

    // --------------------------------------------------------
    // Anular factura
    // --------------------------------------------------------

    await saleRepository.anularFactura(
      connection,
      idVenta
    );

    // --------------------------------------------------------
    // Anular encabezado de venta
    // --------------------------------------------------------

    const anulada =
      await saleRepository.anularVenta(
        connection,
        idVenta
      );

    if (!anulada) {
      throw crearError(
        'No fue posible anular la venta',
        409
      );
    }

    // --------------------------------------------------------
    // Confirmar toda la transacción
    // --------------------------------------------------------

    await connection.commit();

    return await obtenerVenta(idVenta);

  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la anulación de la venta:',
        rollbackError
      );
    }

    throw error;

  } finally {
    connection.release();
  }
}

async function obtenerFactura(idVenta) {
  const venta = await saleRepository.obtenerPorId(idVenta);

  if (!venta) {
    throw crearError('Venta no encontrada', 404);
  }

  if (venta.estado !== 'CONFIRMADA') {
    throw crearError(
      'La factura solo está disponible para ventas confirmadas',
      400
    );
  }

  const factura =
    await saleRepository.obtenerFacturaCompleta(idVenta);

  if (!factura) {
    throw crearError(
      'La venta confirmada no posee una factura emitida',
      404
    );
  }

  const detalles =
    await saleRepository.obtenerDetalles(idVenta);

  for (const detalle of detalles) {
    if (detalle.tipo_control === 'SERIALIZADO') {
      detalle.unidades =
        await saleRepository.obtenerUnidadesVendidas(
          detalle.id_detalle_venta
        );
    } else {
      detalle.unidades = [];
    }
  }

  return {
    ...factura,
    detalles
  };
}

module.exports = {
  listarVentas,
  obtenerVenta,
  crearVenta,
  confirmarVenta,
  anularVenta,
  obtenerFactura
};