import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const rgb = (value) =>
  value
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
const luminance = (value) =>
  rgb(value)
    .map((c) => {
      const s = c / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

export async function auditTheme({
  send,
  evaluate,
  waitFor,
  mouse,
  click,
  key,
  capture,
  diagnostic,
}) {
  await evaluate("localStorage.removeItem('tienda-celulares.sidebar-pinned')")
  await send('Emulation.setEmulatedMedia', { features: [] })
  const navigate = async (route, heading) => {
    await evaluate(`window.themePreview.navigate(${JSON.stringify(route)}); window.scrollTo(0, 0)`)
    await waitFor(
      `!![...document.querySelectorAll('h1,h2')].find(e => e.textContent === ${JSON.stringify(heading)})`,
    )
    await waitFor("!document.querySelector('.body [role=status] .spinner-border')")
    await delay(240)
  }
  const button = async (text) => {
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)});
      if (!button || button.disabled) throw new Error('Botón no disponible: ' + ${JSON.stringify(text)});
      button.click();
    })()`)
  }
  const inspect = (selector) =>
    evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
    const style = getComputedStyle(e); const rect = e.getBoundingClientRect();
    return { color: style.color, background: style.backgroundColor, border: style.borderColor,
      x: rect.x, width: rect.width, outline: style.outlineStyle };
  })()`)
  const pages = [
    ['/authentication/login', 'Iniciar sesión', null],
    ['/dashboard', 'Dashboard', null],
    ['/compras', 'Compras', 'Nueva compra'],
    ['/proveedores', 'Proveedores', 'Nuevo proveedor'],
    ['/ventas', 'Ventas', 'Nueva venta'],
    ['/productos', 'Productos', 'Nuevo producto'],
    ['/inventario', 'Inventario', null],
    ['/reportes', 'Reportes', null],
    ['/respaldos', 'Copias de seguridad', 'Crear copia de seguridad'],
  ]
  const results = []
  for (const width of [1440, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await mouse(width - 25, 100)
    for (const theme of ['light', 'dark']) {
      await evaluate(
        `localStorage.setItem('coreui-free-react-admin-template-theme', '${theme}'); document.documentElement.setAttribute('data-coreui-theme', '${theme}')`,
      )
      const dark = theme === 'dark'
      for (const [route, heading, newButton] of pages) {
        await navigate(route, heading)
        if (route === '/dashboard')
          await waitFor("document.querySelectorAll('.dashboard-view canvas').length === 3")
        const body = await inspect('body')
        const surface = await inspect('.card')
        assert.equal(body.background, dark ? 'rgb(11, 18, 32)' : 'rgb(245, 247, 251)')
        assert.equal(surface.background, dark ? 'rgb(17, 28, 46)' : 'rgb(255, 255, 255)')
        assert.ok(
          contrast(body.color, body.background) >= 4.5,
          `${route}: contraste del texto principal`,
        )
        if (dark) {
          const muted = await inspect('.text-body-secondary')
          if (muted)
            assert.ok(
              contrast(muted.color, surface.background) >= 4.5,
              `${route}: texto secundario`,
            )
          const input = await inspect('.form-control, .form-select')
          if (input)
            assert.ok(contrast(input.color, input.background) >= 4.5, `${route}: formularios`)
          const primary = await inspect('.btn-primary:not(:disabled)')
          if (primary)
            assert.ok(
              contrast(primary.color, primary.background) >= 4.5,
              `${route}: acción principal`,
            )
        }
        assert.ok(
          await evaluate('document.documentElement.scrollWidth <= innerWidth'),
          `${route}, ${theme}, ${width}: sin desbordamiento horizontal`,
        )
        await capture(`audit-${theme}-${width}-${route.split('/').at(-1)}`)
        if (route !== '/authentication/login') {
          const table = await evaluate("!!document.querySelector('table tbody td')")
          if (table) {
            await evaluate("document.querySelector('table').scrollIntoView({ block: 'center' })")
            await capture(`audit-table-${theme}-${width}-${route.slice(1)}`)
            await evaluate('window.scrollTo(0, 0)')
            const cell = await inspect('table tbody td')
            if (dark)
              assert.ok(contrast(cell.color, surface.background) >= 4.5, `${route}: texto de tabla`)
          }
        }
        if (newButton) {
          await button(newButton)
          await waitFor("!!document.querySelector('.modal.show .modal-content')")
          await delay(240)
          const modal = await inspect('.modal.show .modal-content')
          assert.equal(modal.background, dark ? 'rgb(17, 28, 46)' : 'rgb(255, 255, 255)')
          if (dark) assert.ok(contrast(modal.color, modal.background) >= 4.5)
          assert.ok(
            await evaluate(
              "document.querySelector('.modal.show .modal-content').getBoundingClientRect().right <= innerWidth",
            ),
          )
          await capture(`audit-modal-${theme}-${width}-${route.slice(1)}`)
          await evaluate("document.querySelector('.modal.show .btn-close').click()")
          await waitFor("!document.querySelector('.modal.show')")
        }
        if (route === '/authentication/login') {
          await evaluate(`(() => {
            for (const [id, value] of [['username', 'prueba'], ['password', 'prueba']]) {
              const input = document.getElementById(id);
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          })()`)
          await evaluate("document.querySelector('.login-page form').requestSubmit()")
          await waitFor("!!document.querySelector('.alert-danger')")
          const error = await inspect('.alert-danger')
          assert.ok(contrast(error.color, error.background) >= 4.5)
          await capture(`audit-login-error-${theme}-${width}`)
        }
        if (route === '/dashboard') {
          const series = await evaluate(`window.themePreview.charts().map(c => ({
            type: c.config.type, labels: [...c.data.labels], datasets: c.data.datasets.map(d => ({label:d.label, data:[...d.data]})),
            tooltip: c.options.plugins.tooltip.backgroundColor,
            text: c.options.plugins.legend.labels.color,
          }))`)
          assert.equal(series.length, 3)
          if (dark) {
            for (const chart of series) assert.equal(chart.tooltip.toLowerCase(), '#111c2e')
            assert.deepEqual(
              series.find((c) => c.type === 'line').datasets.map((d) => d.label),
              ['CONFIRMADA', 'ANULADA'],
            )
            const backgrounds = await evaluate(
              "[...document.querySelectorAll('.dashboard-view canvas')].map(c => getComputedStyle(c.parentElement).backgroundColor)",
            )
            assert.ok(backgrounds.every((bg) => bg !== 'rgb(255, 255, 255)'))
          }
          // Changing theme updates chart colors, never labels, amounts, order or chart geometry.
          const geometry = await inspect('.dashboard-view')
          await evaluate(
            `document.documentElement.setAttribute('data-coreui-theme', '${dark ? 'light' : 'dark'}')`,
          )
          await delay(450)
          const changed = await evaluate(
            'window.themePreview.charts().map(c => ({ type:c.config.type, labels:[...c.data.labels], datasets:c.data.datasets.map(d => ({label:d.label,data:[...d.data]})) }))',
          )
          assert.deepEqual(
            changed,
            series.map(({ type, labels, datasets }) => ({ type, labels, datasets })),
          )
          assert.equal((await inspect('.dashboard-view')).width, geometry.width)
          await evaluate(`document.documentElement.setAttribute('data-coreui-theme', '${theme}')`)
          await delay(450)
          // Force canvas tooltips at a real point for visual inspection.
          await evaluate(
            `window.themePreview.charts().forEach(c => { const point = c.getDatasetMeta(0).data[1] || c.getDatasetMeta(0).data[0]; if(point) { c.tooltip.setActiveElements([{ datasetIndex: 0, index: c.getDatasetMeta(0).data[1] ? 1 : 0 }], {x:point.x,y:point.y}); c.update('none'); } })`,
          )
          await delay(200)
          if (dark) {
            const tooltip = await inspect('.chartjs-tooltip')
            assert.equal(tooltip.background, 'rgb(23, 38, 61)')
            assert.ok(contrast(tooltip.color, tooltip.background) >= 4.5)
            assert.deepEqual(
              await evaluate(
                "[...document.querySelectorAll('.management-metric')].map(e => getComputedStyle(e).borderTopColor)",
              ),
              ['rgb(59, 130, 246)', 'rgb(34, 197, 94)', 'rgb(56, 189, 248)', 'rgb(251, 191, 36)'],
            )
          }
          await capture(`audit-chart-tooltips-${theme}-${width}`)
          if (width >= 992) {
            await mouse(30, 160)
            assert.equal((await inspect('.smart-sidebar')).width, 240)
            await capture(`audit-sidebar-hover-${theme}-${width}`)
            await click('.smart-sidebar-pin')
            await mouse(width - 25, 100)
            assert.equal((await inspect('.smart-sidebar')).width, 240)
            await capture(`audit-sidebar-pinned-${theme}-${width}`)
            await click('.smart-sidebar-pin')
            await mouse(width - 25, 100)
            assert.equal((await inspect('.smart-sidebar')).width, 68)
          } else {
            await click('#sidebar-menu-toggle')
            await capture(`audit-sidebar-mobile-${theme}-${width}`)
            await key('Escape')
          }
        }
        results.push(`${theme}:${width}:${route}`)
      }
      await evaluate('window.themePreview.fail(true)')
      await button('Actualizar')
      await waitFor("!!document.querySelector('.alert-danger')")
      const error = await inspect('.alert-danger')
      assert.ok(contrast(error.color, error.background) >= 4.5)
      await capture(`audit-error-${theme}-${width}`)
      await evaluate('window.themePreview.fail(false); window.themePreview.loading(true)')
      await button('Actualizar')
      await waitFor("!!document.querySelector('[role=status] .spinner-border')")
      await capture(`audit-loading-${theme}-${width}`)
      await evaluate('window.themePreview.loading(false)')
    }
    diagnostic(
      `Tema verificado a ${width}px en modo claro/oscuro: 9 pantallas, tablas, formularios, modales, errores y gráficas.`,
    )
  }
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await navigate('/dashboard', 'Dashboard')
  await waitFor('window.themePreview.charts().length === 3')
  assert.ok(
    await evaluate('window.themePreview.charts().every(c => c.options.animation === false)'),
  )
  await key('Tab')
  await evaluate("document.getElementById('sidebar-menu-toggle').focus()")
  const focus = await inspect('#sidebar-menu-toggle')
  assert.notEqual(focus.outline, 'none')
  diagnostic(
    `Revisiones completadas: ${results.length}. Contraste de texto/controles comprobado >= 4.5:1. Datos de gráficas conservados al cambiar de tema.`,
  )
}
