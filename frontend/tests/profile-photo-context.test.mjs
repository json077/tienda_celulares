import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { transformWithOxc } from 'vite'

test('Avatar compartido: descarta respuestas tardías y fotos de otra cuenta; libera URLs y permite reintentos', async () => {
  const source =
    (await readFile(new URL('../src/contexts/ProfileContext.jsx', import.meta.url), 'utf8'))
      .replace(
        /import React, {([^}]+)} from 'react'/,
        "const React = require('react'); const {$1} = React",
      )
      .replace(/import PropTypes from 'prop-types'/, "const PropTypes = require('prop-types')")
      .replace(/import {([^}]+)} from '([^']+)'/g, "const {$1} = require('$2')")
      .replaceAll('export const ', 'const ') + '\nmodule.exports = { ProfileProvider }'
  const { code } = await transformWithOxc(source, 'ProfileContext.jsx', {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  })
  const require = createRequire(import.meta.url)
  let id = 1,
    index = 0,
    urlIndex = 0,
    effect,
    lastDependencies,
    cleanup
  const slots = [],
    requests = [],
    revoked = []
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props, children) => ({ type, props, children }),
    useState(initial) {
      const key = index++
      if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial
      return [
        slots[key],
        (value) => {
          slots[key] = typeof value === 'function' ? value(slots[key]) : value
        },
      ]
    },
    useRef(initial) {
      const key = index++
      return (slots[key] ||= { current: initial })
    },
    useCallback(callback, deps) {
      const key = index++,
        old = slots[key]
      if (!old || deps.some((value, i) => value !== old.deps[i])) slots[key] = { callback, deps }
      return slots[key].callback
    },
    useEffect(callback, deps) {
      if (!lastDependencies || deps.some((value, i) => value !== lastDependencies[i])) {
        effect = callback
        lastDependencies = deps
      }
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    queueMicrotask,
    AbortController,
    URL: {
      createObjectURL: () => `blob:own-${++urlIndex}`,
      revokeObjectURL: (value) => revoked.push(value),
    },
    localStorage: { getItem: () => `token-${id}` },
    require(name) {
      if (name === 'react') return react
      if (name === 'prop-types') return require('prop-types')
      if (name === './AuthContext') return { useAuth: () => ({ usuario: { id_usuario: id } }) }
      if (name === '../services/api') return { TOKEN_KEY: 'token' }
      if (name === '../services/profileService')
        return {
          profileService: {
            photo: (signal) =>
              new Promise((resolve, reject) => requests.push({ signal, resolve, reject })),
          },
        }
      throw new Error(name)
    },
  })
  const render = () => {
    index = 0
    return module.exports.ProfileProvider({ children: 'test' }).props.value
  }
  const runEffect = async () => {
    if (effect) {
      cleanup?.()
      const run = effect
      effect = null
      cleanup = run()
    }
    await Promise.resolve()
  }
  render()
  await runEffect()
  const newer = render().refresh()
  requests[1].resolve({ photo: 'latest' })
  await newer
  assert.equal(render().url, 'blob:own-1')
  requests[0].resolve({ photo: 'stale' })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(render().url, 'blob:own-1')
  id = 2
  assert.equal(render().url, null)
  await runEffect()
  assert.equal(render().url, null)
  assert.ok(revoked.includes('blob:own-1'))
  requests[2].reject(new Error('Network'))
  await Promise.resolve()
  await Promise.resolve()
  assert.ok(render().error)
  const retry = render().refresh()
  requests[3].resolve({ photo: 'account-2' })
  await retry
  assert.equal(render().url, 'blob:own-2')
  const deletion = render().refresh()
  requests[4].resolve(null)
  await deletion
  assert.equal(render().url, null)
  assert.ok(revoked.includes('blob:own-2'))
  const late = render().refresh()
  cleanup()
  requests[5].resolve({ photo: 'after-unmount' })
  await late
  assert.equal(urlIndex, 2)
})
