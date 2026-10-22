const serializedUnitRepository = require(
  '../repositories/serializedUnitRepository'
);

async function listarUnidades() {
  return serializedUnitRepository.obtenerTodas();
}

async function obtenerUnidad(idUnidad) {
  const unidad = await serializedUnitRepository.obtenerPorId(idUnidad);

  if (!unidad) {
    throw crearError('La unidad serializada no existe', 404);
  }

  return unidad;
}

async function registrarUnidad(datos, idUsuario) {
  const connection =
    await serializedUnitRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idProducto = Number(datos.id_producto);
    const idSucursal = Number(datos.id_sucursal);

    const imei1 = limpiarTexto(datos.imei1);
    const imei2 = limpiarTexto(datos.imei2);
    const numeroSerie = limpiarTexto(datos.numero_serie);

    // 1. Validar producto
    const producto =
      await serializedUnitRepository.obtenerProducto(
        connection,
        idProducto
      );

    if (!producto || !producto.activo) {
      throw crearError(
        'El producto no existe o está inactivo',
        400
      );
    }

    if (producto.tipo_control !== 'SERIALIZADO') {
      throw crearError(
        'Este producto no utiliza control por IMEI/unidad',
        400
      );
    }

    // 2. Validar sucursal
    const sucursal =
      await serializedUnitRepository.obtenerSucursal(
        connection,
        idSucursal
      );

    if (!sucursal || !sucursal.activo) {
      throw crearError(
        'La sucursal no existe o está inactiva',
        400
      );
    }

    // 3. IMEI1 obligatorio
    if (!imei1) {
      throw crearError(
        'El IMEI1 es obligatorio para productos serializados',
        400
      );
    }

    // 4. IMEI1 e IMEI2 no pueden ser iguales
    if (imei2 && imei1 === imei2) {
      throw crearError(
        'IMEI1 e IMEI2 no pueden ser iguales',
        400
      );
    }

    // 5. Verificar que IMEI1 no exista
    const existenteImei1 =
      await serializedUnitRepository.buscarPorImei(
        connection,
        imei1
      );

    if (existenteImei1) {
      throw crearError(
        `El IMEI ${imei1} ya está registrado`,
        409
      );
    }

    // 6. Verificar IMEI2, si fue enviado
    if (imei2) {
      const existenteImei2 =
        await serializedUnitRepository.buscarPorImei(
          connection,
          imei2
        );

      if (existenteImei2) {
        throw crearError(
          `El IMEI ${imei2} ya está registrado`,
          409
        );
      }
    }

    // 7. Verificar número de serie, si fue enviado
    if (numeroSerie) {
      const existenteSerie =
        await serializedUnitRepository.buscarPorNumeroSerie(
          connection,
          numeroSerie
        );

      if (existenteSerie) {
        throw crearError(
          `El número de serie ${numeroSerie} ya está registrado`,
          409
        );
      }
    }

    // 8. Obtener inventario actual
    let inventario =
      await serializedUnitRepository.obtenerStock(
        connection,
        idSucursal,
        idProducto
      );

    // Si todavía no existe inventario para ese producto/sucursal,
    // lo creamos con stock inicial 0.
    if (!inventario) {
      await serializedUnitRepository.crearInventario(
        connection,
        idSucursal,
        idProducto,
        0
      );

      inventario =
        await serializedUnitRepository.obtenerStock(
          connection,
          idSucursal,
          idProducto
        );
    }

    const stockAnterior = Number(inventario.stock_actual);
    const stockNuevo = stockAnterior + 1;

    // 9. Crear la unidad física
    const idUnidad =
      await serializedUnitRepository.crearUnidad(
        connection,
        {
          id_producto: idProducto,
          id_sucursal: idSucursal,
          id_detalle_compra: null,
          imei1,
          imei2,
          numero_serie: numeroSerie
        }
      );

    // 10. Actualizar stock
    await serializedUnitRepository.actualizarStock(
      connection,
      idSucursal,
      idProducto,
      stockNuevo
    );

    // 11. Registrar movimiento
    const idMovimiento =
      await serializedUnitRepository.registrarMovimiento(
        connection,
        {
          id_sucursal: idSucursal,
          id_producto: idProducto,
          id_unidad: idUnidad,
          id_usuario: idUsuario,
          tipo: 'AJUSTE_ENTRADA',
          cantidad: 1,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          observacion:
            datos.observacion ||
            'Registro inicial de unidad serializada'
        }
      );

    // 12. Todo salió correctamente
    await connection.commit();

    return {
      id_unidad: idUnidad,
      id_movimiento: idMovimiento,
      id_producto: idProducto,
      producto: producto.nombre,
      id_sucursal: idSucursal,
      sucursal: sucursal.nombre,
      imei1,
      imei2: imei2 || null,
      numero_serie: numeroSerie || null,
      estado: 'DISPONIBLE',
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo
    };
  } catch (error) {
    await connection.rollback();

    // Protección adicional ante restricciones UNIQUE de MySQL.
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError(
        'El IMEI o número de serie ya está registrado',
        409
      );
    }

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

function crearError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  listarUnidades,
  obtenerUnidad,
  registrarUnidad
};