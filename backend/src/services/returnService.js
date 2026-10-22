const returnRepository = require('../repositories/returnRepository');

function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function enteroPositivo(valor, nombre) {
  if (!['number', 'string'].includes(typeof valor) ||
      !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) {
    throw crearError(`${nombre} debe ser un entero positivo`);
  }
  return Number(valor);
}

function limpiarTexto(valor, nombre, maximo, obligatorio = false) {
  if (valor === undefined || valor === null) {
    if (obligatorio) throw crearError(`${nombre} es obligatorio`);
    return null;
  }
  if (typeof valor !== 'string' || valor.trim().length > maximo) {
    throw crearError(`${nombre} debe ser texto de hasta ${maximo} caracteres`);
  }
  const texto = valor.trim();
  if (!texto && obligatorio) throw crearError(`${nombre} es obligatorio`);
  return texto || null;
}

function booleano(valor) {
  if (valor === undefined) return true;
  if ([true, 1, '1', 'true'].includes(valor)) return true;
  if ([false, 0, '0', 'false'].includes(valor)) return false;
  throw crearError('reintegra_inventario debe ser un valor booleano');
}

function centavos(valor) {
  const numero = Number(valor);
  const resultado = Math.round((numero + Number.EPSILON) * 100);
  if (!Number.isFinite(numero) || numero < 0 ||
      !Number.isSafeInteger(resultado) || resultado > 99999999999999) {
    throw crearError('El importe histórico no es válido');
  }
  return resultado;
}

async function listarDevoluciones() {
  return returnRepository.obtenerTodas();
}

async function obtenerDevolucion(idDevolucion, connection) {
  const id = enteroPositivo(idDevolucion, 'El ID de la devolución');
  const devolucion = await returnRepository.obtenerPorId(id, connection);
  if (!devolucion) throw crearError('Devolución no encontrada', 404);
  devolucion.detalles = await returnRepository.obtenerDetalles(id, connection);
  return devolucion;
}

async function validarVenta(connection, idVenta) {
  // Este bloqueo serializa todas las devoluciones de una misma venta.
  const venta = await returnRepository.obtenerVentaParaActualizar(connection, idVenta);
  if (!venta) throw crearError('Venta no encontrada', 404);
  if (venta.estado !== 'CONFIRMADA') {
    throw crearError('La devolución requiere una venta CONFIRMADA', 409);
  }
  return venta;
}

async function prepararDetalles(connection, venta, detalles) {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw crearError('La devolución debe contener al menos un detalle');
  }

  const preparados = [];
  const cantidades = new Map();
  const detallesVenta = new Map();
  const unidades = new Set();
  let totalCentavos = 0;

  for (const datos of detalles) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw crearError('Cada detalle debe ser un objeto válido');
    }
    const idDetalleVenta = enteroPositivo(datos.id_detalle_venta, 'El detalle de venta');
    const cantidad = enteroPositivo(datos.cantidad, 'La cantidad');
    if (cantidad > 4294967295) throw crearError('La cantidad excede el máximo permitido');
    if (datos.condicion !== undefined && typeof datos.condicion !== 'string') {
      throw crearError('La condición debe ser APTO o DEFECTUOSO');
    }
    const condicion = datos.condicion === undefined
      ? 'APTO' : datos.condicion.trim().toUpperCase();
    if (!['APTO', 'DEFECTUOSO'].includes(condicion)) {
      throw crearError('La condición debe ser APTO o DEFECTUOSO');
    }
    const motivo = limpiarTexto(datos.motivo, 'El motivo del detalle', 500);
    let reintegra = booleano(datos.reintegra_inventario);

    let detalleVenta = detallesVenta.get(idDetalleVenta);
    if (!detalleVenta) {
      detalleVenta = await returnRepository.obtenerDetalleVentaParaActualizar(
        connection, idDetalleVenta
      );
      if (!detalleVenta) throw crearError('Detalle de venta no encontrado', 404);
      if (Number(detalleVenta.id_venta) !== Number(venta.id_venta)) {
        throw crearError('El detalle no pertenece a la venta indicada');
      }
      detallesVenta.set(idDetalleVenta, detalleVenta);
    }

    let idUnidad = null;
    if (detalleVenta.tipo_control === 'CANTIDAD') {
      if (datos.id_unidad !== undefined && datos.id_unidad !== null) {
        throw crearError('Los productos CANTIDAD no admiten id_unidad');
      }
      if (condicion === 'DEFECTUOSO') reintegra = false;
    } else if (detalleVenta.tipo_control === 'SERIALIZADO') {
      idUnidad = enteroPositivo(datos.id_unidad, 'La unidad serializada');
      if (cantidad !== 1) throw crearError('Una unidad serializada requiere cantidad 1');
      if (unidades.has(idUnidad)) {
        throw crearError('La unidad está repetida en la devolución', 409);
      }
      unidades.add(idUnidad);

      const unidad = await returnRepository.obtenerUnidadParaActualizar(connection, idUnidad);
      if (!unidad) throw crearError('Unidad no encontrada', 404);
      if (!await returnRepository.unidadPerteneceADetalle(connection, idDetalleVenta, idUnidad)) {
        throw crearError('La unidad no pertenece al detalle de venta indicado');
      }
      if (Number(unidad.id_producto) !== Number(detalleVenta.id_producto)) {
        throw crearError('La unidad no corresponde al producto vendido');
      }
      if (Number(unidad.id_sucursal_actual) !== Number(venta.id_sucursal)) {
        throw crearError('La unidad no está en la sucursal de la venta', 409);
      }
      if (await returnRepository.unidadYaDevuelta(connection, idUnidad)) {
        throw crearError('La unidad ya tiene una devolución CONFIRMADA', 409);
      }
      if (unidad.estado !== 'VENDIDO') {
        throw crearError(`La unidad debe estar VENDIDO. Estado actual: ${unidad.estado}`, 409);
      }
      reintegra = condicion === 'APTO';
    } else {
      throw crearError('El producto tiene un tipo de control inválido');
    }

    cantidades.set(idDetalleVenta, (cantidades.get(idDetalleVenta) || 0) + cantidad);
    const precioCentavos = centavos(detalleVenta.precio_unitario);
    const subtotalCentavos = precioCentavos * cantidad;
    totalCentavos += subtotalCentavos;
    if (!Number.isSafeInteger(totalCentavos) || totalCentavos > 99999999999999) {
      throw crearError('El total de la devolución excede el máximo permitido');
    }
    preparados.push({
      id_detalle_venta: idDetalleVenta,
      id_producto: detalleVenta.id_producto,
      id_unidad: idUnidad,
      cantidad,
      precio_unitario: precioCentavos / 100,
      subtotal: subtotalCentavos / 100,
      condicion,
      reintegra_inventario: reintegra ? 1 : 0,
      motivo
    });
  }

  // Suma también líneas repetidas del mismo detalle dentro de esta solicitud.
  for (const [idDetalleVenta, cantidad] of cantidades) {
    const devuelta = await returnRepository.obtenerCantidadDevuelta(connection, idDetalleVenta);
    if (cantidad + devuelta > Number(detallesVenta.get(idDetalleVenta).cantidad)) {
      throw crearError('La cantidad acumulada devuelta supera la cantidad vendida', 409);
    }
  }
  return { detalles: preparados, total_devuelto: totalCentavos / 100 };
}

async function crearDevolucion(datos, idUsuario) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw crearError('Datos de devolución inválidos');
  }
  const idVenta = enteroPositivo(datos.id_venta, 'La venta');
  const usuario = enteroPositivo(idUsuario, 'El usuario autenticado');
  const numero = limpiarTexto(datos.numero_devolucion, 'El número de devolución', 50, true);
  const motivo = limpiarTexto(datos.motivo, 'El motivo', 500, true);
  const observacion = limpiarTexto(datos.observacion, 'La observación', 500);
  const connection = await returnRepository.pool.getConnection();
  try {
    await connection.beginTransaction();
    const venta = await validarVenta(connection, idVenta);
    const preparados = await prepararDetalles(connection, venta, datos.detalles);
    const idDevolucion = await returnRepository.crearDevolucion(connection, {
      numero_devolucion: numero,
      id_venta: venta.id_venta,
      id_sucursal: venta.id_sucursal,
      id_usuario: usuario,
      motivo,
      observacion,
      total_devuelto: preparados.total_devuelto
    });
    for (const detalle of preparados.detalles) {
      await returnRepository.crearDetalle(connection, idDevolucion, detalle);
    }
    const devolucion = await obtenerDevolucion(idDevolucion, connection);
    await connection.commit();
    return devolucion;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError('Ya existe una devolución con ese número', 409);
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function confirmarDevolucion(idDevolucion, idUsuario) {
  const id = enteroPositivo(idDevolucion, 'El ID de la devolución');
  const usuario = enteroPositivo(idUsuario, 'El usuario autenticado');
  const connection = await returnRepository.pool.getConnection();
  try {
    await connection.beginTransaction();
    const referencia = await returnRepository.obtenerPorId(id, connection);
    if (!referencia) throw crearError('Devolución no encontrada', 404);
    // Primero la venta: otro borrador no debe retener su bloqueo mientras espera
    // esta venta, pues las lecturas de devoluciones previas también bloquean filas.
    const venta = await validarVenta(connection, referencia.id_venta);
    const devolucion = await returnRepository.obtenerParaActualizar(connection, id);
    if (!devolucion) throw crearError('Devolución no encontrada', 404);
    if (devolucion.estado !== 'BORRADOR') {
      throw crearError('Solo se puede confirmar una devolución BORRADOR', 409);
    }
    if (Number(devolucion.id_venta) !== Number(venta.id_venta) ||
        Number(devolucion.id_sucursal) !== Number(venta.id_sucursal)) {
      throw crearError('La devolución debe recibirse en la sucursal de la venta', 409);
    }
    const detalles = await returnRepository.obtenerDetallesParaActualizar(connection, id);
    // Revalida cantidades acumuladas, vínculo histórico y estado de cada unidad.
    const preparados = await prepararDetalles(connection, venta, detalles);
    for (let i = 0; i < detalles.length; i += 1) {
      const guardado = detalles[i];
      const preparado = preparados.detalles[i];
      if (Number(guardado.id_producto) !== Number(preparado.id_producto) ||
          centavos(guardado.precio_unitario) !== centavos(preparado.precio_unitario) ||
          centavos(guardado.subtotal) !== centavos(preparado.subtotal) ||
          Number(guardado.reintegra_inventario) !== preparado.reintegra_inventario) {
        throw crearError('El detalle guardado no coincide con la devolución validada', 409);
      }
    }
    if (centavos(devolucion.total_devuelto) !== centavos(preparados.total_devuelto)) {
      throw crearError('El total guardado no coincide con los detalles', 409);
    }

    for (const detalle of preparados.detalles) {
      if (detalle.id_unidad !== null) {
        const estado = detalle.condicion === 'APTO' ? 'DISPONIBLE' : 'DEFECTUOSO';
        const actualizada = await returnRepository.actualizarEstadoUnidad(
          connection, detalle.id_unidad, estado
        );
        if (actualizada !== 1) throw crearError('No fue posible actualizar la unidad', 409);
      }
      if (!detalle.reintegra_inventario) continue;

      let inventario = await returnRepository.obtenerStock(
        connection, venta.id_sucursal, detalle.id_producto
      );
      if (!inventario) {
        await returnRepository.crearInventario(connection, venta.id_sucursal, detalle.id_producto);
        inventario = await returnRepository.obtenerStock(
          connection, venta.id_sucursal, detalle.id_producto
        );
      }
      const stockAnterior = Number(inventario.stock_actual);
      const stockNuevo = stockAnterior + detalle.cantidad;
      if (!Number.isSafeInteger(stockNuevo) || stockNuevo > 4294967295) {
        throw crearError('El stock resultante excede el máximo permitido');
      }
      await returnRepository.actualizarStock(
        connection, venta.id_sucursal, detalle.id_producto, stockNuevo
      );
      await returnRepository.registrarMovimiento(connection, {
        id_sucursal: venta.id_sucursal,
        id_producto: detalle.id_producto,
        id_unidad: detalle.id_unidad,
        id_usuario: usuario,
        cantidad: detalle.cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        id_devolucion: id,
        observacion: `Devolución ${devolucion.numero_devolucion}`
      });
    }
    if (await returnRepository.cambiarEstado(connection, id, 'CONFIRMADA') !== 1) {
      throw crearError('No fue posible confirmar la devolución', 409);
    }
    const resultado = await obtenerDevolucion(id, connection);
    await connection.commit();
    return resultado;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function anularDevolucion(idDevolucion) {
  const id = enteroPositivo(idDevolucion, 'El ID de la devolución');
  const connection = await returnRepository.pool.getConnection();
  try {
    await connection.beginTransaction();
    const devolucion = await returnRepository.obtenerParaActualizar(connection, id);
    if (!devolucion) throw crearError('Devolución no encontrada', 404);
    if (devolucion.estado !== 'BORRADOR') {
      throw crearError('Solo se puede anular una devolución BORRADOR', 409);
    }
    if (await returnRepository.cambiarEstado(connection, id, 'ANULADA') !== 1) {
      throw crearError('No fue posible anular la devolución', 409);
    }
    const resultado = await obtenerDevolucion(id, connection);
    await connection.commit();
    return resultado;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listarDevoluciones, obtenerDevolucion, crearDevolucion,
  confirmarDevolucion, anularDevolucion
};
