// Only the current server session may authorize the UI. Never decode JWT claims here.
export const canAccess = (usuario, codigo) =>
  !!usuario?.id_usuario &&
  Array.isArray(usuario.roles) &&
  Array.isArray(usuario.permisos) &&
  typeof codigo === 'string' &&
  codigo.length > 0 &&
  (usuario.roles.includes('ROOT') || usuario.permisos.includes(codigo))

export const canAccessModule = (can, module) =>
  module.authenticatedOnly === true || (!!module.permission && can(module.permission))

// Mirrors existing backend route guards; null means authentication only, never a new permission.
export const endpointPermission = (path, method = 'GET') => {
  const parts = path.split('?')[0].split('/').filter(Boolean)
  const [resource, id, action] = parts
  const verb = method.toUpperCase()
  if (resource === 'auth' && id === 'prueba-permiso') return 'PRODUCTOS_CREAR'
  const crud = {
    productos: 'PRODUCTOS',
    categorias: 'PRODUCTOS',
    marcas: 'PRODUCTOS',
    clientes: 'CLIENTES',
    proveedores: 'PROVEEDORES',
  }
  if (crud[resource]) {
    // Read permissions are canonical singular codes; write guards remain unchanged.
    if (verb === 'GET' && ['productos', 'categorias', 'marcas'].includes(resource))
      return 'PRODUCTO_VER'
    if (verb === 'GET' && resource === 'clientes') return 'CLIENTE_VER'
    const suffix = { GET: 'VER', POST: 'CREAR', PUT: 'EDITAR', DELETE: 'ELIMINAR' }[verb]
    return suffix ? `${crud[resource]}_${suffix}` : null
  }
  const documents = {
    ventas: 'VENTA',
    compras: 'COMPRAS',
    transferencias: 'TRANSFERENCIAS',
    devoluciones: 'DEVOLUCIONES',
    creditos: 'CREDITOS',
  }
  if (documents[resource]) {
    if (resource === 'ventas' && action === 'factura') return 'FACTURA_IMPRIMIR'
    if (resource === 'creditos' && id === 'cuotas' && parts[3] === 'pagar') return 'CREDITOS_PAGAR'
    const suffix =
      verb === 'GET'
        ? 'VER'
        : action === 'confirmar'
          ? 'CONFIRMAR'
          : action === 'anular'
            ? 'ANULAR'
            : 'CREAR'
    return `${documents[resource]}_${suffix}`
  }
  if (resource === 'inventario')
    return verb !== 'GET'
      ? 'INVENTARIO_AJUSTAR'
      : id === 'movimientos'
        ? 'MOVIMIENTO_VER'
        : 'INVENTARIO_VER'
  if (resource === 'unidades')
    return verb === 'GET' && id === 'disponibles' ? 'IMEI_VER' : 'IMEI_GESTIONAR'
  if (resource === 'garantias')
    return verb === 'GET'
      ? 'GARANTIAS_VER'
      : parts[3] === 'resolver'
        ? 'GARANTIAS_RESOLVER'
        : action === 'reclamos'
          ? 'GARANTIAS_RECLAMAR'
          : 'GARANTIAS_CREAR'
  if (resource === 'cajas')
    return verb === 'GET'
      ? 'CAJA_VER'
      : id === 'abrir'
        ? 'CAJA_ABRIR'
        : parts[3] === 'cerrar'
          ? 'CAJA_CERRAR'
          : 'CAJA_MOVIMIENTO'
  if (resource === 'pagos') return action === 'anular' ? 'PAGO_ANULAR' : 'PAGO_REGISTRAR'
  if (resource === 'usuarios')
    return id === 'roles'
      ? 'ROL_VER'
      : verb === 'GET'
        ? 'USUARIO_VER'
        : action === 'roles'
          ? 'USUARIO_ROLES'
          : verb === 'POST'
            ? ['USUARIO_CREAR', 'USUARIO_ROLES']
            : 'USUARIO_EDITAR'
  if (resource === 'respaldos') return action === 'restaurar' ? 'BACKUP_RESTAURAR' : 'BACKUP_CREAR'
  if (resource === 'auditoria') return 'AUDITORIA_VER'
  if (resource === 'tipos-cambio' && verb === 'POST') return 'TIPO_CAMBIO_GESTIONAR'
  return null
}
