import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import React from 'react'
import { transformWithOxc } from 'vite'

test('Modal compartido: política de cierre, backdrop único, variantes y título accesible sin mutar hijos', async () => {
  const require = createRequire(import.meta.url)
  const core = require('@coreui/react')
  const source = (
    await readFile(new URL('../src/components/management/AppModal.jsx', import.meta.url), 'utf8')
  )
    .replace(
      /import React, {([^}]+)} from 'react'/,
      "const React = require('react'); const {$1} = React",
    )
    .replace(/import PropTypes from 'prop-types'/, "const PropTypes = require('prop-types')")
    .replace(/import {([^}]+)} from '@coreui\/react'/, "const {$1} = require('@coreui/react')")
    .replace(/import { createPortal } from 'react-dom'/, 'const createPortal = node => node')
    .replace('export const ModalPresence', 'const ModalPresence')
    .replace('export default AppModal', 'module.exports = AppModal')
  const { code } = await transformWithOxc(source, 'AppModal.jsx', {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  })
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    require(name) {
      if (name === 'react')
        return {
          ...React,
          useId: () => 'generated-modal-title',
          useState: (value) => [value, () => {}],
          useRef: (value) => ({ current: value }),
          useLayoutEffect: () => {},
        }
      if (name === '@coreui/react') return core
      return require(name)
    },
  })
  const AppModal = module.exports
  const title = React.createElement(core.CModalTitle, null, 'Formulario')
  const header = React.createElement(core.CModalHeader, null, title)
  let closed = 0,
    prevented = 0
  const close = () => {
    closed++
  }
  const rendered = AppModal({
    visible: true,
    backdrop: 'static',
    keyboard: false,
    onClose: close,
    onClosePrevented: () => {
      prevented++
    },
    children: header,
    portal: false,
  })
  const [modal, backdrop] = React.Children.toArray(rendered.props.children)
  assert.equal(modal.props.size, 'lg')
  assert.equal(modal.props.style['--tc-modal-enter-duration'], '280ms')
  assert.equal(modal.props.scrollable, true)
  assert.equal(modal.props.backdrop, false)
  assert.equal(modal.props.keyboard, false)
  assert.equal(modal.props.visible, true)
  assert.equal(backdrop.props.className, 'modal-backdrop app-modal-backdrop opening')
  assert.equal(modal.props.transition, false)
  assert.equal(modal.props['aria-labelledby'], 'generated-modal-title')
  const clonedHeader = React.Children.toArray(modal.props.children)[0]
  assert.equal(
    React.Children.toArray(clonedHeader.props.children)[0].props.id,
    'generated-modal-title',
  )
  assert.equal(title.props.id, undefined)
  const root = {}
  modal.props.onMouseDownCapture({ target: root })
  modal.props.onMouseUpCapture({ target: root, currentTarget: root, stopPropagation() {} })
  assert.equal(prevented, 1, 'El backdrop estático conserva el formulario')
  modal.props.onKeyDownCapture({
    key: 'Escape',
    stopPropagation() {
      throw new Error('Escape deshabilitado')
    },
  })
  React.Children.toArray(clonedHeader.props.children).at(-1).props.onClick()
  assert.equal(closed, 0, 'La X no notifica el cierre antes de terminar la salida')
  const explicit = React.Children.toArray(
    AppModal({
      children: header,
      visible: true,
      portal: false,
      size: 'sm',
      duration: 0,
      scrollable: false,
      'aria-labelledby': 'existing-title',
    }).props.children,
  )[0]
  assert.equal(explicit.props.size, 'sm')
  assert.equal(explicit.props.style['--tc-modal-enter-duration'], '0ms')
  assert.equal(explicit.props.scrollable, false)
  assert.equal(explicit.props['aria-labelledby'], 'existing-title')
})
