-- Additive migration. Select the intended database explicitly before running.
-- Verify SHOW COLUMNS FROM productos LIKE 'imagen_ruta' first; run only if absent.
-- Existing products retain all their data and have no photograph (NULL).
ALTER TABLE productos ADD COLUMN imagen_ruta VARCHAR(255) NULL DEFAULT NULL;
