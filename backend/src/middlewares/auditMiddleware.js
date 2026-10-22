const { buscarEvento } = require('../config/auditEvents');
const auditService = require('../services/auditService');

function leerRuta(objeto, ruta) {
  if (!ruta) return undefined;
  let valor = objeto;
  for (const campo of ruta.split('.')) {
    if (!valor || typeof valor !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(valor, campo);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
    valor = descriptor.value;
  }
  return valor;
}

function seleccionar(datos, campos) {
  return Object.fromEntries(Object.entries(campos).map(([campo, ruta]) => [campo, leerRuta(datos, ruta)]));
}

function auditMiddleware(req, res, next) {
  let coincidencia;
  try {
    // Se instala antes de los routers: req.path todavía incluye /api/...
    // El catálogo no contiene GET, health, autenticación ni auditoría.
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
    coincidencia = buscarEvento(req.method, req.path);
  } catch (_) {
    auditService.informarFallo();
    return next();
  }
  if (!coincidencia) return next();

  const { definicion, parametros } = coincidencia;
  const jsonOriginal = res.json;
  let captura = null;

  res.json = function jsonConAuditoria(cuerpo) {
    captura = null;
    try {
      if (cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)) {
        const ok = Object.getOwnPropertyDescriptor(cuerpo, 'ok');
        if (!ok || (Object.hasOwn(ok, 'value') && ok.value === true)) {
          const datos = leerRuta(cuerpo, 'data');
          const idRespuesta = auditService.normalizarId(leerRuta(datos, definicion.idRespuesta));
          const normalizado = auditService.normalizarEvento({
            modulo: definicion.modulo, accion: definicion.accion, entidad: definicion.entidad,
            id_usuario: req.usuario && req.usuario.id_usuario,
            id_entidad: idRespuesta || parametros[definicion.idParametro] || null,
            id_sucursal: leerRuta(datos, definicion.sucursalRespuesta),
            datos_anteriores: seleccionar(datos, definicion.anteriores),
            datos_nuevos: seleccionar(datos, definicion.campos), ip: req.ip
          });
          // Solo se retiene una copia pequeña, sin referencias al cuerpo HTTP.
          captura = {
            ...normalizado,
            datos_anteriores: normalizado.datos_anteriores ? JSON.parse(normalizado.datos_anteriores) : null,
            datos_nuevos: normalizado.datos_nuevos ? JSON.parse(normalizado.datos_nuevos) : null
          };
        }
      }
    } catch (_) {
      auditService.informarFallo();
    }
    // El resultado, contexto y comportamiento original de Express se conservan.
    return jsonOriginal.call(this, cuerpo);
  };

  function descartar() {
    captura = null;
    res.removeListener('finish', finalizar);
  }

  function finalizar() {
    res.removeListener('close', descartar);
    const evento = captura;
    captura = null;
    if (!evento || res.statusCode < 200 || res.statusCode >= 300) return;
    try {
      // finish indica respuesta completada; no se espera ni altera su resultado.
      Promise.resolve(auditService.registrarEvento(evento)).catch(() => auditService.informarFallo());
    } catch (_) {
      auditService.informarFallo();
    }
  }

  res.once('finish', finalizar);
  res.once('close', descartar);
  return next();
}

module.exports = auditMiddleware;
