const service = require('../services/userService');
const { isIP } = require('node:net');

function accion(operacion, status = 200) {
  return async (req, res) => {
    try {
      const data = await operacion(req);
      return res.status(status).json({ ok: true, data });
    } catch (error) {
      // No imprimir errores mysql2: pueden contener SQL, hashes y parámetros.
      return res.status(error.status || 500).json({ ok: false,
        message: error.status ? error.message : 'Error interno del servidor' });
    }
  };
}
function mutacion(tipo) {
  return req => service.mutar(tipo, req.params.idUsuario, req.body, req.usuario.id_usuario,
    isIP(req.ip || '') ? req.ip : null);
}

module.exports = {
  listar: accion(req => service.listar({ buscar: req.query.buscar, activo: req.query.activo,
    id_rol: req.query.id_rol, pagina: Number(req.query.pagina || 1), limite: Number(req.query.limite || 20) })),
  obtener: accion(req => service.obtener(req.params.idUsuario)),
  roles: accion(req => service.rolesDisponibles(req.usuario)),
  crear: accion(mutacion('CREAR'), 201),
  editar: accion(mutacion('EDITAR')),
  estado: accion(mutacion('ESTADO')),
  asignarRoles: accion(mutacion('ROLES'))
};
