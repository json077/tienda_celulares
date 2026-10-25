import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Clientes CoreUI: carga, filtros, tabla, vacíos, formulario, errores y compatibilidad con Ventas/Proveedores', async () => {
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
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
  try {
    const { default: Customers, customerConfig } = await server.ssrLoadModule(
      '/src/views/customers/Customers.jsx',
    )
    const { ContactTable, filterContacts } = await server.ssrLoadModule(
      '/src/components/contacts/ContactDirectory.jsx',
    )
    const { default: Form, validateContact } = await server.ssrLoadModule(
      '/src/components/contacts/ContactForm.jsx',
    )
    const { default: Suppliers, supplierConfig } = await server.ssrLoadModule(
      '/src/views/suppliers/Suppliers.jsx',
    )
    const { default: SaleForm } = await server.ssrLoadModule('/src/views/sales/SaleForm.jsx')
    let html = render(Customers)
    for (const text of [
      'Clientes',
      'Nuevo cliente',
      'Actualizar',
      'Cargando clientes',
      'id_cliente-search',
      'id_cliente-state',
      'Activos',
      'Inactivos',
      'Limpiar filtros',
    ])
      assert.ok(html.includes(text), text)
    const rows = [
      {
        id_cliente: 937,
        tipo_identificacion: 'Cédula',
        identificacion: '000TEST',
        nombres: 'Ana',
        apellidos: 'López',
        telefono: '+505 8888',
        email: 'ana@example.com',
        direccion: 'Managua',
        activo: 1,
      },
      {
        id_cliente: 938,
        tipo_identificacion: 'Pasaporte',
        identificacion: 'PAS-TEST',
        nombres: 'Pedro',
        apellidos: null,
        telefono: null,
        email: null,
        direccion: null,
        activo: 0,
      },
    ]
    const props = {
      config: customerConfig,
      records: rows,
      filtered: rows,
      error: '',
      busy: false,
      onEdit() {},
      onStatus() {},
    }
    html = render(ContactTable, props)
    for (const text of [
      'Ana López',
      '000TEST',
      'Cédula',
      '+505 8888',
      'ana@example.com',
      'Managua',
      'Activo',
      'Inactivo',
      'Editar Ana López',
      'Desactivar Ana López',
      'Activar Pedro',
      'table-responsive',
    ])
      assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, />ID<|>937<|>938</)
    html = render(ContactTable, { ...props, busy: true })
    assert.equal((html.match(/disabled=""/g) || []).length, 4)
    html = render(ContactTable, { ...props, records: [], filtered: [] })
    assert.match(html, /No hay clientes registrados/)
    assert.match(html, /colspan="6"/i)
    html = render(ContactTable, { ...props, filtered: [] })
    assert.match(html, /No hay coincidencias/)
    html = render(ContactTable, { ...props, filtered: [], error: 'Error' })
    assert.match(html, /No hay registros disponibles/)
    const formProps = {
      config: customerConfig,
      record: null,
      saving: false,
      error: '',
      onSave() {},
      onCancel() {},
    }
    html = render(Form, formProps)
    for (const field of customerConfig.fields) assert.ok(html.includes(`name="${field.name}"`))
    assert.match(html, /se creará activo/)
    assert.doesNotMatch(html, /name="activo"|name="saldo"|name="limite_credito"/)
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
    // Proveedores utiliza las opciones del directorio sin alterar Clientes.
    assert.match(render(Suppliers), /Cargando proveedores/)
    assert.match(render(Suppliers), /id_proveedor-state/)
    const supplier = { id_proveedor: 1, nombre: 'Proveedor prueba', activo: 1 }
    assert.equal(filterContacts([supplier], supplierConfig, 'prueba').length, 1)
    assert.notEqual(validateContact(supplierConfig.fields, {}), '')
    assert.doesNotMatch(
      render(ContactTable, {
        ...props,
        config: supplierConfig,
        records: [supplier],
        filtered: [supplier],
      }),
      />ID</,
    )
    // La selección de Ventas sigue mostrando exclusivamente clientes activos.
    html = render(SaleForm, {
      catalog: { products: [], clients: rows, stock: [], units: [] },
      saving: false,
      error: '',
      onSave() {},
      onCancel() {},
    })
    assert.match(html, /Ana López/)
    assert.doesNotMatch(html, /Pedro|PAS-TEST/)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
