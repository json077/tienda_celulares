const { body, param, query, validationResult } = require('express-validator');

function idValido(valor) {
  return ['number', 'string'].includes(typeof valor) && /^[1-9]\d{0,19}$/.test(String(valor)) &&
    BigInt(valor) <= 18446744073709551615n && (typeof valor !== 'number' || Number.isSafeInteger(valor));
}
function camposPermitidos(campos) {
  return body().custom(valor => valor && typeof valor === 'object' && !Array.isArray(valor) &&
    Object.keys(valor).every(campo => campos.includes(campo)))
    .withMessage('El cuerpo contiene campos no permitidos');
}
const perfil = () => [
  body('username').isString().bail().trim().matches(/^[A-Za-z0-9_.-]{3,60}$/)
    .withMessage('El usuario debe tener entre 3 y 60 letras, números, puntos, guiones o guiones bajos'),
  body('email').isString().bail().trim().isLength({ max: 150 }).isEmail()
    .withMessage('El correo no es válido'),
  ...['nombres', 'apellidos'].map(campo => body(campo).isString().bail().trim()
    .isLength({ min: 1, max: 100 }).withMessage(`${campo} es obligatorio y admite hasta 100 caracteres`))
];
const roles = () => body('roles').custom(valor => Array.isArray(valor) && valor.length <= 100 &&
  valor.every(idValido) && new Set(valor.map(String)).size === valor.length)
  .withMessage('roles debe ser una lista de hasta 100 IDs válidos sin duplicados');

const crear = [camposPermitidos(['username', 'email', 'nombres', 'apellidos', 'password', 'roles']),
  ...perfil(),
  body('password').custom(valor => typeof valor === 'string' && [...valor].length >= 12 &&
    Buffer.byteLength(valor, 'utf8') <= 72 && !valor.includes('\0'))
    .withMessage('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes, sin caracteres nulos'),
  roles().bail().custom(valor => valor.length > 0).withMessage('Debe asignar al menos un rol')];
const editar = [camposPermitidos(['username', 'email', 'nombres', 'apellidos']), ...perfil()];
const estado = [camposPermitidos(['activo']), body('activo').custom(valor => typeof valor === 'boolean')
  .withMessage('activo debe ser un booleano')];
const asignarRoles = [camposPermitidos(['roles']), roles()];
const id = [param('idUsuario').custom(idValido).withMessage('El ID del usuario no es válido')];
const listado = [
  query().custom(valor => Object.keys(valor).every(c => ['buscar', 'activo', 'id_rol', 'pagina', 'limite'].includes(c)))
    .withMessage('Filtro no permitido'),
  query('buscar').optional().isString().bail().trim().isLength({ max: 100 }),
  query('activo').optional().isString().bail().isIn(['0', '1']),
  query('id_rol').optional().custom(idValido),
  query('pagina').optional().isString().bail().isInt({ min: 1, max: 1000000 }),
  query('limite').optional().isString().bail().isInt({ min: 1, max: 100 })
];

function validar(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    // No devolver value: express-validator puede incluir contraseñas o todo el cuerpo.
    return res.status(400).json({ ok: false, message: 'Datos inválidos',
      errores: errores.array().map(e => ({ campo: e.path || 'body', mensaje: e.msg })) });
  }
  return next();
}

module.exports = { crear, editar, estado, asignarRoles, id, listado, validar };
