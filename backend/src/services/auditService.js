const { isIP } = require('node:net');
const auditRepository = require('../repositories/auditRepository');
const { eventos } = require('../config/auditEvents');

const MAX_JSON_BYTES = 4096;
const MAX_INSERCIONES = 4;
let insercionesActivas = 0;
let ultimoAviso = null;

function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function normalizarId(valor, obligatorio = false) {
  let id = null;
  if ((typeof valor === 'string' && /^\d{1,20}$/.test(valor)) ||
      (typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0)) {
    const numero = BigInt(valor);
    if (numero > 0n && numero <= 18446744073709551615n) id = numero.toString();
  }
  if (obligatorio && id === null) throw crearError('El ID debe ser un entero positivo válido');
  return id;
}

function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  // Evita desbordar DATE_ADD al calcular el límite superior exclusivo.
  if (anio < 1000 || anio > 9998) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

const valoresTexto = {
  estado: ['BORRADOR', 'CONFIRMADA', 'ANULADA', 'ANULADO', 'APLICADO', 'ACTIVO', 'PAGADO',
    'PENDIENTE', 'VENCIDA', 'PARCIAL', 'PAGADA', 'ABIERTA', 'CERRADA', 'VIGENTE',
    'RECIBIDO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'RESUELTO'],
  tipo: ['AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'INGRESO', 'EGRESO'],
  tipo_control: ['CANTIDAD', 'SERIALIZADO'],
  tipo_venta: ['CONTADO', 'CREDITO'],
  metodo: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'],
  solucion: ['REPARACION', 'REEMPLAZO', 'DEVOLUCION', 'SIN_COBERTURA']
};

// Doble lista permitida: campos declarados en el catálogo + tipos estrictos.
// No se serializan textos libres (ni siquiera bajo nombres aparentemente inocuos),
// objetos anidados, getters o toJSON; así no se filtran secretos ocultos en ellos.
function depurarDatos(datos, campos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const limpio = {};
  for (const campo of Object.keys(campos)) {
    const descriptor = Object.getOwnPropertyDescriptor(datos, campo);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) continue;
    const valor = descriptor.value;
    if (valor === null) {
      limpio[campo] = null;
    } else if (campo.startsWith('id_')) {
      limpio[campo] = normalizarId(valor);
    } else if (Object.hasOwn(valoresTexto, campo)) {
      if (valoresTexto[campo].includes(valor)) limpio[campo] = valor;
    } else if (campo === 'activo') {
      if ([true, false, 0, 1, '0', '1'].includes(valor)) limpio[campo] = Number(valor);
    } else if ((typeof valor === 'number' ||
        (typeof valor === 'string' && /^-?\d{1,15}(\.\d{1,6})?$/.test(valor))) &&
        Number.isFinite(Number(valor)) && Math.abs(Number(valor)) <= Number.MAX_SAFE_INTEGER) {
      limpio[campo] = Number(valor);
    }
  }
  if (!Object.keys(limpio).length) return null;
  const json = JSON.stringify(limpio);
  return Buffer.byteLength(json, 'utf8') <= MAX_JSON_BYTES ? json : null;
}

function normalizarEvento(datos) {
  const definicion = eventos.find(e => e.modulo === datos.modulo && e.accion === datos.accion && e.entidad === datos.entidad);
  if (!definicion) throw crearError('Evento de auditoría no declarado');
  return {
    id_usuario: normalizarId(datos.id_usuario, true),
    id_sucursal: normalizarId(datos.id_sucursal),
    modulo: definicion.modulo, accion: definicion.accion, entidad: definicion.entidad,
    id_entidad: normalizarId(datos.id_entidad),
    datos_anteriores: depurarDatos(datos.datos_anteriores, definicion.anteriores),
    datos_nuevos: depurarDatos(datos.datos_nuevos, definicion.campos),
    ip: typeof datos.ip === 'string' && datos.ip.length <= 45 && isIP(datos.ip) ? datos.ip : null
  };
}

function informarFallo() {
  // No se imprime el objeto Error: mysql2 puede incluir SQL y parámetros.
  try {
    const ahora = Date.now();
    if (ultimoAviso === null || ahora - ultimoAviso >= 60000) {
      ultimoAviso = ahora;
      console.error('Auditoría: evento omitido por fallo de registro o capacidad agotada');
    }
  } catch (_) {
    // Ni un fallo del logger debe afectar la operación comercial.
  }
}

async function registrarEvento(datos) {
  // Sin cola en memoria ni reintentos: como máximo cuatro escrituras pendientes.
  // No liberar la capacidad con Promise.race: la consulta seguiría viva en el pool.
  if (insercionesActivas >= MAX_INSERCIONES) {
    informarFallo();
    return false;
  }
  insercionesActivas += 1;
  try {
    await auditRepository.insertar(normalizarEvento(datos));
    return true;
  } catch (_) {
    informarFallo();
    return false;
  } finally {
    insercionesActivas -= 1;
  }
}

function normalizarFiltros(entrada = {}) {
  const filtros = {};
  for (const campo of ['id_usuario', 'id_sucursal', 'id_entidad']) {
    if (entrada[campo] !== undefined) filtros[campo] = normalizarId(entrada[campo], true);
  }
  for (const campo of ['modulo', 'accion', 'entidad']) {
    if (entrada[campo] !== undefined) {
      if (typeof entrada[campo] !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(entrada[campo])) {
        throw crearError(`${campo} no es válido`);
      }
      filtros[campo] = entrada[campo];
    }
  }
  for (const campo of ['fecha_desde', 'fecha_hasta']) {
    if (entrada[campo] !== undefined) {
      if (!fechaValida(entrada[campo])) throw crearError(`${campo} debe ser una fecha YYYY-MM-DD válida`);
      filtros[campo] = entrada[campo];
    }
  }
  if (filtros.fecha_desde && filtros.fecha_hasta && filtros.fecha_desde > filtros.fecha_hasta) {
    throw crearError('fecha_desde no puede ser posterior a fecha_hasta');
  }
  function paginacion(valor, defecto, maximo) {
    if (valor === undefined) return defecto;
    if (!['number', 'string'].includes(typeof valor) || !/^\d+$/.test(String(valor)) ||
        !Number.isSafeInteger(Number(valor)) || Number(valor) < 1 || Number(valor) > maximo) {
      throw crearError('Paginación no válida');
    }
    return Number(valor);
  }
  const pagina = paginacion(entrada.pagina, 1, Number.MAX_SAFE_INTEGER);
  const limite = paginacion(entrada.limite, 20, 100);
  const desplazamiento = (pagina - 1) * limite;
  if (!Number.isSafeInteger(desplazamiento)) throw crearError('La página solicitada es demasiado grande');
  return { filtros, pagina, limite, desplazamiento };
}

async function listarAuditoria(entrada) {
  const { filtros, pagina, limite, desplazamiento } = normalizarFiltros(entrada);
  const { registros, total } = await auditRepository.listar(filtros, limite, desplazamiento);
  return { registros, paginacion: { pagina, limite, total, total_paginas: Math.ceil(total / limite) } };
}

async function obtenerAuditoria(idAuditoria) {
  const registro = await auditRepository.obtenerPorId(normalizarId(idAuditoria, true));
  if (!registro) throw crearError('Registro de auditoría no encontrado', 404);
  return registro;
}

async function obtenerFiltros() {
  const datos = await auditRepository.obtenerFiltros();
  const unicos = campo => [...new Set(eventos.map(e => e[campo]))].sort();
  return { ...datos, modulos: unicos('modulo'), acciones: unicos('accion'), entidades: unicos('entidad') };
}

module.exports = {
  registrarEvento, normalizarEvento, normalizarFiltros, normalizarId, fechaValida,
  informarFallo, listarAuditoria, obtenerAuditoria, obtenerFiltros
};
