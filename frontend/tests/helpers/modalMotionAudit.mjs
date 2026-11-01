import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

export async function auditModalMotion({ send, evaluate, waitFor, capture, diagnostic }) {
  const frame = () =>
    evaluate(`(() => {
    const modal = document.querySelector('.app-modal');
    const dialog = modal?.querySelector('.modal-dialog');
    const overlay = document.querySelector('.app-modal-backdrop');
    return { present:!!modal, backdrops:document.querySelectorAll('.modal-backdrop').length,
      closing:modal?.classList.contains('closing'), opacity:dialog ? +getComputedStyle(dialog).opacity : null,
      duration:dialog ? getComputedStyle(dialog).animationDuration : null,
      transform:dialog ? getComputedStyle(dialog).transform : null,
      overlayOpacity:overlay ? +getComputedStyle(overlay).opacity : null,
      blur:overlay ? getComputedStyle(overlay).backdropFilter : null,
      locked:document.body.style.overflow === 'hidden',
      focused:!!modal?.contains(document.activeElement),
      content:document.querySelector('#motion-input')?.value,
      horizontal:document.documentElement.scrollWidth > innerWidth};
  })()`)
  let cycles = 0
  for (const theme of ['light', 'dark']) {
    await evaluate(`document.documentElement.dataset.coreuiTheme = '${theme}'`)
    for (const width of [1440, 1024, 768, 390]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      for (const size of ['sm', 'lg', 'xl']) {
        for (const method of ['x', 'cancel', 'escape', 'backdrop']) {
          await evaluate(`window.modalMotion.open({size:'${size}'})`)
          await waitFor("!!document.querySelector('.app-modal.show')")
          const first = await frame()
          assert.equal(first.backdrops, 1)
          assert.equal(first.locked, true)
          assert.equal(first.duration, '0.28s')
          await delay(90)
          const middle = await frame()
          assert.ok(middle.opacity >= first.opacity)
          await delay(230)
          await waitFor(
            "[...document.querySelector('.app-modal .modal-dialog').getAnimations(), ...document.querySelector('.app-modal-backdrop').getAnimations()].every(a => a.playState === 'finished')",
          )
          const opened = await frame()
          if (opened.opacity !== 1)
            diagnostic(
              await evaluate(
                `JSON.stringify({frame:${JSON.stringify(opened)}, animations:document.getAnimations().map(a=>({name:a.animationName,time:a.currentTime,state:a.playState,frames:a.effect.getKeyframes()}))})`,
              ),
            )
          assert.equal(opened.opacity, 1)
          assert.equal(opened.blur, 'blur(5px)')
          assert.equal(opened.horizontal, false)
          await evaluate(`document.querySelector('#motion-input').focus()`)
          await evaluate(`window.motionFrames = []; window.motionFinished = new Promise(resolve => {
            const started = performance.now();
            const tick = () => {
              const modal = document.querySelector('.app-modal');
              if (!modal) return resolve(window.motionFrames);
              if (modal.classList.contains('closing')) {
                const dialog = modal.querySelector('.modal-dialog');
                const overlay = document.querySelector('.app-modal-backdrop');
                window.motionFrames.push({elapsed:performance.now()-started,
                  opacity:+getComputedStyle(dialog).opacity, overlayOpacity:+getComputedStyle(overlay).opacity,
                  duration:getComputedStyle(dialog).animationDuration,
                  locked:document.body.style.overflow === 'hidden', focused:modal.contains(document.activeElement),
                  content:document.querySelector('#motion-input')?.value,
                  backdrops:document.querySelectorAll('.modal-backdrop').length});
              }
              requestAnimationFrame(tick);
            }; requestAnimationFrame(tick);
          }); true`)
          if (method === 'x')
            await evaluate("document.querySelector('.app-modal .btn-close').click()")
          if (method === 'cancel')
            await evaluate("document.querySelector('#motion-cancel').click()")
          if (method === 'escape')
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' })
          if (method === 'backdrop') {
            for (const type of ['mousePressed', 'mouseReleased'])
              await send('Input.dispatchMouseEvent', {
                type,
                x: 2,
                y: 2,
                button: 'left',
                clickCount: 1,
              })
          }
          const frames = await evaluate('window.motionFinished')
          assert.ok(frames.length > 0, `${method}: exit retained`)
          assert.ok(
            frames.every((frame) => frame.locked && frame.focused && frame.backdrops === 1),
            `${method}: background locked, focus retained, single backdrop`,
          )
          assert.ok(
            frames.every(
              (frame) => frame.content === 'Conservar contenido' && frame.duration === '0.22s',
            ),
          )
          assert.ok(
            frames.some((frame) => frame.opacity > 0 && frame.opacity < 1),
            'Intermediate dialog opacity',
          )
          assert.ok(
            frames.some((frame) => frame.overlayOpacity > 0 && frame.overlayOpacity < 1),
            'Intermediate backdrop opacity',
          )
          assert.ok(frames.at(-1).elapsed >= 150, 'No CoreUI 150ms cutoff')
          await waitFor(
            "!document.querySelector('.app-modal') && !document.querySelector('.modal-backdrop')",
          )
          assert.equal((await frame()).locked, false)
          cycles++
        }
      }
    }
  }
  // Static/disabled dismissal policies and rapid close during entrance.
  await evaluate("window.modalMotion.open({size:'lg',static:true,noKeyboard:true})")
  await delay(320)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' })
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: 2, y: 2, button: 'left', clickCount: 1 })
  await delay(250)
  assert.equal((await frame()).closing, false)
  assert.equal(await evaluate('window.modalMotionPrevented'), true)
  await capture('modal-motion-dark')
  await evaluate('window.modalMotion.clear()')
  await waitFor("!document.querySelector('.app-modal')")
  for (let i = 0; i < 4; i++) {
    await evaluate("window.modalMotion.open({size:'sm'})")
    await waitFor("!!document.querySelector('.app-modal.show')")
    await delay(30)
    const { before, after } = await evaluate(`(() => {
      const dialog = document.querySelector('.app-modal .modal-dialog');
      const before = +getComputedStyle(dialog).opacity;
      document.querySelector('.app-modal .btn-close').click();
      return new Promise(resolve => requestAnimationFrame(() => resolve({before,after:+getComputedStyle(dialog).opacity})));
    })()`)
    assert.ok(after <= before + 0.01, 'Early exit must not jump to full opacity')
    await waitFor(
      "!document.querySelector('.app-modal') && !document.querySelector('.modal-backdrop')",
    )
  }
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await evaluate("window.modalMotion.open({size:'sm'})")
  await delay(60)
  assert.equal((await frame()).transform, 'none')
  await evaluate("document.querySelector('.app-modal .btn-close').click()")
  await delay(60)
  assert.equal((await frame()).present, false)
  assert.equal((await frame()).backdrops, 0)
  assert.equal((await frame()).locked, false)
  await send('Emulation.setEmulatedMedia', { features: [] })
  diagnostic(
    `Animaciones: ${cycles} ciclos completos, 3 tamaños, 4 cierres, 4 anchos, 2 temas; cierre temprano, políticas estáticas y movimiento reducido.`,
  )
}
