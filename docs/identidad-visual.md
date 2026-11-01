# Identidad visual de Tienda Celulares

La paleta se define en `frontend/src/scss/_identity.scss`: azul oscuro `#101C35`,
azul de acción `#2563EB`, fondo `#F5F7FB`, superficies `#FFFFFF` y verde `#16A34A`.
CoreUI recibe esos colores al compilar Sass. `_theme.scss` publica tokens CSS
`--tc-*` y estilos comunes para tarjetas, botones, formularios, tablas, modales,
navegación, login y carga. No se descargan fuentes ni se instalan dependencias.
Se usa la tipografía del sistema; Inter se utiliza si ya está disponible localmente.
El tema oscuro conserva superficies y textos adaptados para legibilidad.

El login cambia únicamente su composición visual. Se conservan el envío, los campos
requeridos, autocompletado, mostrar/ocultar contraseña, errores, exclusión de doble
envío, carga inicial y redirección al Dashboard.

El Dashboard no muestra filtros. Consulta el mes actual según `America/Managua`,
desde el primer día hasta el último inclusive, y todas las sucursales **autorizadas**.
El subtítulo muestra el mes y rango real consultado. Al abrir la pantalla o pulsar
Actualizar resumen se calcula nuevamente el mes. Las existencias siempre son actuales.
Se mantienen las cuatro tarjetas, tres gráficos, sus tablas de datos, permisos,
consultas existentes y rechazo de resultados parciales cuando la API falla.

Login y tarjetas del Dashboard tienen entrada de 380 ms; botones y tarjetas,
transiciones de 180 ms. Chart.js usa animación de 400 ms. Se respeta
`prefers-reduced-motion`: CSS elimina entradas y movimiento de carga y Chart.js
recibe `animation: false`, también si la preferencia cambia con la pantalla abierta.
Las gráficas leen colores desde los mismos tokens CSS y reaccionan al cambio de tema.

## Pantallas para revisar

- **Login** (`/#/login`): escritorio y móvil, campos visibles, mostrar contraseña,
  error de autenticación y estado de envío. La apariencia no altera los mensajes.
- **Dashboard** (`/#/dashboard`): subtítulo del mes actual, ausencia de filtros,
  cuatro indicadores y tres gráficas; Actualizar resumen; carga, error y mes vacío.
- **Compras** (`/#/compras`): tabla, filtros, botones y modal con el tema compartido.
  Abrir y cancelar formularios permite revisar sin registrar operaciones.
- **Proveedores** (`/#/proveedores`): tabla, búsqueda, formularios, mensajes y móvil.
- **Navegación**: menú expandido/contraído, móvil, opción activa, foco de teclado,
  selector de tema claro/oscuro y modales. Revisar también Reportes y Respaldos.
- En las herramientas del navegador, emular **prefers-reduced-motion: reduce**:
  no debe haber desplazamientos de entrada, hover animado ni animación de gráficas.

## Verificación automática

```powershell
cd frontend
node --test --test-concurrency=1 tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check
```

Las pruebas del mes cubren el cambio de mes en Nicaragua, febrero bisiesto y fin
de año. Se verifican permisos, consultas sin sucursal explícita, carga, vacíos,
respuestas tardías, recarga, comportamiento del login y movimiento reducido.
La prueba optativa de MySQL queda omitida; esta revisión no necesita acceder a la base.
