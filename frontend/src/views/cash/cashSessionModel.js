import { positiveId, validateCash } from './cashModel'

const finiteAmount = (value, signed = false) =>
  value != null &&
  String(value).trim() !== '' &&
  Number.isFinite(Number(value)) &&
  (signed || Number(value) >= 0)
export const cashBoxList = (response) => {
  if (
    !Array.isArray(response?.data) ||
    response.data.some(
      (b) =>
        !b ||
        !positiveId(b.id_caja) ||
        !positiveId(b.id_sucursal) ||
        typeof b.nombre !== 'string' ||
        b.activo == null ||
        ![0, 1].includes(Number(b.activo)),
    )
  )
    throw new Error('El servidor devolvió un catálogo de cajas inválido.')
  return response.data
}
export const normalizeCashSession = (row, expectedId) => {
  if (
    !row ||
    !positiveId(row.id_sesion_caja) ||
    !positiveId(row.id_caja) ||
    !positiveId(row.id_sucursal) ||
    (expectedId !== undefined && Number(row.id_sesion_caja) !== Number(expectedId)) ||
    !['ABIERTA', 'CERRADA'].includes(row.estado) ||
    !finiteAmount(row.monto_apertura) ||
    ['monto_cierre_sistema', 'monto_cierre_real', 'diferencia'].some(
      (key) => row[key] != null && !finiteAmount(row[key], key !== 'monto_cierre_real'),
    )
  )
    throw new Error('El servidor devolvió una sesión de caja inválida. Consulta nuevamente su ID.')
  return {
    ...row,
    id_sesion_caja: Number(row.id_sesion_caja),
    id_caja: Number(row.id_caja),
    id_sucursal: Number(row.id_sucursal),
  }
}
export const rememberCashSession = (rows, session) => [
  session,
  ...rows.filter((r) => Number(r.id_sesion_caja) !== Number(session.id_sesion_caja)),
]
export const filterCashSessions = (rows, query = '', state = '') =>
  rows.filter(
    (r) =>
      (!state || r.estado === state) &&
      [
        r.caja,
        r.codigo_caja,
        r.sucursal,
        r.usuario_apertura,
        r.usuario_cierre,
        r.id_sesion_caja,
      ].some((v) =>
        String(v ?? '')
          .toLocaleLowerCase('es')
          .includes(query.trim().toLocaleLowerCase('es')),
      ),
  )
export const normalizeCashMovement = (response, sessionId) => {
  const row = response?.movimiento
  if (
    !row ||
    !positiveId(row.id_movimiento_caja) ||
    Number(row.id_sesion_caja) !== Number(sessionId) ||
    !['INGRESO', 'EGRESO'].includes(row.tipo) ||
    !finiteAmount(row.monto) ||
    !finiteAmount(response.saldo_anterior, true) ||
    !finiteAmount(response.saldo_actual, true)
  )
    throw new Error(
      'El movimiento fue registrado, pero la respuesta no pudo mostrarse. Consulta antes de repetir.',
    )
  return response
}
export const acquireCashOperation = (pending) => {
  if (pending.current) return false
  pending.current = true
  return true
}

// La escritura y la lectura posterior se separan: un fallo de GET no autoriza repetir POST.
export const commitCashOperation = async ({
  mode,
  values,
  session,
  boxes,
  service,
  getSession,
  onCommitted,
  onRefreshError,
  signal,
}) => {
  if (!['open', 'close', 'movement'].includes(mode)) throw new Error('Operación de caja inválida.')
  if (mode !== 'open' && !positiveId(session?.id_sesion_caja))
    throw new Error('Consulta una sesión antes de operar.')
  const current = mode === 'open' ? session : await getSession(session.id_sesion_caja)
  if (signal?.aborted) return null
  validateCash(mode, values, current, boxes)
  const response =
    mode === 'open'
      ? await service.open(values)
      : mode === 'close'
        ? await service.close(current.id_sesion_caja, values)
        : await service.movement(current.id_sesion_caja, values)
  try {
    onCommitted(response, current)
  } catch (error) {
    // El POST ya terminó: una respuesta ilegible no permite conservar la sesión previa.
    onRefreshError(error)
    return null
  }
  if (signal?.aborted) return null
  if (mode === 'movement') {
    try {
      return await getSession(current.id_sesion_caja)
    } catch (error) {
      onRefreshError(error)
      return null
    }
  }
  return null
}
