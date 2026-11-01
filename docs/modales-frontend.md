# Modales del frontend

## Solución global

`frontend/src/components/management/AppModal.jsx` conserva el portal y la trampa de foco de CoreUI, y asocia el título del diálogo cuando no tenía ID. Las políticas `backdrop="static"`, Escape, bloqueos durante operaciones y validaciones originales se conservan. La entrada dura 280 ms y la salida 220 ms; `onClose` se notifica al finalizar la salida para evitar desmontajes anticipados. CoreUI permanece visible internamente durante ese intervalo, con foco y bloqueo del fondo activos.

El backdrop comparte el montaje, el estado y la duración del diálogo porque el backdrop nativo de esta versión de CoreUI tiene un timeout fijo de 150 ms. Solo se renderiza un backdrop, con opacidad y blur animados hasta 5 px. La salida finaliza con `animationend`; un temporizador de respaldo evita bloqueos si el navegador no emite ese evento. `ModalPresence` conserva temporalmente los editores condicionales de Usuarios e Inventario al cancelar; no cambia sus operaciones ni validaciones. Si el cierre interrumpe la entrada, la salida parte del fotograma visible. Con movimiento reducido no hay desplazamiento ni escala y el cierre es inmediato.

`frontend/src/scss/_modals.scss`, importado desde `style.scss`, centraliza:

- Backdrop azul semitransparente con blur de 5 px. Sin soporte de backdrop-filter se usa una opacidad mayor; solo el backdrop se desenfoca.
- Superficie blanca en claro y `#111C2E` en oscuro, texto `#F1F5F9`, borde `#26364C`, radio de 16 px y sombra profunda.
- Tres anchos máximos: `sm` 420 px, `lg` 680 px y `xl` 1040 px. Se limitan al viewport con margen lateral de 12–16 px.
- Altura máxima de 90dvh, un cuerpo con scroll y encabezado/pie fuera del área desplazable. También contempla formularios entre `.modal-content` y `.modal-body`.
- Barras `.modal-actions` para acciones que originalmente estaban dentro del cuerpo. Los formularios mantienen el orden de sus campos, confirmaciones y validaciones.
- Entrada con `translateY(10px) scale(.98)` y desaceleración suave; salida con `translateY(6px) scale(.99)` y aceleración suave. No se cambian los z-index de CoreUI. Los estilos son solo para pantalla y no limitan la impresión de facturas.

## Auditoría por contenido

### Archivos del ajuste exclusivo de animación

- `frontend/src/components/management/AppModal.jsx`: presencia, cierre diferido, backdrop coordinado y conservación del contenido durante la salida.
- `frontend/src/scss/_modals.scss`: fotogramas, curvas, duraciones y movimiento reducido, sin alterar tamaños ni superficies.
- `frontend/src/views/users/Users.jsx`, `frontend/src/views/inventory/Inventory.jsx` y `frontend/src/views/inventory/InventoryOperationModal.jsx`: retención de editores que antes se desmontaban inmediatamente.
- `frontend/tests/app-modal.test.mjs`, `frontend/tests/management-ui.test.mjs`, `frontend/tests/sidebar-browser.test.mjs`, `frontend/tests/helpers/modalAudit.mjs`, `frontend/tests/helpers/modalMotionAudit.mjs`, `frontend/tests/fixtures/theme-preview.jsx` y `frontend/tests/fixtures/ModalMotionPreview.jsx`: pruebas y fixtures aislados, sin escrituras ni APIs reales.
- `docs/modales-frontend.md`: documentación del ciclo y de la validación.

La prueba de animación recorre 96 ciclos completos: tres tamaños, cuatro métodos de cierre, cuatro anchos y ambos temas. Comprueba opacidades intermedias, retención más allá de 150 ms, foco, bloqueo del fondo, ausencia de backdrops duplicados y limpieza final. Añade cierre durante la entrada, cierre estático y movimiento reducido. La auditoría de formularios espera el final real de la animación antes de medir el layout.

### Tamaños y contenido auditados

| Módulo / contenido | Tamaño máximo | Criterio |
| --- | --- | --- |
| Clientes y Proveedores: alta/edición compartida | 680 px | Campos de contacto en una o dos columnas. |
| Clientes y Proveedores: activar/desactivar | 420 px | Confirmación breve sin formulario extenso. |
| Productos: editor | 680 px | Datos del producto, precios, descuentos y garantía. |
| Productos: cambio de estado | 420 px | Confirmación breve. |
| Inventario: stock mínimo | 420 px | Un valor y su confirmación. |
| Inventario: ajuste / detalle de movimiento | 680 px | Tipo, cantidad y motivo, o datos descriptivos. |
| Compras | 1040 px | Cabecera, líneas de productos, recepción e IMEI. |
| Ventas | 1040 px | Productos, unidades, confirmación, detalle y factura. |
| Transferencias y Devoluciones | 1040 px | Líneas, sucursales o reintegros y confirmaciones. |
| Garantías y reclamos | 1040 px | Venta, líneas/unidades, historial y procesamiento del reclamo. |
| Créditos: plan o abono | 680 px | Parámetros financieros y confirmación. |
| Créditos: detalle e historial | 1040 px | Cuotas, pagos e historial tabular. |
| Caja | 680 px | Apertura/cierre, movimientos o registro de pago. |
| Usuarios: alta, edición, detalle y roles | 680 px | Perfil o listado de roles y permisos. |
| Usuarios: cambio de estado | 420 px | Confirmación breve. |
| Respaldos: crear / restaurar | 420 / 680 px | Crear es breve; restaurar incluye advertencias y confirmación escrita. |
| Reportes | Sin modal propio | Consulta y exportación se realizan en la página existente. No se agregó un diálogo. |

Los ejemplos del template en `views/components/modals` y `search-button` no forman parte de las rutas de negocio; reciben los estilos globales, sin cambios en sus ejemplos o handlers.

## Archivos de implementación

- Globales nuevos: `components/management/AppModal.jsx`, `scss/_modals.scss`; importación en `scss/style.scss`.
- Integración: `components/contacts/ContactDirectory.jsx`, `views/backups/Backups.jsx`, `views/cash/Cash.jsx`, `views/credits/Credits.jsx`, `views/inventory/Inventory.jsx`, `views/inventory/InventoryOperationModal.jsx`, `views/products/Products.jsx`, `views/purchases/Purchases.jsx`, `views/returns/Returns.jsx`, `views/sales/Sales.jsx`, `views/transfers/Transfers.jsx`, `views/users/Users.jsx`, `views/warranties/Warranties.jsx`.
- Barras internas: `views/cash/CashOperation.jsx`, `views/cash/PaymentForm.jsx`, `views/credits/CreditPlanForm.jsx`, `views/credits/CreditPaymentForm.jsx`, `views/returns/ReturnForm.jsx`, `views/sales/SaleForm.jsx`, `views/sales/SaleConfirmation.jsx`, `views/transfers/TransferForm.jsx`, `views/warranties/WarrantyForms.jsx`.
- Pruebas: `tests/app-modal.test.mjs`, `tests/helpers/modalAudit.mjs`, `tests/sidebar-browser.test.mjs`, `tests/helpers/themeAudit.mjs`, `tests/management-ui.test.mjs` y `tests/permissions-render.test.mjs`.

Las rutas anteriores son relativas a `frontend/src` para implementación y a `frontend` para pruebas.

## Validación visual y límites

Resultado del ajuste de animación: suite frontend con 199 pruebas correctas y dos omitidas (integración MySQL y navegador opcional); navegador ejecutado por separado correctamente, con 96 ciclos de animación y 40 vistas reales, incluidos 16 formularios con scroll. Lint sin errores ni advertencias, build correcto y `git diff --check` correcto. El aviso de conversión LF/CRLF corresponde al archivo previamente modificado `docs/dashboard-interfaz.md`.

El modo `SIDEBAR_BROWSER=1 MODAL_BROWSER=1 node --test tests/sidebar-browser.test.mjs` revisa cinco diálogos reales: creación de respaldo, nuevo proveedor, nuevo producto, nueva compra y nueva venta. Se ejecuta en claro y oscuro a 1440, 1024, 768 y 390 px: 40 vistas, además del desplazamiento de formularios largos. Usa una sesión y lecturas simuladas; bloquea escrituras y conexiones al backend real.

Se comprueban medidas, ausencia de doble scroll y desbordamiento, encabezado/acciones visibles, asociación del título accesible, foco dentro del diálogo, cierre explícito, backdrop estático, Escape, validación nativa y movimiento reducido. La revisión de venta se prueba sin guardar el borrador.

No se revisaron visualmente de forma individual los demás diálogos de Clientes, Caja, Créditos, Inventario, Transferencias, Devoluciones, Garantías y Usuarios, ni los estados adicionales de Ventas, Compras, Productos, Proveedores y Respaldos. Se auditaron sus estructuras y reciben la misma solución global; sus pruebas funcionales siguen formando parte de la suite frontend. La alternativa sin backdrop-filter se comprobó en el CSS, no en un navegador sin soporte.

Persisten avisos previos de Vite sobre `__dirname` y chunks mayores de 500 kB, y un aviso de React por el spinner `<div>` dentro del `<p>` de carga de Compras. No se modifican en este ajuste exclusivo de animación.

No se cambian APIs, backend, base de datos, permisos, reglas de negocio ni dependencias. No se realizó commit ni push.
