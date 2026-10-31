import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { transformWithOxc } from 'vite'

test('AuthContext valida /me, revalida foco/403, aplica revocaciones y descarta respuestas tras logout', async () => {
  const source = await readFile(new URL('../src/contexts/AuthContext.jsx', import.meta.url), 'utf8')
  const permissionSource = await readFile(
    new URL('../src/auth/permissions.js', import.meta.url),
    'utf8',
  )
  const permissions = await import(
    'data:text/javascript;base64,' + Buffer.from(permissionSource).toString('base64')
  )
  const executable =
    source
      .replace(
        /import React, {([^}]+)} from 'react'/,
        "const React = require('react'); const {$1} = React",
      )
      .replace(/import PropTypes from 'prop-types'/, "const PropTypes = require('prop-types')")
      .replace(/import {([^}]+)} from '([^']+)'/g, "const {$1} = require('$2')")
      .replaceAll('export const ', 'const ') + '\nmodule.exports = { AuthProvider }'
  const { code } = await transformWithOxc(executable, 'AuthContext.jsx', {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  })
  const require = createRequire(import.meta.url)
  const slots = []
  const effects = []
  const listeners = new Map()
  const storage = new Map([['token', 'jwt-simulado-con-claims-antiguos']])
  let index = 0
  let policy
  let meCalls = 0
  let failure = null
  let pendingMe = null
  let effective = {
    id_usuario: 1,
    username: 'simulado',
    roles: ['INVENTARIO'],
    permisos: ['INVENTARIO_VER'],
  }
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props, children) => ({ type, props, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial
      return [
        slots[slot],
        (next) => {
          slots[slot] = typeof next === 'function' ? next(slots[slot]) : next
        },
      ]
    },
    useRef(initial) {
      const slot = index++
      return (slots[slot] ||= { current: initial })
    },
    useCallback: (callback) => callback,
    useEffect(effect) {
      effects.push(effect)
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    AbortController,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    window: {
      addEventListener: (event, callback) => listeners.set(event, callback),
      removeEventListener: (event) => listeners.delete(event),
    },
    require(name) {
      if (name === 'react') return react
      if (name === 'prop-types') return require('prop-types')
      if (name === '../auth/permissions') return permissions
      if (name === '../services/api')
        return {
          TOKEN_KEY: 'token',
          bindAuthorization(value) {
            policy = value
            return () => {
              policy = null
            }
          },
        }
      if (name === '../services/authService')
        return {
          authService: {
            async me() {
              meCalls++
              if (pendingMe) return pendingMe
              if (failure) throw failure
              return { ok: true, usuario: effective }
            },
            async login() {
              return { ok: true, token: 'token-nuevo', usuario: { ...effective, roles: ['ROOT'] } }
            },
          },
        }
      throw new Error(`Unexpected dependency ${name}`)
    },
  })
  const render = () => {
    index = 0
    return module.exports.AuthProvider({ children: 'test' }).props.value
  }
  const settle = async () => {
    await new Promise(setImmediate)
    await new Promise(setImmediate)
  }
  render()
  const cleanup = effects
    .splice(0)
    .map((effect) => effect())
    .filter(Boolean)
  try {
    await settle()
    let auth = render()
    assert.equal(auth.loading, false)
    assert.equal(auth.can('INVENTARIO_VER'), true)
    assert.equal(auth.can('USUARIO_VER'), false)
    assert.equal(policy.can('USUARIO_VER'), false)

    effective = { ...effective, roles: ['ROOT'], permisos: [] }
    listeners.get('focus')()
    await settle()
    auth = render()
    assert.equal(auth.can('USUARIO_VER'), true)

    effective = { ...effective, roles: ['INVENTARIO'], permisos: [] }
    const before = meCalls
    policy.onDenied(storage.get('token'))
    policy.onDenied(storage.get('token'))
    assert.equal(policy.can('USUARIO_VER'), false, 'Bloquea inmediatamente mientras revalida')
    await settle()
    auth = render()
    assert.equal(meCalls, before + 1, 'Una sola revalidación para 403 simultáneos')
    assert.equal(auth.can('INVENTARIO_VER'), false)
    assert.match(auth.accessNotice, /Acceso denegado/)

    failure = new Error('Red no disponible')
    listeners.get('focus')()
    await settle()
    auth = render()
    assert.equal(auth.can('USUARIO_VER'), false)
    assert.match(auth.accessNotice, /No se pudo validar/)
    failure = null
    effective = { ...effective, roles: ['VENDEDOR'], permisos: ['VENTA_VER'] }
    listeners.get('focus')()
    await settle()
    auth = render()
    assert.equal(auth.can('VENTA_VER'), true)

    let resolve
    pendingMe = new Promise((done) => {
      resolve = done
    })
    const refresh = auth.refreshSession()
    auth.logout()
    resolve({ ok: true, usuario: { ...effective, roles: ['ROOT'] } })
    await refresh
    auth = render()
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.can('USUARIO_VER'), false)
    pendingMe = null

    await auth.login('simulado', 'no-se-imprime')
    auth = render()
    assert.equal(auth.can('VENTA_VER'), true)
    assert.equal(
      auth.can('USUARIO_VER'),
      false,
      'El login usa /me y descarta roles antiguos del login/JWT',
    )
    failure = Object.assign(new Error('Usuario inactivo'), { status: 403 })
    await auth.refreshSession()
    assert.equal(render().isAuthenticated, false)
    assert.equal(storage.has('token'), false)
  } finally {
    cleanup.forEach((fn) => fn())
  }
})
