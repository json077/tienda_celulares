import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import { auditTheme } from './helpers/themeAudit.mjs'
import { auditProfile } from './helpers/profileAudit.mjs'
import { auditModals } from './helpers/modalAudit.mjs'
import { auditModalMotion } from './helpers/modalMotionAudit.mjs'

// Opt-in real Chromium checks without adding a browser automation dependency.
test(
  'Sidebar en navegador: 1440/1024/768/390, hover, pin, teclado, scroll, temas y movimiento reducido',
  {
    skip: process.env.SIDEBAR_BROWSER !== '1',
    timeout:
      process.env.THEME_BROWSER === '1' || process.env.MODAL_BROWSER === '1' ? 300000 : 120000,
  },
  async (t) => {
    const profile = await mkdtemp(path.join(tmpdir(), 'tienda-sidebar-'))
    const server = await createServer({
      root: fileURLToPath(new URL('..', import.meta.url)),
      optimizeDeps:
        process.env.THEME_BROWSER === '1' ||
        process.env.PROFILE_BROWSER === '1' ||
        process.env.MODAL_BROWSER === '1'
          ? {
              entries: [
                `tests/fixtures/${process.env.PROFILE_BROWSER === '1' ? 'profile' : 'theme'}-preview.jsx`,
              ],
              include: ['chart.js', '@coreui/react-chartjs'],
            }
          : { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 4178, strictPort: true },
      plugins: [
        {
          name: 'sidebar-browser-fixture',
          configureServer(vite) {
            vite.middlewares.use('/__sidebar', async (_req, res) => {
              res.setHeader('Content-Type', 'text/html')
              res.end(
                await vite.transformIndexHtml(
                  '/__sidebar',
                  `<html><head></head><body><div id="root"></div><script type="module" src="/tests/fixtures/${process.env.PROFILE_BROWSER === '1' ? 'profile' : process.env.THEME_BROWSER === '1' || process.env.MODAL_BROWSER === '1' ? 'theme' : 'sidebar'}-preview.jsx"></script></body></html>`,
                ),
              )
            })
          },
        },
      ],
    })
    let browser, socket
    try {
      await server.listen()
      console.log('Sidebar browser: servidor listo')
      browser = spawn(
        process.env.SIDEBAR_BROWSER_PATH ||
          'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--remote-debugging-port=0',
          `--user-data-dir=${profile}`,
          'about:blank',
        ],
        { windowsHide: true, stdio: 'ignore' },
      )
      let port
      for (let i = 0; i < 100; i++) {
        try {
          port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]
          break
        } catch {
          await delay(100)
        }
      }
      assert.ok(port, 'El navegador debe iniciar con un perfil de prueba aislado')
      console.log('Sidebar browser: navegador listo')
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
      await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
      console.log('Sidebar browser: CDP conectado')
      let id = 0
      const pending = new Map()
      const errors = []
      socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data)
        if (message.method === 'Runtime.exceptionThrown')
          errors.push(message.params.exceptionDetails.text)
        if (message.id) {
          const job = pending.get(message.id)
          pending.delete(message.id)
          if (message.error) job.reject(new Error(JSON.stringify(message.error)))
          else job.resolve(message.result)
        }
      })
      const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
          const requestId = ++id
          const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 10000)
          pending.set(requestId, {
            resolve: (result) => {
              clearTimeout(timeout)
              resolve(result)
            },
            reject: (error) => {
              clearTimeout(timeout)
              reject(error)
            },
          })
          socket.send(JSON.stringify({ id, method, params }))
        })
      const evaluate = async (expression) => {
        const result = await send('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
        })
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
        return result.result.value
      }
      const waitFor = async (expression) => {
        for (let i = 0; i < 100; i++) {
          if (await evaluate(expression)) return
          await delay(80)
        }
        throw new Error(`No se cumplió: ${expression}`)
      }
      const mouse = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await delay(280)
      }
      const click = async (selector) => {
        const point = await evaluate(
          `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`,
        )
        await mouse(point.x, point.y)
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          button: 'left',
          clickCount: 1,
          ...point,
        })
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          button: 'left',
          clickCount: 1,
          ...point,
        })
        await delay(300)
      }
      const key = async (key, modifiers = 0) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key, modifiers })
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers })
        await delay(280)
      }
      const metrics = () =>
        evaluate(`(() => {
      const sidebar = document.querySelector('.smart-sidebar');
      const wrapper = document.querySelector('.wrapper');
      const nav = sidebar.querySelector('.nav-link');
      const icon = nav.querySelector('.nav-icon').getBoundingClientRect();
      const action = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Actualizar resumen'));
      const rect = action?.getBoundingClientRect();
      return {
        width: sidebar.getBoundingClientRect().width,
        left: sidebar.getBoundingClientRect().left,
        occupy: parseFloat(getComputedStyle(wrapper).paddingInlineStart),
        iconX: icon.x, active: !!sidebar.querySelector('.nav-link.active'),
        scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        dashboardControl: !rect || (rect.x >= 0 && rect.right <= innerWidth),
        labelOpacity: getComputedStyle(sidebar.querySelector('.nav-link .smart-sidebar-label')).opacity,
        background: getComputedStyle(sidebar).backgroundColor,
      }
    })()`)
      const artifacts = fileURLToPath(
        new URL('../node_modules/.cache/sidebar-checks/', import.meta.url),
      )
      await mkdir(artifacts, { recursive: true })
      const capture = async (name) => {
        const screenshot = await send('Page.captureScreenshot', { format: 'png' })
        await writeFile(path.join(artifacts, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
      }
      await send('Runtime.enable')
      await send('Page.enable')
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await send('Page.navigate', { url: 'http://127.0.0.1:4178/__sidebar' })
      console.log('Sidebar browser: página cargada')
      await waitFor(
        process.env.PROFILE_BROWSER === '1'
          ? "!!document.querySelector('.profile-view')"
          : "document.querySelectorAll('.dashboard-view canvas').length === 3",
      )
      if (
        process.env.THEME_BROWSER !== '1' &&
        process.env.PROFILE_BROWSER !== '1' &&
        process.env.MODAL_BROWSER !== '1'
      ) {
        await mouse(900, 100)
        const results = []
        for (const width of [1440, 1024]) {
          await send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 700,
            deviceScaleFactor: 1,
            mobile: false,
          })
          await mouse(width - 20, 100)
          const compact = await metrics()
          assert.equal(compact.width, 68)
          assert.equal(compact.occupy, 68)
          assert.equal(compact.labelOpacity, '0')
          assert.equal(compact.background, 'rgb(16, 28, 53)')
          assert.equal(
            await evaluate(
              "getComputedStyle(document.querySelector('.nav-link.active')).backgroundColor",
            ),
            'rgb(37, 99, 235)',
          )
          assert.ok(compact.active && compact.dashboardControl)
          assert.ok(compact.scrollWidth <= width)
          assert.equal(await evaluate("document.querySelector('.nav-link').title"), 'Dashboard')
          await capture(`compact-${width}`)
          await mouse(32, 160)
          const hover = await metrics()
          assert.equal(hover.width, 240)
          assert.equal(hover.occupy, 68)
          assert.equal(hover.iconX, compact.iconX)
          await capture(`hover-${width}`)
          await mouse(180, 80)
          assert.equal((await metrics()).width, 240, 'Moverse dentro del sidebar no lo contrae')
          await click('.smart-sidebar-pin')
          await mouse(width - 20, 100)
          const pinned = await metrics()
          assert.equal(pinned.width, 240)
          assert.equal(pinned.occupy, 240)
          assert.equal(
            await evaluate("localStorage.getItem('tienda-celulares.sidebar-pinned')"),
            'true',
          )
          await key('Escape')
          assert.equal((await metrics()).width, 240)
          await click('.smart-sidebar-pin')
          await mouse(width - 20, 100)
          assert.equal((await metrics()).width, 68)
          // Keyboard focus opens it; Escape dismisses without moving content.
          await evaluate("document.querySelector('.smart-sidebar .sidebar-brand').focus()")
          await key('Tab')
          assert.equal((await metrics()).width, 240)
          await key('Escape')
          assert.equal((await metrics()).width, 68)
          await evaluate('document.activeElement.blur()')
          results.push({ width, compact, hover, pinned })
        }
        // Independent navigation scroll at a short viewport height.
        await send('Emulation.setDeviceMetricsOverride', {
          width: 1024,
          height: 420,
          deviceScaleFactor: 1,
          mobile: false,
        })
        await mouse(32, 160)
        const scroll = await evaluate(`(() => {
      const nav = document.querySelector('.sidebar-nav .simplebar-content-wrapper');
      const pageY = scrollY; nav.scrollTop = nav.scrollHeight;
      return { top: nav.scrollTop, pageY, after: scrollY };
    })()`)
        assert.ok(scroll.top > 0)
        assert.equal(scroll.pageY, scroll.after)
        await evaluate(
          "document.querySelector('.sidebar-nav .simplebar-content-wrapper').scrollTop = 0",
        )
        for (const width of [768, 390]) {
          await send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 844,
            deviceScaleFactor: 1,
            mobile: false,
          })
          await mouse(width - 20, 100)
          await delay(300)
          const closed = await metrics()
          assert.equal(closed.occupy, 0)
          assert.ok(closed.left + closed.width <= 1)
          assert.ok(closed.scrollWidth <= width && closed.dashboardControl)
          assert.equal(await evaluate("document.querySelector('.smart-sidebar').inert"), true)
          await click('#sidebar-menu-toggle')
          await waitFor("document.querySelector('.smart-sidebar').classList.contains('show')")
          assert.equal((await metrics()).left, 0)
          assert.equal(
            await evaluate("document.activeElement.getAttribute('aria-label')"),
            'Cerrar menú lateral',
          )
          await key('Tab', 8)
          assert.equal(
            await evaluate("document.activeElement.getAttribute('aria-label')"),
            'Tienda Celulares, inicio',
          )
          await key('Tab', 8)
          assert.equal(
            await evaluate("document.activeElement.getAttribute('aria-label')"),
            'Respaldos',
          )
          await key('Tab')
          assert.equal(
            await evaluate("document.activeElement.getAttribute('aria-label')"),
            'Tienda Celulares, inicio',
          )
          await capture(`mobile-open-${width}`)
          await key('Escape')
          assert.equal(await evaluate('document.activeElement.id'), 'sidebar-menu-toggle')
          await click('#sidebar-menu-toggle')
          await click('.smart-sidebar .btn-close')
          assert.equal((await metrics()).occupy, 0)
          await click('#sidebar-menu-toggle')
          await click('.sidebar-backdrop')
          await waitFor("!document.querySelector('.smart-sidebar').classList.contains('show')")
          await click('#sidebar-menu-toggle')
          await evaluate('document.querySelector(\'.smart-sidebar a[href="/productos"]\').click()')
          await waitFor("!document.querySelector('.smart-sidebar').classList.contains('show')")
          await waitFor(
            "document.querySelector('.smart-sidebar a[href=\"/productos\"]').classList.contains('active')",
          )
          await click('#sidebar-menu-toggle')
          await evaluate('document.querySelector(\'.smart-sidebar a[href="/dashboard"]\').click()')
          await waitFor("document.querySelectorAll('.dashboard-view canvas').length === 3")
          results.push({ width, closed, openedWithoutOccupancy: true })
        }
        await send('Emulation.setDeviceMetricsOverride', {
          width: 1440,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        })
        await mouse(900, 100)
        assert.equal((await metrics()).width, 68, 'Volver a escritorio conserva la franja compacta')
        for (const theme of ['light', 'dark']) {
          await evaluate(`document.documentElement.setAttribute('data-coreui-theme', '${theme}')`)
          await mouse(32, 160)
          assert.equal(
            (await metrics()).background,
            theme === 'dark' ? 'rgb(23, 38, 61)' : 'rgb(16, 28, 53)',
          )
          assert.equal(
            await evaluate(
              "getComputedStyle(document.querySelector('.nav-link.active')).backgroundColor",
            ),
            theme === 'dark' ? 'rgb(59, 130, 246)' : 'rgb(37, 99, 235)',
          )
          await capture(`theme-${theme}`)
          assert.ok((await metrics()).scrollWidth <= 1440)
          await mouse(900, 100)
        }
        await send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        })
        assert.equal(
          await evaluate(
            "getComputedStyle(document.querySelector('.smart-sidebar')).transitionDuration",
          ),
          '0s',
        )
        await mouse(32, 160)
        await click('.smart-sidebar-pin')
        await send('Page.reload')
        await waitFor("document.querySelector('.smart-sidebar')?.dataset.pinned === 'true'")
        await delay(300)
        assert.equal((await metrics()).occupy, 240, 'Se restaura únicamente la fijación')
        await evaluate('window.sidebarPreview.setRestricted(true)')
        await waitFor("document.querySelectorAll('.smart-sidebar a.nav-link').length === 1")
        await evaluate('window.sidebarPreview.setRestricted(false)')
        await waitFor("document.querySelectorAll('.smart-sidebar a.nav-link').length === 15")
        await click('[aria-label="Menú de usuario: prueba"]')
        await evaluate(
          "[...document.querySelectorAll('.dropdown-item')].find(e => e.textContent.includes('Cerrar sesión')).click()",
        )
        assert.equal(await evaluate('window.sidebarLoggedOut'), true)
        t.diagnostic(JSON.stringify({ results, scroll, browserErrors: errors }))
      }
      if (process.env.THEME_BROWSER === '1') {
        await auditTheme({
          send,
          evaluate,
          waitFor,
          mouse,
          click,
          key,
          capture,
          diagnostic: (value) => t.diagnostic(value),
        })
      }
      if (process.env.PROFILE_BROWSER === '1') {
        await auditProfile({
          send,
          evaluate,
          waitFor,
          click,
          capture,
          diagnostic: (value) => t.diagnostic(value),
        })
      }
      if (process.env.MODAL_BROWSER === '1') {
        await auditModalMotion({
          send,
          evaluate,
          waitFor,
          capture,
          diagnostic: (value) => t.diagnostic(value),
        })
        await auditModals({
          send,
          evaluate,
          waitFor,
          click,
          key,
          capture,
          diagnostic: (value) => t.diagnostic(value),
        })
      }
      assert.deepEqual(errors, [])
    } catch (error) {
      console.error(error)
      throw error
    } finally {
      socket?.close()
      browser?.kill()
      await server.close()
      // Only the exact isolated directory created above is removed.
      if (
        path.dirname(profile) === tmpdir() &&
        path.basename(profile).startsWith('tienda-sidebar-')
      ) {
        await delay(500)
        await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      }
    }
  },
)
