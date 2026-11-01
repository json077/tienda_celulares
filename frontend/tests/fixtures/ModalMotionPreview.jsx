import React, { useState } from 'react'
import { CButton, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import AppModal, { ModalPresence } from '../../src/components/management/AppModal'

// Isolated controls; no requests or business operations are performed.
export default function ModalMotionPreview() {
  const [config, setConfig] = useState(null)
  window.modalMotion = {
    open: (options) => setConfig(options),
    clear: () => setConfig(null),
    reopen: () => setConfig((value) => ({ ...value })),
  }
  return (
    <ModalPresence>
      {config && (
        <AppModal
          visible
          size={config.size}
          backdrop={config.static ? 'static' : true}
          keyboard={!config.noKeyboard}
          onClose={() => {
            window.modalMotionCloses = (window.modalMotionCloses || 0) + 1
            setConfig(null)
          }}
          onClosePrevented={() => {
            window.modalMotionPrevented = true
          }}
        >
          <CModalHeader>
            <CModalTitle>Prueba de transición</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <label htmlFor="motion-input">Campo de prueba</label>
            <input id="motion-input" className="form-control" defaultValue="Conservar contenido" />
            {Array.from({ length: 20 }, (_, index) => (
              <p key={index}>Contenido para comprobar scroll {index + 1}</p>
            ))}
          </CModalBody>
          <CModalFooter>
            <CButton id="motion-cancel" onClick={() => setConfig(null)}>
              Cancelar
            </CButton>
          </CModalFooter>
        </AppModal>
      )}
    </ModalPresence>
  )
}
