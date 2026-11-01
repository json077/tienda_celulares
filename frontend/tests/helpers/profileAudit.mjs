import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

export async function auditProfile({ send, evaluate, waitFor, click, capture, diagnostic }) {
  const button = (text) =>
    evaluate(
      `(() => { const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) throw new Error('Botón no disponible'); button.click() })()`,
    )
  const setPasswords = async (actual, nueva, confirmacion) => {
    await evaluate(`(() => { for (const [field, value] of Object.entries(${JSON.stringify({ actual, nueva, confirmacion })})) {
      const input = document.getElementById('profile-' + field);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } })()`)
  }
  const upload = async (mime = 'image/png', invalid = false) => {
    await evaluate(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 100;
      const context = canvas.getContext('2d'); context.fillStyle = '#2563eb'; context.fillRect(0, 0, 80, 100);
      const blob = ${invalid ? "new Blob(['<svg onload=alert(1)></svg>'], {type:'image/png'})" : `await new Promise(resolve => canvas.toBlob(resolve, '${mime}'))`};
      const file = new File([blob], 'profile.' + (${JSON.stringify(mime)} === 'image/jpeg' ? 'jpg' : 'png'), {type: blob.type});
      const transfer = new DataTransfer(); transfer.items.add(file);
      const input = document.getElementById('profile-photo'); input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    })()`)
  }
  await waitFor(
    "document.querySelector('.profile-information')?.textContent.includes('Central de prueba')",
  )
  assert.equal(
    await evaluate("document.querySelectorAll('.profile-view input[type=password]').length"),
    3,
  )
  assert.equal(await evaluate("document.querySelectorAll('.profile-view select').length"), 0)
  for (const width of [1440, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    for (const theme of ['light', 'dark']) {
      await evaluate(
        `localStorage.setItem('coreui-free-react-admin-template-theme', '${theme}'); document.documentElement.setAttribute('data-coreui-theme', '${theme}'); window.scrollTo(0,0)`,
      )
      await delay(300)
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'))
      assert.ok(
        await evaluate(
          "document.querySelector('.profile-information').textContent.includes('ana@example.com')",
        ),
      )
      await capture(`profile-${theme}-${width}`)
      await evaluate(
        "document.querySelector('.profile-view form').scrollIntoView({block:'center'})",
      )
      await capture(`profile-security-${theme}-${width}`)
    }
  }
  await evaluate('window.scrollTo(0,0)')
  await click('[aria-label="Menú de usuario: Ana Prueba"]')
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.dropdown-item')].some(e => e.textContent.trim() === 'Mi perfil')",
    ),
  )
  await button('Mi perfil')
  assert.equal(await evaluate("document.querySelectorAll('.profile-avatar img').length"), 0)
  const beforeInvalid = await evaluate('window.profilePreview.uploads')
  await upload('image/png', true)
  await waitFor("document.querySelector('.alert-danger')?.textContent.includes('válida')")
  assert.equal(await evaluate('window.profilePreview.uploads'), beforeInvalid)
  await upload('image/jpeg')
  await waitFor("document.querySelectorAll('.profile-avatar img').length === 2")
  await waitFor("!!document.querySelector('.alert-success')")
  const firstUrl = await evaluate("document.querySelector('.profile-avatar img').src")
  assert.equal(await evaluate('window.profilePreview.uploads'), 1)
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('.profile-avatar img')].every(e => e.src === document.querySelector('.profile-avatar img').src)",
    ),
    true,
  )
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('.profile-avatar img')].every(e => e.complete && e.naturalWidth > 0)",
    ),
    true,
  )
  await capture('profile-photo-success')
  await upload('image/png')
  await waitFor('window.profilePreview.uploads === 2')
  await waitFor(`document.querySelector('.profile-avatar img').src !== ${JSON.stringify(firstUrl)}`)
  await button('Eliminar fotografía')
  await waitFor("document.querySelectorAll('.profile-avatar img').length === 0")
  assert.equal(await evaluate('window.profilePreview.deletions'), 1)
  await setPasswords('Actual-prueba-123', 'Nueva-prueba-456', 'Nueva-prueba-789')
  await evaluate("document.querySelector('.profile-view form').requestSubmit()")
  await waitFor("document.querySelector('.alert-danger')?.textContent.includes('coincide')")
  assert.equal(await evaluate('window.profilePreview.passwords'), 0)
  await setPasswords('incorrecta', 'Nueva-prueba-456', 'Nueva-prueba-456')
  await evaluate("document.querySelector('.profile-view form').requestSubmit()")
  await waitFor(
    "document.querySelector('.alert-danger')?.textContent.includes('actual no es correcta')",
  )
  await capture('profile-password-error')
  const beforePassword = await evaluate('window.profilePreview.passwords')
  await setPasswords('Actual-prueba-123', 'Nueva-prueba-456', 'Nueva-prueba-456')
  await evaluate(
    "document.querySelector('.profile-view form').requestSubmit(); document.querySelector('.profile-view form').requestSubmit()",
  )
  await waitFor("document.querySelector('.alert-success')?.textContent.includes('contraseña')")
  assert.equal(await evaluate('window.profilePreview.passwords'), beforePassword + 1)
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.profile-view input[type=password]')].every(e => e.value === '')",
    ),
  )
  await capture('profile-password-success')
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.profile-view .card')].every(e => getComputedStyle(e).animationName === 'none')",
    ),
  )
  diagnostic(
    'Mi perfil: 8 vistas responsive claro/oscuro; avatar predeterminado, JPEG/PNG, sustitución, borrado, validación y contraseña con exclusión de doble envío verificados. Sin API real.',
  )
}
