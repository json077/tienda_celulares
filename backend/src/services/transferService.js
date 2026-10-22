const transferRepository =
  require('../repositories/transferRepository');

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

// ============================================================
// LISTAR
// ============================================================

async function listarTransferencias() {
  return transferRepository.obtenerTodas();
}

// ============================================================
// OBTENER UNA TRANSFERENCIA COMPLETA
// ============================================================

async function obtenerTransferencia(idTransferencia) {
  const transferencia =
    await transferRepository.obtenerPorId(idTransferencia);

  if (!transferencia) {
    throw crearError('Transferencia no encontrada', 404);
  }

  const detalles =
    await transferRepository.obtenerDetalles(idTransferencia);

  for (const detalle of detalles) {
    if (detalle.tipo_control === 'SERIALIZADO') {
      detalle.unidades =
        await transferRepository.obtenerUnidadesDetalle(
          detalle.id_detalle_transferencia
        );
    } else {
      detalle.unidades = [];
    }
  }

  transferencia.detalles = detalles;

  return transferencia;
}

// ============================================================
// CREAR BORRADOR
// ============================================================

async function crearTransferencia(datos, idUsuario) {
  const connection =
    await transferRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idSucursalOrigen =
      Number(datos.id_sucursal_origen);

    const idSucursalDestino =
      Number(datos.id_sucursal_destino);

    if (
      !Number.isInteger(idSucursalOrigen) ||
      idSucursalOrigen <= 0
    ) {
      throw crearError(
        'La sucursal de origen no es válida',
        400
      );
    }

    if (
      !Number.isInteger(idSucursalDestino) ||
      idSucursalDestino <= 0
    ) {
      throw crearError(
        'La sucursal de destino no es válida',
        400
      );
    }

    if (idSucursalOrigen === idSucursalDestino) {
      throw crearError(
        'La sucursal de origen y destino deben ser diferentes',
        400
      );
    }

    const sucursalOrigen =
      await transferRepository.obtenerSucursal(
        connection,
        idSucursalOrigen
      );

    if (!sucursalOrigen || !sucursalOrigen.activo) {
      throw crearError(
        'La sucursal de origen no existe o está inactiva',
        400
      );
    }

    const sucursalDestino =
      await transferRepository.obtenerSucursal(
        connection,
        idSucursalDestino
      );

    if (!sucursalDestino || !sucursalDestino.activo) {
      throw crearError(
        'La sucursal de destino no existe o está inactiva',
        400
      );
    }

    if (
      !Array.isArray(datos.detalles) ||
      datos.detalles.length === 0
    ) {
      throw crearError(
        'La transferencia debe contener al menos un producto',
        400
      );
    }

    const productosUsados = new Set();
    const unidadesUsadas = new Set();

    // --------------------------------------------------------
    // Validar todo antes de insertar
    // --------------------------------------------------------

    for (const detalle of datos.detalles) {
      const idProducto = Number(detalle.id_producto);

      if (
        !Number.isInteger(idProducto) ||
        idProducto <= 0
      ) {
        throw crearError(
          'Existe un producto inválido en la transferencia',
          400
        );
      }

      if (productosUsados.has(idProducto)) {
        throw crearError(
          `El producto ${idProducto} está repetido en la transferencia`,
          400
        );
      }

      productosUsados.add(idProducto);

      const producto =
        await transferRepository.obtenerProducto(
          connection,
          idProducto
        );

      if (!producto || !producto.activo) {
        throw crearError(
          `El producto ${idProducto} no existe o está inactivo`,
          400
        );
      }

      if (producto.tipo_control === 'CANTIDAD') {
        const cantidad = Number(detalle.cantidad);

        if (
          !Number.isInteger(cantidad) ||
          cantidad <= 0
        ) {
          throw crearError(
            `La cantidad de ${producto.nombre} debe ser un entero mayor que cero`,
            400
          );
        }

        const inventarioOrigen =
          await transferRepository.obtenerStock(
            connection,
            idSucursalOrigen,
            idProducto
          );

        const disponible = inventarioOrigen
          ? Number(inventarioOrigen.stock_actual)
          : 0;

        if (cantidad > disponible) {
          throw crearError(
            `Stock insuficiente para ${producto.nombre}. Disponible: ${disponible}`,
            409
          );
        }
      } else if (
        producto.tipo_control === 'SERIALIZADO'
      ) {
        if (
          !Array.isArray(detalle.unidades) ||
          detalle.unidades.length === 0
        ) {
          throw crearError(
            `Debe seleccionar las unidades/IMEI de ${producto.nombre}`,
            400
          );
        }

        if (
          detalle.cantidad !== undefined &&
          Number(detalle.cantidad) !== detalle.unidades.length
        ) {
          throw crearError(
            `La cantidad de ${producto.nombre} no coincide con las unidades seleccionadas`,
            400
          );
        }

        for (const idUnidadOriginal of detalle.unidades) {
          const idUnidad = Number(idUnidadOriginal);

          if (
            !Number.isInteger(idUnidad) ||
            idUnidad <= 0
          ) {
            throw crearError(
              `Existe una unidad inválida para ${producto.nombre}`,
              400
            );
          }

          if (unidadesUsadas.has(idUnidad)) {
            throw crearError(
              `La unidad ${idUnidad} está repetida en la transferencia`,
              400
            );
          }

          unidadesUsadas.add(idUnidad);

          const unidad =
            await transferRepository.obtenerUnidad(
              connection,
              idUnidad
            );

          if (!unidad) {
            throw crearError(
              `La unidad ${idUnidad} no existe`,
              404
            );
          }

          if (
            Number(unidad.id_producto) !== idProducto
          ) {
            throw crearError(
              `La unidad ${idUnidad} no pertenece a ${producto.nombre}`,
              409
            );
          }

          if (
            Number(unidad.id_sucursal_actual) !==
            idSucursalOrigen
          ) {
            throw crearError(
              `La unidad ${idUnidad} no se encuentra en la sucursal de origen`,
              409
            );
          }

          if (unidad.estado !== 'DISPONIBLE') {
            throw crearError(
              `La unidad ${idUnidad} no está disponible para transferirse`,
              409
            );
          }
        }
      } else {
        throw crearError(
          `Tipo de control no soportado para ${producto.nombre}`,
          400
        );
      }
    }

    // --------------------------------------------------------
    // Crear cabecera
    // --------------------------------------------------------

    const numeroTransferencia =
      limpiarTexto(datos.numero_transferencia);

    if (!numeroTransferencia) {
      throw crearError(
        'El número de transferencia es obligatorio',
        400
      );
    }

    const idTransferencia =
      await transferRepository.crearTransferencia(
        connection,
        {
          numero_transferencia: numeroTransferencia,
          id_sucursal_origen: idSucursalOrigen,
          id_sucursal_destino: idSucursalDestino,
          id_usuario_solicita: idUsuario,
          observacion: limpiarTexto(datos.observacion)
        }
      );

    // --------------------------------------------------------
    // Crear detalles
    // --------------------------------------------------------

    for (const detalle of datos.detalles) {
      const idProducto = Number(detalle.id_producto);

      const producto =
        await transferRepository.obtenerProducto(
          connection,
          idProducto
        );

      const cantidad =
        producto.tipo_control === 'SERIALIZADO'
          ? detalle.unidades.length
          : Number(detalle.cantidad);

      const idDetalle =
        await transferRepository.crearDetalle(
          connection,
          {
            id_transferencia: idTransferencia,
            id_producto: idProducto,
            cantidad
          }
        );

      if (producto.tipo_control === 'SERIALIZADO') {
        for (const idUnidad of detalle.unidades) {
          await transferRepository.crearTransferenciaUnidad(
            connection,
            {
              id_detalle_transferencia: idDetalle,
              id_unidad: Number(idUnidad)
            }
          );
        }
      }
    }

    await connection.commit();

    return obtenerTransferencia(idTransferencia);
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'El número de transferencia ya existe o existe un dato duplicado',
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// CONFIRMAR TRANSFERENCIA
// ============================================================

async function confirmarTransferencia(
  idTransferencia,
  idUsuario
) {
  const connection =
    await transferRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const transferencia =
      await transferRepository.obtenerParaActualizar(
        connection,
        idTransferencia
      );

    if (!transferencia) {
      throw crearError(
        'Transferencia no encontrada',
        404
      );
    }

    if (transferencia.estado !== 'BORRADOR') {
      throw crearError(
        `La transferencia no puede confirmarse porque está ${transferencia.estado}`,
        409
      );
    }

    const detalles =
      await transferRepository.obtenerDetallesParaActualizar(
        connection,
        idTransferencia
      );

    if (detalles.length === 0) {
      throw crearError(
        'La transferencia no contiene productos',
        409
      );
    }

    for (const detalle of detalles) {
      if (!detalle.activo) {
        throw crearError(
          `El producto ${detalle.producto} está inactivo`,
          409
        );
      }

      let inventarioOrigen =
        await transferRepository.obtenerStock(
          connection,
          transferencia.id_sucursal_origen,
          detalle.id_producto
        );

      if (!inventarioOrigen) {
        throw crearError(
          `No existe inventario de origen para ${detalle.producto}`,
          409
        );
      }

      let inventarioDestino =
        await transferRepository.obtenerStock(
          connection,
          transferencia.id_sucursal_destino,
          detalle.id_producto
        );

      if (!inventarioDestino) {
        await transferRepository.crearInventario(
          connection,
          transferencia.id_sucursal_destino,
          detalle.id_producto
        );

        inventarioDestino =
          await transferRepository.obtenerStock(
            connection,
            transferencia.id_sucursal_destino,
            detalle.id_producto
          );
      }

      const stockOrigenAnterior =
        Number(inventarioOrigen.stock_actual);

      const stockDestinoAnterior =
        Number(inventarioDestino.stock_actual);

      const cantidad = Number(detalle.cantidad);

      if (cantidad > stockOrigenAnterior) {
        throw crearError(
          `Stock insuficiente para ${detalle.producto}. Disponible: ${stockOrigenAnterior}`,
          409
        );
      }

      if (detalle.tipo_control === 'CANTIDAD') {
        const stockOrigenNuevo =
          stockOrigenAnterior - cantidad;

        const stockDestinoNuevo =
          stockDestinoAnterior + cantidad;

        await transferRepository.actualizarStock(
          connection,
          transferencia.id_sucursal_origen,
          detalle.id_producto,
          stockOrigenNuevo
        );

        await transferRepository.actualizarStock(
          connection,
          transferencia.id_sucursal_destino,
          detalle.id_producto,
          stockDestinoNuevo
        );

        await transferRepository.registrarMovimiento(
          connection,
          {
            id_sucursal:
              transferencia.id_sucursal_origen,
            id_producto: detalle.id_producto,
            id_usuario: idUsuario,
            tipo: 'TRANSFERENCIA_SALIDA',
            cantidad: -cantidad,
            stock_anterior: stockOrigenAnterior,
            stock_nuevo: stockOrigenNuevo,
            id_transferencia: Number(idTransferencia),
            observacion:
              `Transferencia ${transferencia.numero_transferencia} hacia sucursal ${transferencia.id_sucursal_destino}`
          }
        );

        await transferRepository.registrarMovimiento(
          connection,
          {
            id_sucursal:
              transferencia.id_sucursal_destino,
            id_producto: detalle.id_producto,
            id_usuario: idUsuario,
            tipo: 'TRANSFERENCIA_ENTRADA',
            cantidad,
            stock_anterior: stockDestinoAnterior,
            stock_nuevo: stockDestinoNuevo,
            id_transferencia: Number(idTransferencia),
            observacion:
              `Transferencia ${transferencia.numero_transferencia} desde sucursal ${transferencia.id_sucursal_origen}`
          }
        );
      } else if (
        detalle.tipo_control === 'SERIALIZADO'
      ) {
        const unidades =
          await transferRepository
            .obtenerUnidadesDetalleParaActualizar(
              connection,
              detalle.id_detalle_transferencia
            );

        if (unidades.length !== cantidad) {
          throw crearError(
            `Las unidades seleccionadas de ${detalle.producto} no coinciden con la cantidad`,
            409
          );
        }

        for (const unidad of unidades) {
          if (
            Number(unidad.id_producto) !==
            Number(detalle.id_producto)
          ) {
            throw crearError(
              `La unidad ${unidad.id_unidad} no pertenece al producto correcto`,
              409
            );
          }

          if (
            Number(unidad.id_sucursal_actual) !==
            Number(transferencia.id_sucursal_origen)
          ) {
            throw crearError(
              `La unidad ${unidad.id_unidad} ya no se encuentra en la sucursal de origen`,
              409
            );
          }

          if (unidad.estado !== 'DISPONIBLE') {
            throw crearError(
              `La unidad ${unidad.id_unidad} ya no está disponible`,
              409
            );
          }
        }

        const stockOrigenNuevo =
          stockOrigenAnterior - cantidad;

        const stockDestinoNuevo =
          stockDestinoAnterior + cantidad;

        await transferRepository.actualizarStock(
          connection,
          transferencia.id_sucursal_origen,
          detalle.id_producto,
          stockOrigenNuevo
        );

        await transferRepository.actualizarStock(
          connection,
          transferencia.id_sucursal_destino,
          detalle.id_producto,
          stockDestinoNuevo
        );

        let stockOrigenTemporal = stockOrigenAnterior;
        let stockDestinoTemporal = stockDestinoAnterior;

        for (const unidad of unidades) {
          const stockOrigenSiguiente =
            stockOrigenTemporal - 1;

          const stockDestinoSiguiente =
            stockDestinoTemporal + 1;

          await transferRepository.moverUnidad(
            connection,
            unidad.id_unidad,
            transferencia.id_sucursal_destino
          );

          await transferRepository.registrarMovimiento(
            connection,
            {
              id_sucursal:
                transferencia.id_sucursal_origen,
              id_producto: detalle.id_producto,
              id_unidad: unidad.id_unidad,
              id_usuario: idUsuario,
              tipo: 'TRANSFERENCIA_SALIDA',
              cantidad: -1,
              stock_anterior: stockOrigenTemporal,
              stock_nuevo: stockOrigenSiguiente,
              id_transferencia: Number(idTransferencia),
              observacion:
                `Transferencia ${transferencia.numero_transferencia} hacia sucursal ${transferencia.id_sucursal_destino}`
            }
          );

          await transferRepository.registrarMovimiento(
            connection,
            {
              id_sucursal:
                transferencia.id_sucursal_destino,
              id_producto: detalle.id_producto,
              id_unidad: unidad.id_unidad,
              id_usuario: idUsuario,
              tipo: 'TRANSFERENCIA_ENTRADA',
              cantidad: 1,
              stock_anterior: stockDestinoTemporal,
              stock_nuevo: stockDestinoSiguiente,
              id_transferencia: Number(idTransferencia),
              observacion:
                `Transferencia ${transferencia.numero_transferencia} desde sucursal ${transferencia.id_sucursal_origen}`
            }
          );

          stockOrigenTemporal = stockOrigenSiguiente;
          stockDestinoTemporal = stockDestinoSiguiente;
        }
      } else {
        throw crearError(
          `Tipo de control inválido para ${detalle.producto}`,
          409
        );
      }
    }

    const affected =
      await transferRepository.confirmarTransferencia(
        connection,
        idTransferencia,
        idUsuario
      );

    if (!affected) {
      throw crearError(
        'No fue posible confirmar la transferencia',
        409
      );
    }

    await connection.commit();

    return obtenerTransferencia(idTransferencia);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// ANULAR BORRADOR
// ============================================================

async function anularTransferencia(idTransferencia) {
  const connection =
    await transferRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const transferencia =
      await transferRepository.obtenerParaActualizar(
        connection,
        idTransferencia
      );

    if (!transferencia) {
      throw crearError(
        'Transferencia no encontrada',
        404
      );
    }

    if (transferencia.estado !== 'BORRADOR') {
      throw crearError(
        `Solo se pueden anular transferencias en BORRADOR. Estado actual: ${transferencia.estado}`,
        409
      );
    }

    const affected =
      await transferRepository.anularTransferencia(
        connection,
        idTransferencia
      );

    if (!affected) {
      throw crearError(
        'No fue posible anular la transferencia',
        409
      );
    }

    await connection.commit();

    return obtenerTransferencia(idTransferencia);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listarTransferencias,
  obtenerTransferencia,
  crearTransferencia,
  confirmarTransferencia,
  anularTransferencia
};