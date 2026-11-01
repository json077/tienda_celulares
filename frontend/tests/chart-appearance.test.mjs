import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('Gráficas: tokens CSS, cambio de tema y movimiento reducido desactivan la animación de Chart.js', async () => {
  const source =
    (await readFile(new URL('../src/views/dashboard/chartAppearance.js', import.meta.url), 'utf8'))
      .replace(
        "import { useSyncExternalStore } from 'react'",
        "const { useSyncExternalStore } = require('react')",
      )
      .replace('export function useChartAppearance', 'function useChartAppearance') +
    '\nmodule.exports = { useChartAppearance }'
  let reduced = false,
    theme = 'light',
    notifications = 0,
    cleanup,
    observerCallback,
    disconnected = false
  const listeners = new Map()
  const media = {
    get matches() {
      return reduced
    },
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: (event, fn) => {
      if (listeners.get(event) === fn) listeners.delete(event)
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module,
    window: { matchMedia: () => media },
    document: { documentElement: { getAttribute: () => theme } },
    MutationObserver: class {
      constructor(callback) {
        observerCallback = callback
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    },
    getComputedStyle: () => ({ getPropertyValue: (key) => ` token:${key} ` }),
    require: () => ({
      useSyncExternalStore: (subscribe, snapshot) => {
        cleanup ||= subscribe(() => notifications++)
        return snapshot()
      },
    }),
  })
  let appearance = module.exports.useChartAppearance()
  assert.equal(appearance.action, 'token:--tc-action')
  assert.equal(appearance.positive, 'token:--tc-positive')
  assert.equal(appearance.text, 'token:--cui-body-color')
  assert.equal(appearance.animation.duration, 400)
  assert.equal(appearance.chartSurface, 'token:--tc-chart-surface')
  assert.equal(appearance.dark, false)
  reduced = true
  listeners.get('change')()
  appearance = module.exports.useChartAppearance()
  assert.equal(appearance.animation, false)
  theme = 'dark'
  observerCallback()
  assert.equal(module.exports.useChartAppearance().dark, true)
  assert.equal(notifications, 2)
  cleanup()
  assert.equal(listeners.size, 0)
  assert.equal(disconnected, true)
  const ssr = { exports: {} }
  vm.runInNewContext(source, {
    module: ssr,
    require: () => ({
      useSyncExternalStore: (_subscribe, _snapshot, serverSnapshot) => serverSnapshot(),
    }),
  })
  assert.equal(ssr.exports.useChartAppearance().animation, false)
})
