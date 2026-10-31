import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Proveedores CoreUI: carga, filtros, filas, vacíos, formulario y selección activa en Compras', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('No acceder a API real')
  }
  const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
  const render = (Component, props) =>
    renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(Component, props)),
    )
  try {
    const { default: Suppliers, supplierConfig } = await server.ssrLoadModule(
      '/src/views/suppliers/Suppliers.jsx',
    )
    const { ContactTable } = await server.ssrLoadModule(
      '/src/components/contacts/ContactDirectory.jsx',
    )
    const { default: Form } = await server.ssrLoadModule('/src/components/contacts/ContactForm.jsx')
    const { default: PurchaseForm } = await server.ssrLoadModule(
      '/src/views/purchases/PurchaseForm.jsx',
    )
    let html = render(Suppliers)
    for (const text of [
      'Proveedores',
      'Nuevo proveedor',
      'Actualizar',
      'Cargando proveedores',
      'id_proveedor-search',
      'id_proveedor-state',
      'Activos',
      'Inactivos',
      'Limpiar filtros',
    ])
      assert.ok(html.includes(text), text)
    const rows = [
      {
        id_proveedor: 937,
        nombre: 'Distribuidora Prueba',
        identificacion: '000TEST',
        tipo_identificacion: 'RUC',
        telefono: '+505 8888',
        email: 'prueba@example.com',
        direccion: 'Managua',
        activo: 1,
      },
      {
        id_proveedor: 938,
        nombre: 'Proveedor Inactivo',
        identificacion: null,
        tipo_identificacion: null,
        telefono: null,
        email: null,
        direccion: null,
        activo: 0,
      },
    ]
    const props = {
      canEdit: true,
      canStatus: () => true,
      config: supplierConfig,
      records: rows,
      filtered: rows,
      error: '',
      busy: false,
      onEdit() {},
      onStatus() {},
    }
    html = render(ContactTable, props)
    for (const text of [
      'Distribuidora Prueba',
      '000TEST',
      'RUC',
      '+505 8888',
      'prueba@example.com',
      'Managua',
      'Activo',
      'Inactivo',
      'Editar Distribuidora Prueba',
      'Desactivar Distribuidora Prueba',
      'Activar Proveedor Inactivo',
      'table-responsive',
    ])
      assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, />ID<|>937<|>938<|>null<|>undefined</)
    assert.equal(
      (render(ContactTable, { ...props, busy: true }).match(/disabled=""/g) || []).length,
      4,
    )
    html = render(ContactTable, { ...props, records: [], filtered: [] })
    assert.match(html, /No hay proveedores registrados/)
    assert.match(html, /colspan="6"/i)
    assert.match(render(ContactTable, { ...props, filtered: [] }), /No hay coincidencias/)
    assert.match(
      render(ContactTable, { ...props, filtered: [], error: 'Error' }),
      /No hay registros disponibles/,
    )
    const formProps = {
      config: supplierConfig,
      record: null,
      saving: false,
      error: '',
      onSave() {},
      onCancel() {},
    }
    html = render(Form, formProps)
    for (const field of supplierConfig.fields) assert.ok(html.includes(`name="${field.name}"`))
    assert.equal((html.match(/required=""/g) || []).length, 1)
    assert.match(html, /se creará activo/)
    assert.doesNotMatch(html, /name="activo"|name="saldo"|name="id_proveedor"/)
    html = render(Form, {
      ...formProps,
      record: rows[0],
      saving: true,
      error: 'Identificación duplicada',
    })
    assert.match(html, /Identificación duplicada/)
    assert.match(html, /fieldset disabled/)
    assert.match(html, /Guardando/)
    assert.match(html, /value="000TEST"/)
    assert.match(html, /con confirmación/)
    html = render(PurchaseForm, {
      products: [],
      suppliers: rows,
      branches: [],
      warning: '',
      saving: false,
      error: '',
      onSave() {},
      onCancel() {},
    })
    assert.match(html, /Distribuidora Prueba/)
    assert.doesNotMatch(html, /Proveedor Inactivo/)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
