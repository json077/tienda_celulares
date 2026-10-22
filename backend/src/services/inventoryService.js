const inventoryRepository = require('../repositories/inventoryRepository');

async function listarInventario() {
  return inventoryRepository.obtenerInventario();
}

async function ajustarStock(datos, idUsuario) {
  const connection = await inventoryRepository.pool.getConnection();

  try {
    await connection.beginTransaction();

    const idSucursal = Number(datos.id_sucursal);
    const idProducto = Number(datos.id_producto);
    const cantidad = Number(datos.cantidad);

    const sucursal = await inventoryRepository.obtenerSucursal(
      connection,
      idSucursal
    );

    if (!sucursal || !sucursal.activo) {
      throw crearError('La sucursal no existe o está inactiva', 400);
    }

    const producto = await inventoryRepository.obtenerProducto(
      connection,
      idProducto
    );

    if (!producto || !producto.activo) {
      throw crearError('El producto no existe o está inactivo', 400);
    }

    if (producto.tipo_control !== 'CANTIDAD') {
      throw crearError(
        'Los productos SERIALIZADOS deben controlarse por unidad/IMEI',
        400
      );
    }

    let inventario = await inventoryRepository.obtenerStock(
      connection,
      idSucursal,
      idProducto
    );

    if (!inventario) {
      await inventoryRepository.crearInventario(
        connection,
        idSucursal,
        idProducto,
        0
      );

      inventario = await inventoryRepository.obtenerStock(
        connection,
        idSucursal,
        idProducto
      );
    }

    const stockAnterior = Number(inventario.stock_actual);

    let stockNuevo;
    let tipoMovimiento;
    let cantidadMovimiento;

    if (datos.tipo === 'ENTRADA') {
      stockNuevo = stockAnterior + cantidad;
      tipoMovimiento = 'AJUSTE_ENTRADA';
      cantidadMovimiento = cantidad;
    } else {
      if (cantidad > stockAnterior) {
        throw crearError(
          `Stock insuficiente. Disponible: ${stockAnterior}`,
          409
        );
      }

      stockNuevo = stockAnterior - cantidad;
      tipoMovimiento = 'AJUSTE_SALIDA';

      // En movimientos, las salidas quedan negativas.
      cantidadMovimiento = -cantidad;
    }

    await inventoryRepository.actualizarStock(
      connection,
      idSucursal,
      idProducto,
      stockNuevo
    );

    const idMovimiento =
      await inventoryRepository.registrarMovimiento(connection, {
        id_sucursal: idSucursal,
        id_producto: idProducto,
        id_usuario: idUsuario,
        tipo: tipoMovimiento,
        cantidad: cantidadMovimiento,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        observacion: datos.observacion
      });

    await connection.commit();

    return {
      id_movimiento: idMovimiento,
      id_sucursal: idSucursal,
      id_producto: idProducto,
      producto: producto.nombre,
      tipo: tipoMovimiento,
      cantidad: cantidadMovimiento,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function configurarStockMinimo(
  idSucursal,
  idProducto,
  stockMinimo
) {
  const affected = await inventoryRepository.actualizarStockMinimo(
    idSucursal,
    idProducto,
    stockMinimo
  );

  if (!affected) {
    throw crearError(
      'No existe inventario para ese producto en esa sucursal',
      404
    );
  }

  return {
    id_sucursal: Number(idSucursal),
    id_producto: Number(idProducto),
    stock_minimo: Number(stockMinimo)
  };
}

function crearError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function listarMovimientos() {
  return inventoryRepository.obtenerMovimientos();
}
module.exports = {
  listarInventario,
  ajustarStock,
  configurarStockMinimo,
  listarMovimientos
};
