-- REVIEW ONLY: do not run automatically at application startup.
-- Select the intended database explicitly; run in batch without --force (stop on error).
-- Precondition: exactly one active VENDEDOR role; inspect any existing IMEI_VER first.
-- Repeatable: inserts only missing catalog and role-permission records.
-- Does NOT grant IMEI_GESTIONAR, change other roles, or assign user branches.
START TRANSACTION;

INSERT INTO permisos (codigo, nombre, descripcion, modulo)
SELECT 'IMEI_VER', 'Consultar dispositivos disponibles',
       'Consulta limitada por producto y sucursal asignada; sin registro ni ajustes', 'INVENTARIO'
WHERE EXISTS (SELECT 1 FROM roles WHERE nombre = 'VENDEDOR' AND activo = 1)
  AND NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'IMEI_VER');

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p ON p.codigo = 'IMEI_VER'
WHERE r.nombre = 'VENDEDOR' AND r.activo = 1
  AND NOT EXISTS (
    SELECT 1 FROM rol_permisos rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

COMMIT;

-- Expected: one active VENDEDOR row with IMEI_VER. Zero rows is NOT successful provisioning.
SELECT r.nombre, r.activo, p.codigo
FROM roles r
INNER JOIN rol_permisos rp ON rp.id_rol = r.id_rol
INNER JOIN permisos p ON p.id_permiso = rp.id_permiso
WHERE r.nombre = 'VENDEDOR' AND p.codigo = 'IMEI_VER';
