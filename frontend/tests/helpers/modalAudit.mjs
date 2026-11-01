import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

export async function auditModals({ send, evaluate, waitFor, click, key, capture, diagnostic }) {
  const button = async (text) => {
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)});
      if (!b || b.disabled) throw new Error('Botón no disponible: ' + ${JSON.stringify(text)}); b.click();
    })()`)
  }
  const variants = [
    ['/respaldos', 'Crear copia de seguridad', 'small', 420],
    ['/proveedores', 'Nuevo proveedor', 'medium', 680],
    ['/productos', 'Nuevo producto', 'product', 680],
    ['/compras', 'Nueva compra', 'large', 1040],
    ['/ventas', 'Nueva venta', 'sale', 1040],
  ]
  let scrolled = 0
  const metrics = () =>
    evaluate(`(() => {
    const modal = document.querySelector('.modal.show');
    const body = modal.querySelector('.modal-body'); const header = modal.querySelector('.modal-header');
    const content = modal.querySelector('.modal-content');
    const footer = modal.querySelector('.modal-footer') || modal.querySelector('.modal-actions');
    const rect = e => { const r = e.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height} };
    return {content:rect(content), header:rect(header), footer:footer ? rect(footer):null,
      scroll:body.scrollHeight-body.clientHeight, bodyTop:body.scrollTop,
      bodyOverflow:body.scrollWidth-body.clientWidth, outerOverflow:modal.scrollHeight-modal.clientHeight,
      background:getComputedStyle(content).backgroundColor, blur:getComputedStyle(document.querySelector('.modal-backdrop')).backdropFilter,
      contentFilter:getComputedStyle(content).filter, rootWidth:document.documentElement.scrollWidth, viewport:innerWidth, viewportHeight:innerHeight,
      name:modal.getAttribute('aria-labelledby'), title:!!document.getElementById(modal.getAttribute('aria-labelledby'))};
  })()`)
  for (const width of [1440, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    for (const theme of ['light', 'dark']) {
      await evaluate(
        `localStorage.setItem('coreui-free-react-admin-template-theme','${theme}'); document.documentElement.setAttribute('data-coreui-theme','${theme}')`,
      )
      for (const [route, label, variant, nominal] of variants) {
        await evaluate(`window.themePreview.navigate('${route}'); window.scrollTo(0,0)`)
        await waitFor(
          `!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(label)} && !e.disabled)`,
        )
        await button(label)
        await waitFor("!!document.querySelector('.modal.show .modal-body')")
        await waitFor(
          "[...document.querySelector('.modal.show .modal-dialog').getAnimations(), ...document.querySelector('.modal-backdrop').getAnimations()].every(a => a.playState === 'finished')",
        )
        const before = await metrics()
        assert.equal(before.background, theme === 'dark' ? 'rgb(17, 28, 46)' : 'rgb(255, 255, 255)')
        assert.equal(before.blur, 'blur(5px)')
        assert.equal(before.contentFilter, 'none')
        assert.ok(before.title, 'El título identifica el diálogo accesible')
        assert.ok(before.content.width <= nominal + 1 && before.content.width <= width - 20)
        assert.ok(before.content.height <= 0.9 * before.viewportHeight + 1)
        assert.ok(before.content.left >= 0 && before.content.right <= width)
        assert.ok(
          before.bodyOverflow <= 1 && before.outerOverflow <= 1,
          `${variant}: sin doble scroll ni desbordamiento`,
        )
        assert.ok(before.rootWidth <= width)
        assert.ok(
          before.footer && before.footer.bottom <= before.viewportHeight,
          `${variant}: acciones visibles al abrir`,
        )
        await capture(`modal-${theme}-${width}-${variant}`)
        // Static forms must retain edits after Escape and an outside click.
        await key('Escape')
        assert.ok(await evaluate("!!document.querySelector('.modal.show')"))
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: 2,
          y: 2,
          button: 'left',
          clickCount: 1,
        })
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: 2,
          y: 2,
          button: 'left',
          clickCount: 1,
        })
        await delay(450)
        assert.ok(await evaluate("!!document.querySelector('.modal.show')"))
        await evaluate("document.querySelector('.modal.show .modal-body').scrollTop = 100000")
        const after = await metrics()
        assert.equal(after.header.top, before.header.top)
        assert.ok(after.footer.bottom <= after.viewportHeight)
        assert.ok(
          after.footer.top >= after.header.bottom,
          `${variant}: acciones separadas del encabezado`,
        )
        if (after.bodyTop > 0) {
          scrolled++
          await capture(`modal-scrolled-${theme}-${width}-${variant}`)
        }
        // Native required fields and selects still participate in their original forms.
        if (variant === 'medium' || variant === 'product' || variant === 'large') {
          const invalid = await evaluate(
            `(() => { const form = document.querySelector('.modal.show form'); return form ? !form.checkValidity() : false })()`,
          )
          assert.ok(invalid, 'Conserva validación nativa de campos obligatorios')
        }
        if (variant === 'sale') {
          const formId = await evaluate("document.querySelector('.modal.show form').id")
          assert.ok(formId)
          assert.equal(
            await evaluate(
              "[...document.querySelectorAll('.modal.show .modal-actions button')].find(e => e.type === 'submit').form.id",
            ),
            formId,
          )
        }
        await key('Tab')
        assert.ok(
          await evaluate("document.querySelector('.modal.show').contains(document.activeElement)"),
          'El foco se mantiene dentro del diálogo',
        )
        await evaluate("document.querySelector('.modal.show .btn-close').click()")
        await waitFor(
          "!document.querySelector('.modal.show') && !document.querySelector('.modal-backdrop')",
        )
      }
    }
    diagnostic(
      `Modales a ${width}px: 5 variantes reales en claro/oscuro, tamaños, capas, foco, validación y scroll.`,
    )
  }
  assert.ok(scrolled >= 4, 'Se ejercitan formularios largos con scroll interno')
  await evaluate("window.themePreview.navigate('/ventas')")
  await waitFor(
    "!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Nueva venta' && !e.disabled)",
  )
  await button('Nueva venta')
  await waitFor("!!document.querySelector('.modal.show')")
  const set = async (selector, value) => {
    await evaluate(
      `(() => { const e = document.querySelector('${selector}'); e.value = '${value}'; e.dispatchEvent(new Event('change', {bubbles:true})); })()`,
    )
  }
  await evaluate("document.getElementById('sale-client').focus()")
  await key('ArrowDown')
  await key('Enter')
  // Select via the native control, retaining React's normal change handler.
  await set('#sale-client', '1')
  await set('#sale-branch', '1')
  await set('#sale-product', '1')
  await button('Agregar producto')
  await evaluate(
    "(() => { const e=document.getElementById('sale-number'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'BORRADOR-PRUEBA'); e.dispatchEvent(new Event('input',{bubbles:true})); })()",
  )
  await button('Revisar venta')
  await waitFor(
    "!![...document.querySelectorAll('.modal.show button')].find(e=>e.textContent.trim()==='Guardar borrador')",
  )
  await capture('modal-sale-review')
  await button('Editar')
  assert.equal(await evaluate("document.getElementById('sale-number').value"), 'BORRADOR-PRUEBA')
  await evaluate("document.querySelector('.modal.show .btn-close').click()")
  await waitFor("!document.querySelector('.modal.show')")
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await evaluate("window.themePreview.navigate('/proveedores')")
  await waitFor(
    "!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Nuevo proveedor' && !e.disabled)",
  )
  await button('Nuevo proveedor')
  await waitFor("!!document.querySelector('.modal.show')")
  assert.ok(
    await evaluate(
      "getComputedStyle(document.querySelector('.modal-dialog')).transitionDuration.split(',').every(v => parseFloat(v) === 0)",
    ),
  )
  await evaluate("document.querySelector('.modal.show .btn-close').click()")
  diagnostic(
    `40 vistas revisadas; ${scrolled} formularios con scroll. No se realizaron escrituras ni se contactó una API real.`,
  )
}
