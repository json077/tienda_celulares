import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const actor = (role, permisos) => ({ id_usuario: 1, username: 'simulado', roles: [role], permisos })
// Relevant effective permissions from the read-only audit; read codes are canonical.
const fixtures = {
  ROOT: actor('ROOT', []),
  ADMINISTRADOR: actor('ADMINISTRADOR', [
    'VENTA_VER',
    'INVENTARIO_VER',
    'CREDITOS_VER',
    'CAJA_VER',
    'TRANSFERENCIAS_VER',
    'DEVOLUCIONES_VER',
    'GARANTIAS_VER',
    'USUARIO_VER',
    'BACKUP_CREAR',
    'PRODUCTO_VER',
    'CLIENTE_VER',
    'COMPRA_VER',
  ]),
  VENDEDOR: actor('VENDEDOR', [
    'VENTA_VER',
    'VENTA_CREAR',
    'INVENTARIO_VER',
    'CREDITOS_VER',
    'CAJA_VER',
    'DEVOLUCIONES_VER',
    'GARANTIAS_VER',
    'PRODUCTO_VER',
    'CLIENTE_VER',
  ]),
  INVENTARIO: actor('INVENTARIO', [
    'INVENTARIO_VER',
    'MOVIMIENTO_VER',
    'IMEI_GESTIONAR',
    'INVENTARIO_AJUSTAR',
    'TRANSFERENCIAS_VER',
    'TRANSFERENCIAS_CREAR',
    'TRANSFERENCIAS_CONFIRMAR',
    'TRANSFERENCIAS_ANULAR',
    'DEVOLUCIONES_VER',
    'DEVOLUCIONES_CONFIRMAR',
    'GARANTIAS_VER',
    'GARANTIAS_RECLAMAR',
    'GARANTIAS_RESOLVER',
    'PRODUCTO_VER',
  ]),
}
const targets = [
  'Products',
  'Purchases',
  'Sales',
  'Credits',
  'Transfers',
  'Returns',
  'Warranties',
  'Cash',
  'Inventory',
  'ContactDirectory',
]
const label = (node) =>
  typeof node === 'string'
    ? node
    : Array.isArray(node)
      ? node.map(label).join('')
      : node?.props
        ? label(node.props.children)
        : ''

test('autorización visual y handlers con sesiones simuladas, sin navegador ni API real', async (t) => {
  // Instrument state and capture CoreUI event props so forbidden handlers can be called
  // even when disabled. Production components and their permission checks run unchanged.
  const harness = {
    index: 0,
    values: new Map(),
    buttons: [],
    modals: [],
    writes: [],
    refs: [],
    state(initial, realUseState) {
      const index = this.index++
      const [value] = realUseState(
        this.values.has(index) ? this.values.get(index) : initial === true ? false : initial,
      )
      this.values.set(index, value)
      return [
        value,
        (next) => {
          const updated = typeof next === 'function' ? next(this.values.get(index)) : next
          this.values.set(index, updated)
          this.writes.push(updated)
        },
      ]
    },
    reset(values = []) {
      this.index = 0
      this.values = new Map(values)
      this.buttons = []
      this.modals = []
      this.writes = []
      this.refs = []
    },
  }
  globalThis.__permissionHarness = harness
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    plugins: [
      {
        name: 'permission-event-harness',
        enforce: 'pre',
        transform(code, id) {
          if (!targets.some((name) => id.replaceAll('\\', '/').endsWith(`/${name}.jsx`))) return
          code = code.replace(/\buseState\b/, 'useState as realUseState')
          if (/\buseRef\b/.test(code)) {
            code = code.replace(/\buseRef\b/, 'useRef as realUseRef')
            code +=
              '\nconst useRef = (initial) => { const ref = realUseRef(initial); globalThis.__permissionHarness.refs.push(ref); return ref }\n'
          }
          code = code.replace(/\bCButton,/, 'CButton as CoreButton,')
          code +=
            '\nconst useState = (initial) => globalThis.__permissionHarness.state(initial, realUseState)\n'
          code +=
            'const CButton = (props) => { globalThis.__permissionHarness.buttons.push(props); return React.createElement(CoreButton, props) }\n'
          if (/\bCModal,/.test(code)) {
            code = code.replace(/\bCModal,/, 'CModal as CoreModal,')
            code +=
              'const CModal = (props) => { globalThis.__permissionHarness.modals.push(props); return props.visible ? React.createElement("section", null, props.children) : null }\n'
          }
          return code
        },
      },
    ],
  })
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = () => {
    requests++
    throw new Error('Prohibida API real')
  }
  try {
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { canAccess } = await server.ssrLoadModule('/src/auth/permissions.js')
    const { modules } = await server.ssrLoadModule('/src/config/modules.js')
    const { routes } = await server.ssrLoadModule('/src/routes.js')
    const { navigationFor } = await server.ssrLoadModule('/src/_nav.jsx')
    const { default: ProtectedRoute } = await server.ssrLoadModule(
      '/src/components/auth/ProtectedRoute.jsx',
    )
    const { default: AppContent } = await server.ssrLoadModule('/src/components/AppContent.jsx')
    const { MemoryRouter } = await import('react-router-dom')
    const render = (Component, session, props = {}) => {
      harness.index = 0
      harness.buttons = []
      harness.modals = []
      harness.refs = []
      return renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          {
            value: {
              usuario: session,
              isAuthenticated: true,
              loading: false,
              can: (code) => canAccess(session, code),
            },
          },
          React.createElement(Component, props),
        ),
      )
    }
    await t.test(
      'ROOT, ADMINISTRADOR, VENDEDOR e INVENTARIO: menú y todas las URL directas',
      () => {
        const expected = {
          ROOT: modules
            .filter((m) => !['/reportes', '/configuracion'].includes(m.path))
            .map((m) => m.path),
          ADMINISTRADOR: [
            '/dashboard',
            '/ventas',
            '/inventario',
            '/productos',
            '/clientes',
            '/creditos',
            '/caja',
            '/transferencias',
            '/devoluciones',
            '/garantias',
            '/usuarios-roles',
            '/respaldos',
          ],
          VENDEDOR: [
            '/dashboard',
            '/ventas',
            '/inventario',
            '/productos',
            '/clientes',
            '/creditos',
            '/caja',
            '/devoluciones',
            '/garantias',
          ],
          INVENTARIO: [
            '/dashboard',
            '/inventario',
            '/productos',
            '/transferencias',
            '/devoluciones',
            '/garantias',
          ],
        }
        for (const [role, session] of Object.entries(fixtures)) {
          assert.deepEqual(
            navigationFor((code) => canAccess(session, code)).map((item) => item.to),
            expected[role],
            role,
          )
          for (const module of modules) {
            const route = routes.find((r) => r.path === module.path)
            assert.equal(route.permission, module.permission)
            const html = render(ProtectedRoute, session, {
              module: route,
              children: React.createElement('p', null, 'CONTENIDO_AUTORIZADO'),
            })
            assert.equal(
              html.includes('CONTENIDO_AUTORIZADO'),
              expected[role].includes(module.path),
              `${role} ${module.path}`,
            )
            if (!expected[role].includes(module.path)) assert.match(html, /Acceso denegado/)
          }
        }
      },
    )
    await t.test('AppContent bloquea la URL real sin montar la vista ni pedir datos', () => {
      const html = render(
        () =>
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/usuarios-roles'] },
            React.createElement(AppContent),
          ),
        fixtures.INVENTARIO,
      )
      assert.match(html, /Acceso denegado/)
      assert.doesNotMatch(html, /Administra el acceso del personal/)
      assert.equal(requests, 0)
    })
    await t.test(
      'VENDEDOR abre Nueva venta con catalogos de lectura, sin permisos adicionales',
      async () => {
        const { default: Sales } = await server.ssrLoadModule('/src/views/sales/Sales.jsx')
        const { bindAuthorization } = await server.ssrLoadModule('/src/services/api.js')
        const { endpointPermission } = await server.ssrLoadModule('/src/auth/permissions.js')
        const originalStorage = globalThis.localStorage
        const forbiddenFetch = globalThis.fetch
        const calls = []
        const unbind = bindAuthorization({
          permissionFor: endpointPermission,
          can: (code) => canAccess(fixtures.VENDEDOR, code),
          onDenied: () => assert.fail('No debe recibir 403 del servidor'),
        })
        globalThis.localStorage = { getItem: () => 'sesion-simulada' }
        globalThis.fetch = async (url, options) => {
          assert.equal(options.method, 'GET', 'Abrir el formulario solo consulta')
          const path = new URL(url).pathname
          assert.ok(['/api/productos', '/api/clientes', '/api/inventario'].includes(path), path)
          calls.push(path)
          return { ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }
        }
        try {
          harness.reset()
          render(Sales, fixtures.VENDEDOR)
          const controller = harness.refs.find((ref) => ref.current === null)
          assert.ok(controller)
          controller.current = new AbortController()
          const button = harness.buttons.find((b) => label(b.children).includes('Nueva venta'))
          assert.equal(!!button.disabled, false)
          await button.onClick()
          assert.deepEqual(calls.sort(), ['/api/clientes', '/api/inventario', '/api/productos'])
          const html = render(Sales, fixtures.VENDEDOR)
          assert.ok(harness.modals.some((modal) => modal.visible))
          assert.match(html, /<form/)
          assert.ok(harness.writes.includes('new'), 'El handler abre el formulario real de ventas')
          for (const code of [
            'PRODUCTOS_CREAR',
            'PRODUCTOS_EDITAR',
            'PRODUCTOS_ELIMINAR',
            'CLIENTES_CREAR',
            'CLIENTES_EDITAR',
            'CLIENTES_ELIMINAR',
            'INVENTARIO_AJUSTAR',
            'IMEI_GESTIONAR',
          ]) {
            assert.equal(canAccess(fixtures.VENDEDOR, code), false, code)
          }
        } finally {
          unbind()
          globalThis.localStorage = originalStorage
          globalThis.fetch = forbiddenFetch
        }
      },
    )
    const operations = [
      ['products/Products', 'Nuevo producto', 'PRODUCTO_VER'],
      ['purchases/Purchases', 'Nueva compra', 'COMPRAS_VER'],
      ['sales/Sales', 'Nueva venta', 'VENTA_VER'],
      ['credits/Credits', 'Nuevo plan', 'CREDITOS_VER'],
      ['transfers/Transfers', 'Nueva transferencia', 'TRANSFERENCIAS_VER'],
      ['returns/Returns', 'Nueva devolución', 'DEVOLUCIONES_VER'],
      ['warranties/Warranties', 'Registrar garantía', 'GARANTIAS_VER'],
      ['cash/Cash', 'Abrir caja', 'CAJA_VER'],
      ['customers/Customers', 'Nuevo cliente', 'CLIENTE_VER'],
      ['suppliers/Suppliers', 'Nuevo proveedor', 'PROVEEDORES_VER'],
    ]
    for (const [file, text, permission] of operations) {
      const { default: Page } = await server.ssrLoadModule(`/src/views/${file}.jsx`)
      await t.test(
        `${file}: consulta sin crear; handler prohibido no abre formulario/modal`,
        async () => {
          for (const role of ['ADMINISTRADOR', 'VENDEDOR', 'INVENTARIO']) {
            harness.reset()
            const session = actor(role, [permission])
            render(Page, session)
            const button = harness.buttons.find((b) => label(b.children).includes(text))
            assert.ok(button, text)
            assert.equal(!!button.disabled, true, role)
            await button.onClick()
            render(Page, session)
            assert.equal(
              harness.modals.some((m) => m.visible),
              false,
              role,
            )
            assert.equal(requests, 0)
          }
          harness.reset(file === 'cash/Cash' ? [[0, [{ id_caja: 1, activo: 1 }]]] : [])
          render(Page, fixtures.ROOT)
          const rootButton = harness.buttons.find((b) => label(b.children).includes(text))
          assert.equal(
            !!rootButton.disabled,
            false,
            'ROOT vigente conserva las acciones autorizadas',
          )
        },
      )
    }
    await t.test('consultar documentos no permite abrir confirmación ni anulación', async () => {
      const record = {
        estado: 'BORRADOR',
        detalles: [],
        id_compra: 1,
        id_transferencia: 1,
        id_devolucion: 1,
        id_venta: 1,
        total: 10,
        total_devuelto: 10,
      }
      const cases = [
        [
          'transfers/Transfers',
          'TRANSFERENCIAS_VER',
          [
            [7, record],
            [9, 'detail'],
          ],
          ['Confirmar transferencia', 'Anular borrador'],
        ],
        [
          'returns/Returns',
          'DEVOLUCIONES_VER',
          [
            [4, record],
            [5, 'detail'],
          ],
          ['Confirmar devolución', 'Anular borrador'],
        ],
        [
          'purchases/Purchases',
          'COMPRAS_VER',
          [[9, record]],
          ['Preparar recepción', 'Anular borrador'],
        ],
        [
          'sales/Sales',
          'VENTA_VER',
          [
            [12, record],
            [10, 'detail'],
          ],
          ['Revisar y confirmar'],
        ],
        [
          'sales/Sales',
          'VENTA_VER',
          [
            [12, { ...record, estado: 'CONFIRMADA' }],
            [10, 'detail'],
          ],
          ['Ver / imprimir factura', 'Anular venta'],
        ],
      ]
      for (const [file, permission, values, texts] of cases) {
        const { default: Page } = await server.ssrLoadModule(`/src/views/${file}.jsx`)
        harness.reset(values)
        const session = actor('VENDEDOR', [permission])
        render(Page, session)
        for (const text of texts) {
          const button = harness.buttons.find((b) => label(b.children).includes(text))
          assert.ok(button, `${file}: ${text}`)
          assert.equal(!!button.disabled, true, `${file}: ${text}`)
          await button.onClick()
        }
        assert.equal(
          harness.writes.some((v) => ['confirm', 'cancel', 'invoice'].includes(v)),
          false,
          file,
        )
        assert.equal(requests, 0)
      }
    })
    await t.test(
      'Transferencias: sin PRODUCTO_VER no abre el formulario aunque pueda crear',
      async () => {
        const { default: Page } = await server.ssrLoadModule('/src/views/transfers/Transfers.jsx')
        harness.reset()
        const session = {
          ...fixtures.INVENTARIO,
          permisos: fixtures.INVENTARIO.permisos.filter((code) => code !== 'PRODUCTO_VER'),
        }
        render(Page, session)
        const button = harness.buttons.find((b) =>
          label(b.children).includes('Nueva transferencia'),
        )
        assert.equal(!!button.disabled, true)
        await button.onClick()
        render(Page, session)
        assert.equal(
          harness.modals.some((m) => m.visible),
          false,
        )
        assert.equal(requests, 0)
      },
    )
    await t.test(
      'Productos: editar, activar y desactivar requieren permisos distintos antes del modal',
      async () => {
        const { default: Page } = await server.ssrLoadModule('/src/views/products/Products.jsx')
        const rows = [1, 0].map((activo) => ({
          id_producto: activo + 1,
          activo,
          nombre: `Producto ${activo}`,
          sku: `SKU${activo}`,
          tipo_control: 'CANTIDAD',
          precio_venta: 1,
        }))
        harness.reset([[0, rows]])
        const session = actor('VENDEDOR', ['PRODUCTO_VER'])
        render(Page, session)
        const buttons = harness.buttons.filter((b) =>
          /^(Editar|Desactivar|Activar) Producto/.test(b['aria-label'] || ''),
        )
        assert.equal(buttons.length, 4)
        for (const button of buttons) {
          assert.ok(button.disabled)
          await button.onClick()
        }
        render(Page, session)
        assert.equal(
          harness.modals.some((m) => m.visible),
          false,
        )
        assert.equal(requests, 0)
      },
    )
    await t.test(
      'Inventario de solo consulta: no carga otras pestañas ni abre ajustes',
      async () => {
        const { default: Page } = await server.ssrLoadModule('/src/views/inventory/Inventory.jsx')
        const stock = {
          rows: [
            {
              id_sucursal: 1,
              sucursal: 'Sucursal',
              id_producto: 1,
              producto: 'Cable',
              sku: 'C',
              tipo_control: 'CANTIDAD',
              stock_actual: 2,
              stock_minimo: 1,
            },
          ],
          loading: false,
          error: '',
        }
        const empty = { rows: [], loading: false, error: '' }
        harness.reset([[1, { stock, units: empty, movements: empty }]])
        const session = actor('VENDEDOR', ['INVENTARIO_VER'])
        const html = render(Page, session)
        assert.doesNotMatch(html, /Dispositivos \/ IMEI/)
        const buttons = harness.buttons.filter((b) =>
          /Ajustar|Stock mínimo/.test(label(b.children)),
        )
        assert.equal(buttons.length, 2)
        for (const button of buttons) {
          assert.ok(button.disabled)
          await button.onClick()
        }
        assert.equal(
          harness.writes.some((v) => v?.kind),
          false,
        )
        assert.equal(requests, 0)
      },
    )
    await t.test(
      'revocar ROOT o consulta bloquea de nuevo la ruta; conceder solo consulta la permite',
      () => {
        const module = modules.find((m) => m.path === '/ventas')
        const props = { module, children: React.createElement('p', null, 'VENTAS_PERMITIDAS') }
        assert.match(render(ProtectedRoute, fixtures.ROOT, props), /VENTAS_PERMITIDAS/)
        assert.match(render(ProtectedRoute, actor('INVENTARIO', []), props), /Acceso denegado/)
        assert.match(
          render(ProtectedRoute, actor('VENDEDOR', ['VENTA_VER']), props),
          /VENTAS_PERMITIDAS/,
        )
      },
    )
  } finally {
    globalThis.fetch = originalFetch
    delete globalThis.__permissionHarness
    await server.close()
  }
})
