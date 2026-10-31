import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Usuarios CoreUI: permisos visuales, detalle, formularios y confirmaciones sin API real', async (t) => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw Error('Prohibida API real')
  }
  try {
    const { default: Users } = await server.ssrLoadModule('/src/views/users/Users.jsx')
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { default: Table } = await server.ssrLoadModule('/src/views/users/UserTable.jsx')
    const { default: Form } = await server.ssrLoadModule('/src/views/users/UserForm.jsx')
    const { UserDetail, UserState, UserRoles } = await server.ssrLoadModule(
      '/src/views/users/UserPanels.jsx',
    )
    const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
    const catalog = [
      { id_rol: '1', nombre: 'ROOT', activo: 1 },
      { id_rol: '2', nombre: 'VENDEDOR', activo: 1 },
    ]
    const user = {
      id_usuario: 2,
      username: 'ana',
      email: 'ana@test.local',
      nombres: 'Ana',
      apellidos: 'Prueba',
      activo: 1,
      roles: [catalog[1]],
      password_hash: 'HASH_NO_MOSTRAR',
    }
    const admin = {
      id_usuario: 1,
      roles: ['ADMINISTRADOR'],
      permisos: ['USUARIO_VER', 'USUARIO_CREAR', 'USUARIO_EDITAR', 'USUARIO_ROLES', 'ROL_VER'],
    }
    const callbacks = { onSave() {}, onConfirm() {}, onCancel() {} }
    await t.test('pantalla valida permisos antes de cargar datos', () => {
      const html = renderToStaticMarkup(
        React.createElement(AuthProvider, null, React.createElement(Users)),
      )
      assert.match(html, /Usuarios y roles/)
      assert.match(html, /Cargando usuarios y permisos/)
      assert.doesNotMatch(html, /Nuevo usuario|HASH_NO_MOSTRAR/)
    })
    await t.test(
      'tabla muestra datos y solo acciones permitidas; protege ROOT y autodesactivación',
      () => {
        const props = { users: [user], actor: admin, busy: false, onOpen() {} }
        let html = render(Table, props)
        for (const text of [
          'Ana Prueba',
          'ana@test.local',
          'VENDEDOR',
          'Ver detalle',
          'Editar',
          'Asignar roles',
          'Desactivar',
        ])
          assert.ok(html.includes(text))
        assert.doesNotMatch(html, /HASH_NO_MOSTRAR/)
        html = render(Table, { ...props, actor: { ...admin, permisos: ['USUARIO_VER'] } })
        assert.doesNotMatch(html, /Editar|Asignar roles|Desactivar/)
        html = render(Table, { ...props, users: [{ ...user, roles: [catalog[0]] }] })
        assert.doesNotMatch(html, /Editar|Asignar roles|Desactivar/)
        html = render(Table, {
          ...props,
          actor: { ...admin, roles: ['ROOT'] },
          users: [{ ...user, roles: [catalog[0]] }],
        })
        assert.match(html, /Editar/)
        assert.match(html, /Asignar roles/)
        html = render(Table, { ...props, actor: { ...admin, id_usuario: 2 } })
        assert.match(html, /Tu usuario/)
        assert.doesNotMatch(html, /Desactivar/)
        assert.match(render(Table, { ...props, users: [] }), /No hay usuarios para estos filtros/)
      },
    )
    await t.test('crear confirma contraseña; editar no ofrece contraseñas, estado ni roles', () => {
      const props = { catalog, saving: false, error: '', ...callbacks }
      let html = render(Form, props)
      assert.match(html, /Confirmar contraseña/)
      assert.match(html, /name="password"/)
      assert.match(html, /autoComplete="new-password"|autoComplete="new-password"/i)
      assert.match(html, /Roles disponibles/)
      html = render(Form, { ...props, user })
      assert.doesNotMatch(
        html,
        /name="password"|name="confirmPassword"|type="checkbox"|HASH_NO_MOSTRAR/,
      )
      assert.match(html, /name="username"/)
      html = render(Form, { ...props, saving: true, error: 'Correo duplicado' })
      assert.match(html, /fieldset disabled/)
      assert.match(html, /Guardando/)
      assert.match(html, /Correo duplicado/)
    })
    await t.test('detalle sin hashes, confirmación de estado y revisión previa de roles', () => {
      let html = render(UserDetail, { user })
      assert.match(html, /Ana Prueba/)
      assert.doesNotMatch(html, /HASH_NO_MOSTRAR|password/)
      const props = { user, saving: false, error: '', ...callbacks }
      html = render(UserState, props)
      assert.match(html, /Confirmar desactivación/)
      assert.match(
        render(UserState, { ...props, user: { ...user, activo: 0 } }),
        /Confirmar activación/,
      )
      html = render(UserRoles, { ...props, catalog })
      assert.match(html, /Roles actuales/)
      assert.match(html, /Revisar cambios/)
      assert.doesNotMatch(html, />Confirmar roles</)
    })
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
