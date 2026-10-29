// Ejecutar después de verificarToken: req.usuario contiene el estado actual de la BD.
function verificarPermiso(codigoPermiso) {
  return (req, res, next) => {
    if (!req.usuario || !req.usuario.id_usuario) {
      return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });
    }
    const { roles, permisos } = req.usuario;
    if (Array.isArray(roles) && roles.includes('ROOT')) return next();
    if (!Array.isArray(permisos) || !permisos.includes(codigoPermiso)) {
      return res.status(403).json({ ok: false, message: 'No tiene permiso para realizar esta acción' });
    }
    return next();
  };
}

module.exports = { verificarPermiso };
