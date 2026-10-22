// Catálogo cerrado de rutas reales. Los campos apuntan SOLO a la respuesta del servidor.
// No se conservan textos libres, cuerpos HTTP, cabeceras ni detalles completos.
const camposDocumento = {
  id_venta: 'id_venta', id_sucursal: 'id_sucursal', id_cliente: 'id_cliente',
  estado: 'estado', tipo_venta: 'tipo_venta', subtotal: 'subtotal',
  descuento: 'descuento', impuesto: 'impuesto', total: 'total'
};

function evento(metodo, ruta, modulo, accion, entidad, idRespuesta, campos = {}, opciones = {}) {
  const nombres = [];
  const patron = ruta.split('/').map((segmento) => {
    if (segmento.startsWith(':')) {
      nombres.push(segmento.slice(1));
      return '(\\d+)';
    }
    return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return Object.freeze({
    metodo, ruta, modulo, accion, entidad, idRespuesta,
    idParametro: opciones.idParametro || null,
    sucursalRespuesta: opciones.sucursalRespuesta || null,
    campos: Object.freeze({ ...campos }),
    anteriores: Object.freeze({ ...(opciones.anteriores || {}) }),
    nombres: Object.freeze(nombres), patron: new RegExp(`^${patron}/?$`, 'i')
  });
}

const eventos = Object.freeze([
  evento('POST', '/api/productos', 'PRODUCTOS', 'CREAR', 'productos', 'id_producto',
    { id_producto: 'id_producto', id_categoria: 'id_categoria', id_marca: 'id_marca',
      tipo_control: 'tipo_control', precio_venta: 'precio_venta', dias_garantia: 'dias_garantia', activo: 'activo' }),
  evento('PUT', '/api/productos/:id', 'PRODUCTOS', 'ACTUALIZAR', 'productos', 'id_producto',
    { id_producto: 'id_producto', precio_venta: 'precio_venta', dias_garantia: 'dias_garantia', activo: 'activo' }, { idParametro: 'id' }),
  evento('DELETE', '/api/productos/:id', 'PRODUCTOS', 'DESACTIVAR', 'productos', null, {}, { idParametro: 'id' }),
  evento('POST', '/api/categorias', 'CATEGORIAS', 'CREAR', 'categorias', 'id_categoria', { activo: 'activo' }),
  evento('PUT', '/api/categorias/:id', 'CATEGORIAS', 'ACTUALIZAR', 'categorias', 'id_categoria', { activo: 'activo' }, { idParametro: 'id' }),
  evento('DELETE', '/api/categorias/:id', 'CATEGORIAS', 'DESACTIVAR', 'categorias', null, {}, { idParametro: 'id' }),
  evento('POST', '/api/marcas', 'MARCAS', 'CREAR', 'marcas', 'id_marca', { activo: 'activo' }),
  evento('PUT', '/api/marcas/:id', 'MARCAS', 'ACTUALIZAR', 'marcas', 'id_marca', { activo: 'activo' }, { idParametro: 'id' }),
  evento('DELETE', '/api/marcas/:id', 'MARCAS', 'DESACTIVAR', 'marcas', null, {}, { idParametro: 'id' }),
  evento('POST', '/api/clientes', 'CLIENTES', 'CREAR', 'clientes', 'id_cliente', { activo: 'activo' }),
  evento('PUT', '/api/clientes/:idCliente', 'CLIENTES', 'ACTUALIZAR', 'clientes', 'id_cliente', { activo: 'activo' }, { idParametro: 'idCliente' }),
  evento('DELETE', '/api/clientes/:idCliente', 'CLIENTES', 'DESACTIVAR', 'clientes', 'id_cliente', { activo: 'activo' }, { idParametro: 'idCliente' }),
  evento('POST', '/api/proveedores', 'PROVEEDORES', 'CREAR', 'proveedores', 'id_proveedor', { activo: 'activo' }),
  evento('PUT', '/api/proveedores/:idProveedor', 'PROVEEDORES', 'ACTUALIZAR', 'proveedores', 'id_proveedor', { activo: 'activo' }, { idParametro: 'idProveedor' }),
  evento('DELETE', '/api/proveedores/:idProveedor', 'PROVEEDORES', 'DESACTIVAR', 'proveedores', 'id_proveedor', {}, { idParametro: 'idProveedor' }),
  evento('POST', '/api/inventario/ajustes', 'INVENTARIO', 'AJUSTAR_STOCK', 'movimientos_inventario', 'id_movimiento',
    { id_producto: 'id_producto', id_sucursal: 'id_sucursal', tipo: 'tipo', cantidad: 'cantidad', stock_nuevo: 'stock_nuevo' },
    { sucursalRespuesta: 'id_sucursal', anteriores: { stock_anterior: 'stock_anterior' } }),
  // inventario_sucursal tiene clave compuesta: id_entidad NULL; ambas claves en JSON.
  evento('PUT', '/api/inventario/:idSucursal/:idProducto/stock-minimo', 'INVENTARIO', 'CONFIGURAR_MINIMO', 'inventario_sucursal', null,
    { id_sucursal: 'id_sucursal', id_producto: 'id_producto', stock_minimo: 'stock_minimo' }, { sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/compras', 'COMPRAS', 'CREAR', 'compras', 'id_compra',
    { id_proveedor: 'id_proveedor', estado: 'estado', total: 'total' }, { sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/compras/:idCompra/confirmar', 'COMPRAS', 'CONFIRMAR', 'compras', 'id_compra',
    { estado: 'estado', total: 'total' }, { idParametro: 'idCompra', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/compras/:idCompra/anular', 'COMPRAS', 'ANULAR', 'compras', 'id_compra',
    { estado: 'estado', total: 'total' }, { idParametro: 'idCompra', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/ventas', 'VENTAS', 'CREAR', 'ventas', 'id_venta', camposDocumento, { sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/ventas/:idVenta/confirmar', 'VENTAS', 'CONFIRMAR', 'ventas', 'id_venta', camposDocumento,
    { idParametro: 'idVenta', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/ventas/:idVenta/anular', 'VENTAS', 'ANULAR', 'ventas', 'id_venta', camposDocumento,
    { idParametro: 'idVenta', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/pagos', 'PAGOS', 'REGISTRAR', 'pagos', 'pago.id_pago',
    { id_venta: 'pago.id_venta', id_moneda: 'pago.id_moneda', estado: 'pago.estado', metodo: 'pago.metodo',
      monto: 'pago.monto', monto_base: 'pago.monto_base', saldo_pendiente: 'saldo_pendiente' }),
  evento('POST', '/api/pagos/:idPago/anular', 'PAGOS', 'ANULAR', 'pagos', 'pago.id_pago',
    { id_venta: 'pago.id_venta', estado: 'pago.estado', monto_base: 'pago.monto_base', saldo_pendiente: 'saldo_pendiente' },
    { idParametro: 'idPago' }),
  evento('POST', '/api/creditos', 'CREDITOS', 'CREAR', 'creditos', 'id_credito',
    { id_venta: 'id_venta', estado: 'estado', monto_financiado: 'monto_financiado', monto_total: 'monto_total', saldo_pendiente: 'saldo_pendiente' }),
  evento('POST', '/api/creditos/cuotas/:idCuota/pagar', 'CREDITOS', 'PAGAR_CUOTA', 'cuotas_credito', 'cuota.id_cuota',
    { id_credito: 'credito.id_credito', id_pago: 'pago.id_pago', estado: 'cuota.estado',
      monto_pagado: 'cuota.monto_pagado', saldo_cuota: 'cuota.saldo_cuota' }, { idParametro: 'idCuota' }),
  evento('POST', '/api/creditos/:idCredito/anular', 'CREDITOS', 'ANULAR', 'creditos', 'id_credito',
    { id_venta: 'id_venta', estado: 'estado' }, { idParametro: 'idCredito' }),
  evento('POST', '/api/cajas/abrir', 'CAJA', 'ABRIR', 'sesiones_caja', 'id_sesion_caja',
    { id_caja: 'id_caja', estado: 'estado', monto_apertura: 'monto_apertura' }, { sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/cajas/sesiones/:idSesionCaja/cerrar', 'CAJA', 'CERRAR', 'sesiones_caja', 'sesion.id_sesion_caja',
    { estado: 'sesion.estado', monto_cierre_sistema: 'sesion.monto_cierre_sistema',
      monto_cierre_real: 'sesion.monto_cierre_real', diferencia: 'sesion.diferencia' },
    { idParametro: 'idSesionCaja', sucursalRespuesta: 'sesion.id_sucursal' }),
  evento('POST', '/api/cajas/sesiones/:idSesionCaja/movimientos', 'CAJA', 'MOVIMIENTO_MANUAL', 'movimientos_caja', 'movimiento.id_movimiento_caja',
    { id_sesion_caja: 'movimiento.id_sesion_caja', tipo: 'movimiento.tipo', monto: 'movimiento.monto', saldo_actual: 'saldo_actual' },
    { anteriores: { saldo_anterior: 'saldo_anterior' } }),
  evento('POST', '/api/transferencias', 'TRANSFERENCIAS', 'CREAR', 'transferencias', 'id_transferencia',
    { id_sucursal_origen: 'id_sucursal_origen', id_sucursal_destino: 'id_sucursal_destino', estado: 'estado' }),
  evento('POST', '/api/transferencias/:id/confirmar', 'TRANSFERENCIAS', 'CONFIRMAR', 'transferencias', 'id_transferencia',
    { id_sucursal_origen: 'id_sucursal_origen', id_sucursal_destino: 'id_sucursal_destino', estado: 'estado' }, { idParametro: 'id' }),
  evento('POST', '/api/transferencias/:id/anular', 'TRANSFERENCIAS', 'ANULAR', 'transferencias', 'id_transferencia',
    { id_sucursal_origen: 'id_sucursal_origen', id_sucursal_destino: 'id_sucursal_destino', estado: 'estado' }, { idParametro: 'id' }),
  evento('POST', '/api/devoluciones', 'DEVOLUCIONES', 'CREAR', 'devoluciones', 'id_devolucion',
    { id_venta: 'id_venta', estado: 'estado', total_devuelto: 'total_devuelto' }, { sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/devoluciones/:idDevolucion/confirmar', 'DEVOLUCIONES', 'CONFIRMAR', 'devoluciones', 'id_devolucion',
    { id_venta: 'id_venta', estado: 'estado', total_devuelto: 'total_devuelto' }, { idParametro: 'idDevolucion', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/devoluciones/:idDevolucion/anular', 'DEVOLUCIONES', 'ANULAR', 'devoluciones', 'id_devolucion',
    { id_venta: 'id_venta', estado: 'estado' }, { idParametro: 'idDevolucion', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/garantias', 'GARANTIAS', 'CREAR', 'garantias', 'id_garantia',
    { id_venta: 'id_venta', id_detalle_venta: 'id_detalle_venta', id_producto: 'id_producto',
      id_unidad: 'id_unidad', estado: 'estado', dias_garantia: 'dias_garantia' }),
  evento('POST', '/api/garantias/:idGarantia/reclamos', 'GARANTIAS', 'REGISTRAR_RECLAMO', 'reclamos_garantia', 'id_reclamo',
    { id_garantia: 'id_garantia', estado: 'estado' }, { sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/garantias/reclamos/:idReclamo/resolver', 'GARANTIAS', 'CAMBIAR_ESTADO_RECLAMO', 'reclamos_garantia', 'id_reclamo',
    { id_garantia: 'id_garantia', estado: 'estado', solucion: 'solucion' }, { idParametro: 'idReclamo', sucursalRespuesta: 'id_sucursal' }),
  evento('POST', '/api/tipos-cambio', 'TIPOS_CAMBIO', 'REGISTRAR', 'tipos_cambio', 'id_tipo_cambio',
    { id_moneda: 'id_moneda', tasa: 'tasa', activo: 'activo' })
]);

function buscarEvento(metodo, ruta) {
  for (const definicion of eventos) {
    if (definicion.metodo !== metodo) continue;
    const coincidencia = definicion.patron.exec(ruta);
    if (!coincidencia) continue;
    const parametros = Object.fromEntries(definicion.nombres.map((nombre, i) => [nombre, coincidencia[i + 1]]));
    return { definicion, parametros };
  }
  return null;
}

module.exports = { eventos, buscarEvento };
