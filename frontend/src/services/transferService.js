import { TOKEN_KEY } from './api'

export const transferPayload = (values) => ({
  numero_transferencia: values.numero_transferencia.trim(),
  id_sucursal_origen: Number(values.id_sucursal_origen),
  id_sucursal_destino: Number(values.id_sucursal_destino),
  observacion: values.observacion?.trim() || null,
  detalles: values.detalles.map((line) => ({
    id_producto: Number(line.id_producto),
    ...(line.unidades
      ? { unidades: line.unidades.map(Number) }
      : { cantidad: Number(line.cantidad) }),
  })),
})

// Este controlador usa errors de express-validator y puede responder HTML por next(error).
// No mostrar HTML, SQL ni stack traces del manejador predeterminado de Express.
const request = async (path = '', method = 'GET', body, signal) => {
  let response
  try {
    response = await fetch(`http://localhost:3000/api/transferencias${path}`, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error(
      'No se pudo conectar con el servidor. Consulta el resultado antes de repetir una escritura.',
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const safeMessage =
      response.status < 500 && typeof data?.message === 'string' ? data.message : null
    const error = new Error(
      safeMessage ||
        {
          400: 'Datos inválidos. Revisa sucursales, productos y cantidades.',
          404: 'La transferencia o una unidad no existe.',
          409: 'Conflicto: revisa el estado, número, existencias y disponibilidad de los IMEI.',
        }[response.status] ||
        'No se pudo completar la operación de transferencia.',
    )
    error.status = response.status
    error.errores =
      response.status < 500
        ? (data?.errors || []).map((item) => ({ msg: item.msg || item.mensaje }))
        : []
    throw error
  }
  if (!data || data.ok !== true)
    throw new Error('Respuesta de transferencia inválida. Consulta antes de repetir.')
  return data
}

export const transferService = {
  list: (signal) => request('', 'GET', undefined, signal),
  get: (id, signal) => request(`/${id}`, 'GET', undefined, signal),
  create: (values) => request('', 'POST', transferPayload(values)),
  confirm: (id) => request(`/${id}/confirmar`, 'POST', {}),
  cancel: (id) => request(`/${id}/anular`, 'POST', {}),
}
