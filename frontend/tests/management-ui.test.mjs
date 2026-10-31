import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, transformWithOxc } from 'vite'

const loadModel = async (path) =>
  import(
    `data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64')}`
  )

// Runs real component handlers/effects with controlled promises; never calls an API or MySQL.
async function harness(path, dependencies) {
  const slots = [],
    effects = [],
    cleanups = []
  let index = 0,
    effectIndex = 0
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) =>
      typeof type === 'function'
        ? type({ ...props, children })
        : { type, props: { ...props, children } },
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
    useEffect(effect, deps) {
      const slot = effectIndex++
      const before = effects[slot]
      if (!before || deps.some((d, i) => d !== before.deps[i]))
        effects[slot] = { effect, deps, pending: true }
    },
  }
  const source = (await readFile(new URL(path, import.meta.url), 'utf8'))
    .replace(
      /import React, \{([^}]+)\} from 'react'/,
      "const React = require('react'); const {$1} = React",
    )
    .replace(/import \{([^}]+)\} from '([^']+)'/g, "const {$1} = require('$2')")
    .replace(/import (\w+) from '([^']+)'/g, "const $1 = require('$2').default")
    .replace(/export default (\w+)/, 'module.exports = $1')
  const { code } = await transformWithOxc(source, 'test.jsx', {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  })
  const require = createRequire(import.meta.url),
    module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    AbortController,
    setTimeout,
    require(name) {
      if (name === 'react') return react
      if (name === '@coreui/react') return new Proxy({}, { get: (_, key) => String(key) })
      if (Object.hasOwn(dependencies, name)) return dependencies[name]
      if (name.includes('ManagementUI')) return { PageHeading: 'PageHeading' }
      if (name.includes('icons-react')) return { CIcon: 'CIcon' }
      return require(name)
    },
  })
  let tree
  return {
    render() {
      index = 0
      effectIndex = 0
      tree = module.exports()
      return tree
    },
    effects() {
      effects.forEach((entry, i) => {
        if (entry.pending) {
          cleanups[i]?.()
          entry.pending = false
          cleanups[i] = entry.effect()
        }
      })
    },
    unmount() {
      cleanups.forEach((fn) => fn?.())
    },
    find(type, predicate = () => true) {
      const found = []
      const visit = (node) => {
        if (Array.isArray(node)) return node.forEach(visit)
        if (!node || typeof node !== 'object') return
        if (node.type === type && predicate(node.props)) found.push(node.props)
        visit(node.props?.children)
      }
      visit(tree)
      return found
    },
  }
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const text = (children) => JSON.stringify(children)

test('Dashboard: permisos, formulario, fechas aplicadas y cancelación de respuestas tardías', async () => {
  const model = await loadModel('../src/views/dashboard/dashboardModel.js')
  let allowed = false,
    calls = [],
    resolveOld
  const service = {
    catalog: async () => ({ data: { branches: [{ id_sucursal: 1, nombre: 'Central' }] } }),
    read: async (type, filters, signal) => {
      calls.push({ type, filters, signal })
      if (filters.desde === '2026-10-01' && type === 'ventas')
        return new Promise((resolve) => {
          resolveOld = resolve
        })
      return { data: { rows: [] } }
    },
  }
  const h = await harness('../src/views/dashboard/Dashboard.jsx', {
    '../../contexts/AuthContext': { useAuth: () => ({ can: () => allowed }) },
    '../../services/reportService': { reportService: service },
    '../../services/api': { apiErrorMessage: (e) => e.message },
    './DashboardResults': { default: 'DashboardResults' },
    './dashboardModel': model,
  })
  h.render()
  h.effects()
  assert.equal(calls.length, 0)
  allowed = true
  h.render()
  h.effects()
  await flush()
  h.render()
  h.effects()
  await flush()
  assert.equal(calls.length, 3)
  h.render()
  h.find('CFormInput', (p) => p.id === 'dashboard-desde')[0].onChange({
    target: { value: '2026-09-01' },
  })
  h.find('CFormSelect')[0].onChange({ target: { value: '1' } })
  h.render()
  h.find('CForm')[0].onSubmit({ preventDefault() {} })
  h.render()
  h.effects()
  await flush()
  h.render()
  assert.equal(calls.length, 6)
  assert.equal(calls[0].signal.aborted, true)
  const result = h.find('DashboardResults')[0]
  assert.equal(result.filters.desde, '2026-09-01')
  assert.equal(result.filters.id_sucursal, '1')
  assert.equal(calls[5].filters.desde, undefined)
  resolveOld({ data: { rows: [] } })
  await flush()
  h.render()
  assert.equal(h.find('DashboardResults')[0].filters.desde, '2026-09-01')
  h.find('CFormInput', (p) => p.id === 'dashboard-hasta')[0].onChange({
    target: { value: '2026-01-01' },
  })
  h.render()
  h.find('CForm')[0].onSubmit({ preventDefault() {} })
  h.render()
  assert.ok(h.find('CAlert').some((p) => text(p.children).includes('Desde debe ser anterior')))
  assert.equal(calls.length, 6)
  h.unmount()
})

test('Respaldos: confirmaciones reales, revocación, doble clic y éxito preservado si falla recarga', async () => {
  const model = await loadModel('../src/views/backups/backupModel.js')
  const permissions = new Set(['BACKUP_CREAR', 'BACKUP_RESTAURAR'])
  let createCalls = 0,
    restoreCalls = 0,
    finishCreate,
    failList = false
  const row = {
    id_respaldo: 1,
    nombre_archivo: 'test-only.sql',
    fecha_creacion: '2026-10-31',
    tamano_bytes: 1024,
    estado: 'CREADO',
  }
  const service = {
    list: async () => {
      if (failList) throw new Error('No se pudo recargar')
      return { data: [row] }
    },
    create: async () => {
      createCalls++
      await new Promise((r) => {
        finishCreate = r
      })
      return { message: 'Copia creada correctamente.' }
    },
    restore: async () => {
      restoreCalls++
      return { message: 'Copia restaurada correctamente.' }
    },
  }
  const h = await harness('../src/views/backups/Backups.jsx', {
    '../../contexts/AuthContext': { useAuth: () => ({ can: (code) => permissions.has(code) }) },
    '../../services/backupService': { backupService: service },
    '../../services/api': { apiErrorMessage: (e) => e.message },
    './backupModel': model,
  })
  h.render()
  h.effects()
  await flush()
  h.render()
  assert.equal(createCalls, 0)
  assert.equal(restoreCalls, 0)
  h.find('CFormSelect')[0].onChange({ target: { value: '1' } })
  h.render()
  h.find('CButton', (p) => text(p.children).includes('Revisar y confirmar'))[0].onClick()
  h.render()
  assert.equal(h.find('CModal')[0].visible, true)
  const restoreButton = () =>
    h.find('CButton', (p) => text(p.children).includes('Restaurar copia'))[0]
  assert.equal(restoreButton().disabled, true)
  h.find('CFormInput')[0].onChange({ target: { value: 'RESTAURAR 2' } })
  h.render()
  assert.equal(restoreButton().disabled, true)
  h.find('CFormInput')[0].onChange({ target: { value: 'RESTAURAR 1' } })
  h.render()
  assert.equal(restoreButton().disabled, false)
  permissions.delete('BACKUP_RESTAURAR')
  await restoreButton().onClick()
  h.render()
  assert.equal(restoreCalls, 0)
  assert.ok(h.find('CAlert').some((p) => text(p.children).includes('No tienes permiso')))
  h.find('CButton', (p) => text(p.children).includes('Crear copia de seguridad'))[0].onClick()
  h.render()
  const create = h.find('CButton', (p) => text(p.children) === '["Crear copia"]')[0]
  const first = create.onClick(),
    second = create.onClick()
  assert.equal(createCalls, 1)
  h.render()
  assert.ok(h.find('CAlert').some((p) => text(p.children).includes('Creando copia')))
  failList = true
  finishCreate()
  await Promise.all([first, second])
  h.render()
  h.effects()
  await flush()
  h.render()
  assert.equal(createCalls, 1)
  assert.ok(h.find('CAlert').some((p) => text(p.children).includes('Copia creada correctamente')))
  assert.ok(h.find('CAlert').some((p) => text(p.children).includes('No se pudo recargar')))
  assert.equal(h.find('CModal')[0].visible, false)
  h.unmount()
})

test('CoreUI real: cabeceras, vacíos, advertencias, filtros y acceso denegado', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: 'custom',
  })
  try {
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const { default: Dashboard } = await server.ssrLoadModule('/src/views/dashboard/Dashboard.jsx')
    const { default: Backups } = await server.ssrLoadModule('/src/views/backups/Backups.jsx')
    const render = (Component, permissions) =>
      renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          { value: { can: (code) => permissions.includes(code) } },
          React.createElement(Component),
        ),
      )
    const denied = render(Dashboard, [])
    assert.ok(denied.includes('permiso de consulta de reportes'))
    assert.ok(!denied.includes('dashboard-desde'))
    const dashboard = render(Dashboard, ['REPORTE_VER'])
    assert.ok(dashboard.includes('2026-10-01'))
    assert.ok(dashboard.includes('2026-10-31'))
    assert.ok(dashboard.includes('dashboard-branch'))
    assert.ok(render(Backups, []).includes('No tienes permiso'))
    const backups = render(Backups, ['BACKUP_CREAR'])
    for (const label of [
      'Crear una copia',
      'Historial de copias',
      'Restaurar una copia',
      'sobrescribir',
      'parcialmente restaurada',
    ])
      assert.ok(backups.includes(label))
    assert.ok(backups.includes('No tienes permiso para restaurar'))
    assert.ok(!backups.includes('id="backup-restore"'))
  } finally {
    await server.close()
  }
})
