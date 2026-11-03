// Shared presentation contract for JSON, UI and XLSX. Only whitelisted fields leave SQL.
const col = (key, label, type = 'text') => ({ key, label, type });
const money = (key, label) => col(key, `${label} (NIO)`, 'money');
const states = ['CONFIRMADA', 'BORRADOR', 'ANULADA'];
const definitions = {
  antiguedad_imei: {
    title: 'Antigüedad de inventario por IMEI', product: true, dates: false,
    ageRanges: ['Reciente', 'Seguimiento', 'Inventario lento', 'Revisar', 'No determinada'],
    note: 'Solo unidades DISPONIBLES de productos serializados activos. Ingreso verificado por un único movimiento COMPRA de la unidad coincidente con su compra confirmada. Sin evidencia suficiente: No determinada. Días calendario según CURRENT_DATE() y la zona horaria de la sesión del servidor de base de datos. Transferencias y devoluciones no reinician la antigüedad. No representa depreciación ni pérdidas.',
    columns: [col('producto', 'Producto'), col('sku', 'SKU'), col('identificador', 'IMEI / serie'), col('sucursal', 'Sucursal actual'), col('fecha_ingreso', 'Ingreso original'), col('dias', 'Días transcurridos', 'age'), col('clasificacion', 'Clasificación'), col('procedencia', 'Compra / procedencia')],
    sums: [],
  },
  costos_adquisicion: {
    title: 'Historial de costos de adquisición', product: true, supplier: true, currency: 'C$',
    note: 'Solo compras CONFIRMADAS. Fecha de compra corresponde a compras.fecha, no a una fecha de confirmación. Los importes son los registrados en detalle_compras; el costo unitario no descuenta descuentos ni incorpora cargos adicionales.',
    columns: [col('fecha', 'Fecha de compra'), col('numero', 'Referencia de compra'), col('sucursal', 'Sucursal'), col('proveedor', 'Proveedor'), col('producto', 'Producto'), col('sku', 'SKU'), col('cantidad', 'Cantidad comprada', 'number'), col('costo_unitario', 'Costo unitario registrado (C$)', 'money'), col('descuento', 'Descuento de la línea (C$)', 'money'), col('impuesto', 'Impuesto de la línea (C$)', 'money'), col('subtotal', 'Subtotal registrado (C$)', 'money')],
    sums: [],
  },
  ventas: { title: 'Ventas', states, columns: [col('numero', 'Venta'), col('fecha', 'Fecha'), col('sucursal', 'Sucursal'), col('cliente', 'Cliente'), col('tipo_venta', 'Condición'), col('estado', 'Estado'), money('total', 'Total')], sums: ['total'] },
  compras: { title: 'Compras', states, columns: [col('numero', 'Documento'), col('fecha', 'Fecha'), col('sucursal', 'Sucursal'), col('proveedor', 'Proveedor'), col('estado', 'Estado'), money('total', 'Total')], sums: ['total'] },
  existencias: { title: 'Existencias actuales', product: true, dates: false, note: 'Stock actual al consultar; no representa existencias históricas.', columns: [col('sucursal', 'Sucursal'), col('sku', 'SKU'), col('producto', 'Producto'), col('stock_actual', 'Stock actual', 'number'), col('stock_minimo', 'Stock mínimo', 'number')], sums: ['stock_actual'] },
  movimientos: { title: 'Movimientos de inventario', product: true, columns: [col('fecha', 'Fecha'), col('sucursal', 'Sucursal'), col('sku', 'SKU'), col('producto', 'Producto'), col('tipo', 'Tipo'), col('cantidad', 'Cantidad', 'number'), col('stock_anterior', 'Stock anterior', 'number'), col('stock_nuevo', 'Stock nuevo', 'number'), col('referencia', 'Referencia')], sums: [] },
  ranking: { title: 'Productos más vendidos', product: true, note: 'Ranking bruto: solo ventas confirmadas, sin descontar devoluciones. Ordenado por unidades vendidas.', columns: [col('sku', 'SKU'), col('producto', 'Producto'), col('cantidad', 'Unidades vendidas', 'number'), money('importe', 'Importe de líneas')], sums: ['cantidad', 'importe'] },
  creditos: { title: 'Créditos pendientes', note: 'Créditos activos con saldo pendiente actual. Las fechas filtran el inicio del crédito; no reconstruyen saldos históricos.', columns: [col('numero', 'Venta'), col('fecha', 'Inicio del crédito'), col('sucursal', 'Sucursal'), col('cliente', 'Cliente'), col('estado', 'Estado'), money('monto_total', 'Monto del crédito'), money('saldo_pendiente', 'Saldo pendiente')], sums: ['saldo_pendiente'] },
  pagos: { title: 'Pagos', states: ['APLICADO', 'ANULADO'], methods: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'], note: 'Aplicados y anulados se totalizan por separado en moneda base NIO. Los anulados no forman parte del cobro aplicado.', columns: [col('id_pago', 'Pago'), col('numero', 'Venta'), col('fecha', 'Fecha'), col('sucursal', 'Sucursal'), col('metodo', 'Método'), col('moneda', 'Moneda original'), col('monto', 'Monto original', 'number'), money('monto_base', 'Monto base'), col('estado', 'Estado')], sums: [] },
  devoluciones: { title: 'Devoluciones', states, note: 'El importe es una valoración de los artículos devueltos. No representa dinero reembolsado ni modifica pagos, caja o créditos.', columns: [col('numero', 'Devolución'), col('venta', 'Venta'), col('fecha', 'Fecha'), col('sucursal', 'Sucursal'), col('motivo', 'Motivo'), col('estado', 'Estado'), money('total_devuelto', 'Valoración devuelta')], sums: ['total_devuelto'] },
};

module.exports = definitions;
