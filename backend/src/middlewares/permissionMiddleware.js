const { pool } = require('../config/database');

function verificarPermiso(codigoPermiso) {
  return async (req, res, next) => {
    try {
      if (!req.usuario || !req.usuario.id_usuario) {
        return res.status(401).json({
          ok: false,
          message: 'Usuario no autenticado'
        });
      }

      const idUsuario = req.usuario.id_usuario;

      // ROOT tiene acceso total al sistema.
      if (
        Array.isArray(req.usuario.roles) &&
        req.usuario.roles.includes('ROOT')
      ) {
        return next();
      }

      const [permisos] = await pool.query(
        `SELECT DISTINCT p.codigo
         FROM permisos p
         INNER JOIN rol_permisos rp
           ON rp.id_permiso = p.id_permiso
         INNER JOIN usuario_roles ur
           ON ur.id_rol = rp.id_rol
         INNER JOIN roles r
           ON r.id_rol = ur.id_rol
         WHERE ur.id_usuario = ?
           AND p.codigo = ?
           AND r.activo = 1
         LIMIT 1`,
        [idUsuario, codigoPermiso]
      );

      if (permisos.length === 0) {
        return res.status(403).json({
          ok: false,
          message: 'No tiene permiso para realizar esta acción'
        });
      }

      next();

    } catch (error) {
      console.error('Error verificando permiso:', error);

      return res.status(500).json({
        ok: false,
        message: 'Error interno del servidor'
      });
    }
  };
}

module.exports = { verificarPermiso };