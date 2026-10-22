const purchaseRepository = require('../repositories/purchaseRepository');

async function listarCompras() {
  const compras = await purchaseRepository.obtenerTodas();

  for (const compra of compras) {
    compra.detalles = await purchaseRepository.obtenerDetalles(
      compra.id_compra
    );
  }

  return compras;
}

async function obtenerCompra(idCompra) {
  const compra = await purchaseRepository.obtenerPorId(idCompra);

  if (!compra) {
    throw crearError('La compra no existe', 404);
  }

  compra.detalles = await purchaseRepository.obtenerDetalles(idCompra);

  return compra;
}

async function crearCompra(datos, idUsuario) {
  const connection = await purchaseRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idProveedor = Number(datos.id_proveedor);
    const idSucursal = Number(datos.id_sucursal);
    const numeroDocumento = limpiarTexto(datos.numero_documento);
    const observacion = limpiarTexto(datos.observacion);

    // 1. Validar proveedor
    const proveedor = await purchaseRepository.obtenerProveedor(
      connection,
      idProveedor
    );

    if (!proveedor) {
      throw crearError('El proveedor no existe', 400);
    }

    if (!proveedor.activo) {
      throw crearError('El proveedor se encuentra inactivo', 400);
    }

    // 2. Validar sucursal
    const sucursal = await purchaseRepository.obtenerSucursal(
      connection,
      idSucursal
    );

    if (!sucursal) {
      throw crearError('La sucursal no existe', 400);
    }

    if (!sucursal.activo) {
      throw crearError('La sucursal se encuentra inactiva', 400);
    }

    // 3. Validar número de documento
    if (!numeroDocumento) {
      throw crearError(
        'El número de documento de la compra es obligatorio',
        400
      );
    }

    // 4. Validar detalles
    if (!Array.isArray(datos.detalles) || datos.detalles.length === 0) {
      throw crearError(
        'La compra debe contener al menos un producto',
        400
      );
    }

    const detallesPreparados = [];

    let subtotalCompra = 0;
    let descuentoCompra = 0;
    let impuestoCompra = 0;
    let totalCompra = 0;

    for (const detalle of datos.detalles) {
      const idProducto = Number(detalle.id_producto);
      const cantidad = Number(detalle.cantidad);
      const costoUnitario = redondear(Number(detalle.costo_unitario));
      const descuento = redondear(Number(detalle.descuento || 0));
      const impuesto = redondear(Number(detalle.impuesto || 0));

      const producto = await purchaseRepository.obtenerProducto(
        connection,
        idProducto
      );

      if (!producto || !producto.activo) {
        throw crearError(
          `El producto con ID ${idProducto} no existe o está inactivo`,
          400
        );
      }

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw crearError(
          `La cantidad del producto ${producto.nombre} debe ser mayor que cero`,
          400
        );
      }

      if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
        throw crearError(
          `El costo unitario del producto ${producto.nombre} no es válido`,
          400
        );
      }

      if (!Number.isFinite(descuento) || descuento < 0) {
        throw crearError(
          `El descuento del producto ${producto.nombre} no es válido`,
          400
        );
      }

      if (!Number.isFinite(impuesto) || impuesto < 0) {
        throw crearError(
          `El impuesto del producto ${producto.nombre} no es válido`,
          400
        );
      }

      const importeBruto = redondear(cantidad * costoUnitario);

      if (descuento > importeBruto) {
        throw crearError(
          `El descuento del producto ${producto.nombre} supera su importe`,
          400
        );
      }

      const subtotalDetalle = redondear(
        importeBruto - descuento + impuesto
      );

      detallesPreparados.push({
        id_producto: idProducto,
        cantidad,
        costo_unitario: costoUnitario,
        descuento,
        impuesto,
        subtotal: subtotalDetalle
      });

      subtotalCompra = redondear(
        subtotalCompra + importeBruto
      );

      descuentoCompra = redondear(
        descuentoCompra + descuento
      );

      impuestoCompra = redondear(
        impuestoCompra + impuesto
      );

      totalCompra = redondear(
        totalCompra + subtotalDetalle
      );
    }

    // 5. Crear cabecera de compra
    const idCompra = await purchaseRepository.crearCompra(
      connection,
      {
        id_proveedor: idProveedor,
        id_sucursal: idSucursal,
        id_usuario: idUsuario,
        numero_documento: numeroDocumento,
        subtotal: subtotalCompra,
        descuento: descuentoCompra,
        impuesto: impuestoCompra,
        total: totalCompra,
        observacion
      }
    );

    // 6. Crear detalles
    for (const detalle of detallesPreparados) {
      await purchaseRepository.crearDetalle(
        connection,
        {
          id_compra: idCompra,
          ...detalle
        }
      );
    }

    // 7. Confirmar únicamente la creación del BORRADOR
    await connection.commit();

    const compra = await purchaseRepository.obtenerPorId(idCompra);

    compra.detalles = await purchaseRepository.obtenerDetalles(idCompra);

    return compra;
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}

async function confirmarCompra(idCompra, idUsuario, datos = {}) {
  const connection = await purchaseRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Bloquear y obtener la compra
    const compra = await purchaseRepository.obtenerCompraParaActualizar(
      connection,
      idCompra
    );

    if (!compra) {
      throw crearError('La compra no existe', 404);
    }

    if (compra.estado !== 'BORRADOR') {
      throw crearError(
        `La compra no puede confirmarse porque se encuentra en estado ${compra.estado}`,
        409
      );
    }

    // 2. Obtener detalles de la compra
    const detalles =
      await purchaseRepository.obtenerDetallesParaConfirmar(
        connection,
        idCompra
      );

    if (detalles.length === 0) {
      throw crearError('La compra no contiene productos', 400);
    }

    const unidades = Array.isArray(datos.unidades)
      ? datos.unidades
      : [];

    // Nos permite localizar rápidamente a qué detalle pertenece cada unidad.
    const detallesPorId = new Map(
      detalles.map((detalle) => [
        Number(detalle.id_detalle_compra),
        detalle
      ])
    );

    // IMEI y números de serie recibidos en esta misma petición.
    const imeisSolicitud = new Set();
    const seriesSolicitud = new Set();

    // 3. Validar productos
    for (const detalle of detalles) {
      if (!detalle.activo) {
        throw crearError(
          `El producto ${detalle.producto} se encuentra inactivo`,
          400
        );
      }
    }

    // 4. Validar que todas las unidades enviadas pertenezcan
    // realmente a un detalle SERIALIZADO de esta compra.
    for (const unidad of unidades) {
      const idDetalle = Number(unidad.id_detalle_compra);
      const detalle = detallesPorId.get(idDetalle);

      if (!detalle) {
        throw crearError(
          `El detalle de compra ${idDetalle} no pertenece a esta compra`,
          400
        );
      }

      if (detalle.tipo_control !== 'SERIALIZADO') {
        throw crearError(
          `El producto ${detalle.producto} no utiliza control por IMEI`,
          400
        );
      }

      const imei1 = String(unidad.imei1 || '').trim();
      const imei2 = unidad.imei2
        ? String(unidad.imei2).trim()
        : null;

      const numeroSerie = unidad.numero_serie
        ? String(unidad.numero_serie).trim()
        : null;

      if (!/^\d{15}$/.test(imei1)) {
        throw crearError(
          `El IMEI 1 del producto ${detalle.producto} debe contener exactamente 15 dígitos`,
          400
        );
      }

      if (imei2 && !/^\d{15}$/.test(imei2)) {
        throw crearError(
          `El IMEI 2 del producto ${detalle.producto} debe contener exactamente 15 dígitos`,
          400
        );
      }

      if (imei2 && imei1 === imei2) {
        throw crearError(
          'El IMEI 1 y el IMEI 2 de una unidad no pueden ser iguales',
          400
        );
      }

      // Evitar IMEI repetidos dentro de la propia solicitud.
      if (imeisSolicitud.has(imei1)) {
        throw crearError(
          `El IMEI ${imei1} está repetido en la solicitud`,
          409
        );
      }

      imeisSolicitud.add(imei1);

      if (imei2) {
        if (imeisSolicitud.has(imei2)) {
          throw crearError(
            `El IMEI ${imei2} está repetido en la solicitud`,
            409
          );
        }

        imeisSolicitud.add(imei2);
      }

      if (numeroSerie) {
        if (seriesSolicitud.has(numeroSerie)) {
          throw crearError(
            `El número de serie ${numeroSerie} está repetido en la solicitud`,
            409
          );
        }

        seriesSolicitud.add(numeroSerie);
      }
    }

    // 5. Cada detalle SERIALIZADO debe recibir exactamente
    // tantas unidades como indique su cantidad.
    for (const detalle of detalles) {
      if (detalle.tipo_control !== 'SERIALIZADO') {
        continue;
      }

      const unidadesDetalle = unidades.filter(
        (unidad) =>
          Number(unidad.id_detalle_compra) ===
          Number(detalle.id_detalle_compra)
      );

      if (unidadesDetalle.length !== Number(detalle.cantidad)) {
        throw crearError(
          `El producto ${detalle.producto} requiere exactamente ${detalle.cantidad} unidad(es) con IMEI`,
          400
        );
      }
    }

    // 6. Comprobar que los IMEI y números de serie no existan
    // previamente en la base de datos.
    for (const unidad of unidades) {
      const imei1 = String(unidad.imei1).trim();

      const imei2 = unidad.imei2
        ? String(unidad.imei2).trim()
        : null;

      const numeroSerie = unidad.numero_serie
        ? String(unidad.numero_serie).trim()
        : null;

      const existenteImei1 =
        await purchaseRepository.buscarUnidadPorImei(
          connection,
          imei1
        );

      if (existenteImei1) {
        throw crearError(
          `El IMEI ${imei1} ya se encuentra registrado`,
          409
        );
      }

      if (imei2) {
        const existenteImei2 =
          await purchaseRepository.buscarUnidadPorImei(
            connection,
            imei2
          );

        if (existenteImei2) {
          throw crearError(
            `El IMEI ${imei2} ya se encuentra registrado`,
            409
          );
        }
      }

      if (numeroSerie) {
        const existenteSerie =
          await purchaseRepository.buscarUnidadPorNumeroSerie(
            connection,
            numeroSerie
          );

        if (existenteSerie) {
          throw crearError(
            `El número de serie ${numeroSerie} ya se encuentra registrado`,
            409
          );
        }
      }
    }

    // 7. Procesar cada detalle de la compra
    for (const detalle of detalles) {
      let inventario = await purchaseRepository.obtenerStock(
        connection,
        compra.id_sucursal,
        detalle.id_producto
      );

      if (!inventario) {
        await purchaseRepository.crearInventario(
          connection,
          compra.id_sucursal,
          detalle.id_producto,
          0
        );

        inventario = await purchaseRepository.obtenerStock(
          connection,
          compra.id_sucursal,
          detalle.id_producto
        );
      }

      let stockActual = Number(inventario.stock_actual);

      // PRODUCTOS POR CANTIDAD
      if (detalle.tipo_control === 'CANTIDAD') {
        const cantidadEntrada = Number(detalle.cantidad);
        const stockNuevo = stockActual + cantidadEntrada;

        await purchaseRepository.actualizarStock(
          connection,
          compra.id_sucursal,
          detalle.id_producto,
          stockNuevo
        );

        await purchaseRepository.registrarMovimiento(
          connection,
          {
            id_sucursal: compra.id_sucursal,
            id_producto: detalle.id_producto,
            id_unidad: null,
            id_usuario: idUsuario,
            cantidad: cantidadEntrada,
            stock_anterior: stockActual,
            stock_nuevo: stockNuevo,
            id_compra: compra.id_compra,
            observacion: `Entrada por compra ${compra.numero_documento}`
          }
        );

        continue;
      }

      // PRODUCTOS SERIALIZADOS
      const unidadesDetalle = unidades.filter(
        (unidad) =>
          Number(unidad.id_detalle_compra) ===
          Number(detalle.id_detalle_compra)
      );

      for (const unidad of unidadesDetalle) {
        const idUnidad =
          await purchaseRepository.crearUnidadCompra(
            connection,
            {
              id_producto: detalle.id_producto,
              id_sucursal: compra.id_sucursal,
              id_detalle_compra: detalle.id_detalle_compra,
              imei1: String(unidad.imei1).trim(),
              imei2: unidad.imei2
                ? String(unidad.imei2).trim()
                : null,
              numero_serie: unidad.numero_serie
                ? String(unidad.numero_serie).trim()
                : null
            }
          );

        const stockNuevo = stockActual + 1;

        await purchaseRepository.actualizarStock(
          connection,
          compra.id_sucursal,
          detalle.id_producto,
          stockNuevo
        );

        await purchaseRepository.registrarMovimiento(
          connection,
          {
            id_sucursal: compra.id_sucursal,
            id_producto: detalle.id_producto,
            id_unidad: idUnidad,
            id_usuario: idUsuario,
            cantidad: 1,
            stock_anterior: stockActual,
            stock_nuevo: stockNuevo,
            id_compra: compra.id_compra,
            observacion: `Entrada de unidad serializada por compra ${compra.numero_documento}`
          }
        );

        stockActual = stockNuevo;
      }
    }

    // 8. Cambiar estado de la compra
    const filasActualizadas =
      await purchaseRepository.confirmarCompra(
        connection,
        idCompra
      );

    if (filasActualizadas !== 1) {
      throw crearError(
        'No fue posible confirmar la compra',
        409
      );
    }

    // 9. Todo salió correctamente
    await connection.commit();

    const compraConfirmada =
      await purchaseRepository.obtenerPorId(idCompra);

    compraConfirmada.detalles =
      await purchaseRepository.obtenerDetalles(idCompra);

    return compraConfirmada;
  } catch (error) {
    await connection.rollback();

    // Protección adicional por restricciones UNIQUE de MySQL.
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'No se pudo confirmar la compra porque existe un IMEI o número de serie duplicado',
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function anularCompra(idCompra) {
  const connection = await purchaseRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Obtener y bloquear la compra
    const compra = await purchaseRepository.obtenerCompraParaActualizar(
      connection,
      idCompra
    );

    if (!compra) {
      throw crearError('La compra no existe', 404);
    }

    // 2. Solo permitimos anular compras en BORRADOR por ahora
    if (compra.estado !== 'BORRADOR') {
      throw crearError(
        `La compra no puede anularse porque se encuentra en estado ${compra.estado}`,
        409
      );
    }

    // 3. Cambiar BORRADOR -> ANULADA
    const filasActualizadas = await purchaseRepository.anularCompra(
      connection,
      idCompra
    );

    if (filasActualizadas !== 1) {
      throw crearError(
        'No fue posible anular la compra',
        409
      );
    }

    await connection.commit();

    // 4. Devolver la compra actualizada
    const compraAnulada =
      await purchaseRepository.obtenerPorId(idCompra);

    compraAnulada.detalles =
      await purchaseRepository.obtenerDetalles(idCompra);

    return compraAnulada;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();

  return texto === '' ? null : texto;
}

function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function crearError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  listarCompras,
  obtenerCompra,
  crearCompra,
  confirmarCompra,
  anularCompra
};