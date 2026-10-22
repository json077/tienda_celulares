const warrantyRepository = require('../repositories/warrantyRepository');

function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function enteroPositivo(valor, nombre) {
  if (!['number', 'string'].includes(typeof valor) ||
      !/^\d+$/.test(String(valor)) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) {
    throw crearError(`${nombre} debe ser un entero positivo seguro`);
  }
  return Number(valor);
}

function limpiarTexto(valor, nombre, maximo, obligatorio = false) {
  if (valor === undefined || valor === null) {
    if (obligatorio) throw crearError(`${nombre} es obligatorio`);
    return null;
  }
  if (typeof valor !== 'string' || [...valor.trim()].length > maximo) {
    throw crearError(`${nombre} debe ser texto de hasta ${maximo} caracteres`);
  }
  const texto = valor.trim();
  if (obligatorio && !texto) throw crearError(`${nombre} es obligatorio`);
  return texto || null;
}

function validarDatos(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw crearError('Datos de entrada inválidos');
  }
}

async function enTransaccion(operacion) {
  const connection = await warrantyRepository.pool.getConnection();
  try {
    await connection.beginTransaction();
    const resultado = await operacion(connection);
    await connection.commit();
    return resultado;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw crearError('El número de reclamo ya existe', 409);
    throw error;
  } finally {
    connection.release();
  }
}

async function listarGarantias() {
  return warrantyRepository.obtenerTodas();
}

async function obtenerGarantia(idGarantia, connection) {
  const id = enteroPositivo(idGarantia, 'La garantía');
  const garantia = await warrantyRepository.obtenerPorId(id, connection);
  if (!garantia) throw crearError('Garantía no encontrada', 404);
  return garantia;
}

async function crearGarantia(datos) {
  validarDatos(datos);
  const idVenta = enteroPositivo(datos.id_venta, 'La venta');
  const idDetalle = enteroPositivo(datos.id_detalle_venta, 'El detalle de venta');
  const idUnidad = datos.id_unidad == null ? null : enteroPositivo(datos.id_unidad, 'La unidad');
  return enTransaccion(async (connection) => {
    // La fila padre existe incluso sin garantías: serializa creaciones concurrentes.
    const venta = await warrantyRepository.obtenerVentaParaActualizar(connection, idVenta);
    if (!venta) throw crearError('Venta no encontrada', 404);
    if (venta.estado !== 'CONFIRMADA') throw crearError('La venta debe estar CONFIRMADA', 409);
    const detalle = await warrantyRepository.obtenerDetalleParaActualizar(connection, idDetalle);
    if (!detalle) throw crearError('Detalle de venta no encontrado', 404);
    if (Number(detalle.id_venta) !== idVenta) throw crearError('El detalle no pertenece a la venta');
    const dias = Number(detalle.dias_garantia);
    if (detalle.dias_garantia == null || !Number.isInteger(dias) || dias < 0 || dias > 65535) {
      throw crearError('Los días históricos de garantía no son válidos');
    }
    if (dias === 0) throw crearError('El producto vendido no tiene cobertura');
    if (!venta.fecha_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(venta.fecha_inicio) ||
        venta.fecha_inicio.startsWith('0000-')) throw crearError('La fecha de venta no es válida');
    if (detalle.tipo_control === 'CANTIDAD') {
      if (idUnidad !== null) throw crearError('CANTIDAD requiere id_unidad NULL');
      // Una cobertura del detalle completo; el esquema no identifica piezas individuales.
      if (!Number.isSafeInteger(Number(detalle.cantidad)) || Number(detalle.cantidad) < 1) {
        throw crearError('La cantidad histórica no es válida');
      }
    } else if (detalle.tipo_control === 'SERIALIZADO') {
      if (idUnidad === null) throw crearError('SERIALIZADO requiere id_unidad');
      if (!await warrantyRepository.obtenerUnidadVendida(connection, idDetalle, idUnidad, detalle.id_producto)) {
        throw crearError('La unidad no corresponde al producto y detalle vendidos');
      }
    } else {
      throw crearError('Tipo de control no válido');
    }
    if (await warrantyRepository.existeGarantia(connection, idVenta, idDetalle, idUnidad)) {
      throw crearError('Ya existe una garantía para ese detalle o unidad de la venta', 409);
    }
    const id = await warrantyRepository.crearGarantia(connection, {
      id_venta: idVenta, id_detalle_venta: idDetalle, id_producto: detalle.id_producto,
      id_unidad: idUnidad, fecha_inicio: venta.fecha_inicio, dias_garantia: dias
    });
    return obtenerGarantia(id, connection);
  });
}

async function listarReclamos(idGarantia) {
  const garantia = await obtenerGarantia(idGarantia);
  return warrantyRepository.obtenerReclamos(garantia.id_garantia);
}

async function obtenerReclamo(idReclamo, connection) {
  const id = enteroPositivo(idReclamo, 'El reclamo');
  const reclamo = await warrantyRepository.obtenerReclamo(id, connection);
  if (!reclamo) throw crearError('Reclamo no encontrado', 404);
  return reclamo;
}

async function crearReclamo(idGarantia, datos, idUsuario) {
  validarDatos(datos);
  const id = enteroPositivo(idGarantia, 'La garantía');
  if (datos.id_garantia !== undefined && enteroPositivo(datos.id_garantia, 'La garantía') !== id) {
    throw crearError('La garantía del cuerpo no coincide con la ruta');
  }
  const sucursal = enteroPositivo(datos.id_sucursal, 'La sucursal');
  const usuario = enteroPositivo(idUsuario, 'El usuario autenticado');
  const numero = limpiarTexto(datos.numero_reclamo, 'El número de reclamo', 50, true);
  const motivo = limpiarTexto(datos.motivo, 'El motivo', 500, true);
  const observacion = limpiarTexto(datos.observacion, 'La observación', 500);
  return enTransaccion(async (connection) => {
    const garantia = await warrantyRepository.obtenerParaActualizar(connection, id);
    if (!garantia) throw crearError('Garantía no encontrada', 404);
    if (garantia.estado !== 'VIGENTE' || Number(garantia.en_cobertura) !== 1) {
      throw crearError('La garantía no está vigente dentro de su cobertura', 409);
    }
    const sede = await warrantyRepository.obtenerSucursal(connection, sucursal);
    if (!sede) throw crearError('Sucursal no encontrada', 404);
    if (Number(sede.activo) !== 1) throw crearError('La sucursal está inactiva');
    if (await warrantyRepository.existeReclamoAbierto(connection, id)) {
      throw crearError('La garantía ya tiene un reclamo abierto', 409);
    }
    const idReclamo = await warrantyRepository.crearReclamo(connection, {
      numero_reclamo: numero, id_garantia: id, id_sucursal: sucursal,
      id_usuario_recibe: usuario, motivo, observacion
    });
    return obtenerReclamo(idReclamo, connection);
  });
}

async function resolverReclamo(idReclamo, datos, idUsuario) {
  validarDatos(datos);
  const id = enteroPositivo(idReclamo, 'El reclamo');
  const usuario = enteroPositivo(idUsuario, 'El usuario autenticado');
  const transiciones = {
    RECIBIDO: ['EN_REVISION'], EN_REVISION: ['APROBADO', 'RECHAZADO'],
    APROBADO: ['RESUELTO'], RECHAZADO: ['RESUELTO'], RESUELTO: []
  };
  if (!Object.hasOwn(transiciones, datos.estado)) throw crearError('Estado de reclamo no válido');
  const soluciones = ['REPARACION', 'REEMPLAZO', 'DEVOLUCION', 'SIN_COBERTURA'];
  if (datos.solucion != null && !soluciones.includes(datos.solucion)) throw crearError('Solución no válida');
  const diagnostico = limpiarTexto(datos.diagnostico, 'El diagnóstico', 1000);
  const observacion = limpiarTexto(datos.observacion, 'La observación', 500);
  return enTransaccion(async (connection) => {
    const reclamo = await warrantyRepository.obtenerReclamoParaActualizar(connection, id);
    if (!reclamo) throw crearError('Reclamo no encontrado', 404);
    if (!transiciones[reclamo.estado]?.includes(datos.estado)) {
      throw crearError('Transición de estado no permitida', 409);
    }
    const resultado = {
      estado: datos.estado,
      diagnostico: datos.diagnostico === undefined ? reclamo.diagnostico : diagnostico,
      observacion: datos.observacion === undefined ? reclamo.observacion : observacion,
      solucion: datos.solucion === undefined ? reclamo.solucion : datos.solucion
    };
    if (datos.estado === 'RECHAZADO') {
      if (resultado.solucion != null && resultado.solucion !== 'SIN_COBERTURA') {
        throw crearError('RECHAZADO requiere SIN_COBERTURA');
      }
      resultado.solucion = 'SIN_COBERTURA';
    }
    if (datos.estado === 'EN_REVISION' && resultado.solucion != null) {
      throw crearError('EN_REVISION no admite una solución todavía');
    }
    if ((datos.estado === 'APROBADO' || reclamo.estado === 'APROBADO') &&
        resultado.solucion === 'SIN_COBERTURA') throw crearError('APROBADO no admite SIN_COBERTURA');
    if (reclamo.estado === 'RECHAZADO' && resultado.solucion !== 'SIN_COBERTURA') {
      throw crearError('Un reclamo rechazado debe cerrarse con SIN_COBERTURA');
    }
    if (datos.estado !== 'EN_REVISION' && !resultado.diagnostico) {
      throw crearError('El diagnóstico es obligatorio para decidir o resolver');
    }
    if (datos.estado === 'RESUELTO' && !resultado.solucion) throw crearError('RESUELTO requiere solución');
    if (await warrantyRepository.actualizarReclamo(connection, id, reclamo.estado, resultado, usuario) !== 1) {
      throw crearError('El reclamo cambió de estado concurrentemente', 409);
    }
    return obtenerReclamo(id, connection);
  });
}

module.exports = {
  listarGarantias, obtenerGarantia, crearGarantia, listarReclamos,
  obtenerReclamo, crearReclamo, resolverReclamo
};
