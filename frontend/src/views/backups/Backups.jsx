import React, { useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { CIcon } from '@coreui/icons-react'
import { cilSave, cilCloudDownload, cilWarning, cilReload } from '@coreui/icons'
import { useAuth } from '../../contexts/AuthContext'
import { backupService } from '../../services/backupService'
import { apiErrorMessage } from '../../services/api'
import { PageHeading } from '../../components/management/ManagementUI'
import { assertBackupAction, backupDate, backupSize, runBackupOperation } from './backupModel'

const BackupContent = () => {
  const { can } = useAuth()
  const allowed = can('BACKUP_CREAR')
  const restoreAllowed = can('BACKUP_RESTAURAR')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [listReady, setListReady] = useState(false)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selected, setSelected] = useState('')
  const [dialog, setDialog] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const pending = useRef(false)
  const lifetime = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    backupService
      .list(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setRows(response.data)
          setListReady(true)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [allowed, revision])

  const operate = (kind, row) =>
    runBackupOperation(pending, async () => {
      if (!lifetime.current || lifetime.current.signal.aborted) return
      try {
        assertBackupAction(can, kind, confirmation, row?.id_respaldo)
        if (
          kind === 'restore' &&
          (!listReady || !rows.some((r) => String(r.id_respaldo) === String(row.id_respaldo)))
        )
          throw new Error('Actualiza la lista y selecciona una copia existente.')
        setBusy(kind)
        setError('')
        setSuccess('')
        if (kind === 'download') {
          const blob = await backupService.download(row.id_respaldo)
          if (lifetime.current.signal.aborted) return
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = row.nombre_archivo
          link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
          setSuccess('Copia descargada correctamente.')
        } else {
          const response =
            kind === 'create'
              ? await backupService.create()
              : await backupService.restore(row.id_respaldo)
          if (lifetime.current.signal.aborted) return
          setSuccess(
            response.message ||
              (kind === 'create'
                ? 'Copia creada correctamente.'
                : 'Copia restaurada correctamente.'),
          )
          setDialog(null)
          setConfirmation('')
          setLoading(true)
          setListReady(false)
          setRows([])
          setSelected('')
          setRevision((n) => n + 1)
        }
      } catch (e) {
        if (!lifetime.current.signal.aborted) {
          setError(
            `${apiErrorMessage(e)}${kind === 'create' || kind === 'restore' ? ' Si se perdió la conexión, verifica el resultado antes de repetir la operación.' : ''}`,
          )
          setDialog(null)
          setConfirmation('')
          if (kind === 'restore') {
            setListReady(false)
            setRows([])
            setSelected('')
          }
        }
      } finally {
        if (!lifetime.current.signal.aborted) setBusy('')
      }
    })
  const open = (kind) => {
    if (pending.current || busy || !can(kind === 'restore' ? 'BACKUP_RESTAURAR' : 'BACKUP_CREAR'))
      return
    const row = rows.find((r) => String(r.id_respaldo) === selected)
    if (kind === 'restore' && (!listReady || !row)) return
    setError('')
    setSuccess('')
    setConfirmation('')
    setDialog({ kind, row })
  }
  const close = () => {
    if (!pending.current) {
      setDialog(null)
      setConfirmation('')
    }
  }
  if (!allowed)
    return (
      <CAlert color="warning">No tienes permiso para consultar o crear copias de seguridad.</CAlert>
    )
  return (
    <>
      <PageHeading
        title="Copias de seguridad"
        description="Protege la información del negocio y administra tus copias de MySQL."
        icon={cilSave}
      />
      {error && (
        <CAlert color="danger" role="alert">
          {error}
        </CAlert>
      )}
      {success && (
        <CAlert color="success" role="status">
          {success}
        </CAlert>
      )}
      {busy && (
        <CAlert color="info" role="status">
          <CSpinner size="sm" className="me-2" />
          {busy === 'create'
            ? 'Creando copia de seguridad…'
            : busy === 'restore'
              ? 'Restaurando la base de datos…'
              : 'Preparando descarga…'}{' '}
          Espera a que termine la operación y no cierres esta página.
        </CAlert>
      )}
      <CRow className="g-4 mb-4">
        <CCol lg={5}>
          <CCard className="management-panel h-100">
            <CCardBody>
              <CBadge color="primary" className="mb-3">
                Protección de datos
              </CBadge>
              <h2 className="h5">Crear una copia de seguridad</h2>
              <p className="text-body-secondary">
                Genera una copia SQL de la base de datos actual. Después podrás consultarla y
                descargarla desde el historial.
              </p>
              <CButton color="primary" disabled={!!busy || loading} onClick={() => open('create')}>
                <CIcon icon={cilSave} className="me-2" />
                Crear copia de seguridad
              </CButton>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={7}>
          <CCard className="management-panel border-danger h-100">
            <CCardBody>
              <h2 className="h5">
                <CIcon icon={cilWarning} className="text-danger me-2" />
                Restaurar una copia
              </h2>
              <CAlert color="warning">
                La restauración puede sobrescribir los datos actuales con los de la copia
                seleccionada. Se pueden perder cambios posteriores. Si falla, la base puede quedar
                parcialmente restaurada. Crea y descarga una copia actual antes de continuar.
              </CAlert>
              {!restoreAllowed ? (
                <p className="text-body-secondary mb-0">
                  No tienes permiso para restaurar copias de seguridad.
                </p>
              ) : (
                <>
                  <CFormLabel htmlFor="backup-restore">Copia que deseas restaurar</CFormLabel>
                  <CFormSelect
                    id="backup-restore"
                    value={selected}
                    disabled={!!busy || loading || !listReady}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Selecciona una copia existente</option>
                    {rows.map((row) => (
                      <option key={row.id_respaldo} value={String(row.id_respaldo)}>
                        #{row.id_respaldo} · {row.nombre_archivo} · {backupDate(row.fecha_creacion)}
                      </option>
                    ))}
                  </CFormSelect>
                  <CButton
                    color="danger"
                    variant="outline"
                    className="mt-3"
                    disabled={!selected || !!busy || loading || !listReady}
                    onClick={() => open('restore')}
                  >
                    Revisar y confirmar restauración
                  </CButton>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CCard className="management-panel mb-4">
        <CCardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Historial de copias</h2>
              <p className="small text-body-secondary mb-0">
                Archivos registrados por el servidor · {rows.length} copias
              </p>
            </div>
            <CButton
              color="secondary"
              variant="outline"
              disabled={!!busy || loading}
              onClick={() => {
                if (!pending.current && can('BACKUP_CREAR')) {
                  setError('')
                  setLoading(true)
                  setListReady(false)
                  setRows([])
                  setSelected('')
                  setRevision((n) => n + 1)
                }
              }}
            >
              <CIcon icon={cilReload} className="me-2" />
              Actualizar
            </CButton>
          </div>
          {loading ? (
            <div className="py-4 text-center" role="status">
              <CSpinner size="sm" /> Consultando copias…
            </div>
          ) : !listReady ? (
            <CAlert color="warning">
              No se pudo obtener la lista. Pulsa Actualizar para volver a consultar.
            </CAlert>
          ) : !rows.length ? (
            <div className="management-empty">
              <p className="fw-semibold mb-1">Aún no hay copias de seguridad.</p>
              <p className="small text-body-secondary mb-0">
                Crea la primera copia para proteger la información del negocio.
              </p>
            </div>
          ) : (
            <CTable responsive hover striped className="management-table">
              <CTableHead>
                <CTableRow>
                  {[
                    'ID',
                    'Archivo',
                    'Creación',
                    'Tamaño',
                    'Estado',
                    'Última restauración',
                    'Acciones',
                  ].map((label) => (
                    <CTableHeaderCell key={label} scope="col">
                      {label}
                    </CTableHeaderCell>
                  ))}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((row) => (
                  <CTableRow key={row.id_respaldo}>
                    <CTableDataCell>#{row.id_respaldo}</CTableDataCell>
                    <CTableDataCell className="text-break">{row.nombre_archivo}</CTableDataCell>
                    <CTableDataCell>{backupDate(row.fecha_creacion)}</CTableDataCell>
                    <CTableDataCell className="text-nowrap">
                      {backupSize(row.tamano_bytes)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={row.estado === 'RESTAURADO' ? 'warning' : 'success'}>
                        {row.estado}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{backupDate(row.fecha_restauracion)}</CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        size="sm"
                        color="primary"
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => operate('download', row)}
                      >
                        <CIcon icon={cilCloudDownload} className="me-1" />
                        Descargar
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
      <CModal
        visible={!!dialog}
        onClose={close}
        backdrop="static"
        keyboard={!busy}
        aria-labelledby="backup-confirm-title"
      >
        <CModalHeader closeButton={!busy}>
          <CModalTitle id="backup-confirm-title">
            {dialog?.kind === 'restore' ? 'Confirmar restauración' : 'Confirmar creación de copia'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {dialog?.kind === 'restore' ? (
            <>
              <CAlert color="danger">
                Esta operación puede sobrescribir la base de datos actual. Verifica el archivo antes
                de confirmar.
              </CAlert>
              <p className="text-break">
                Copia #{dialog.row.id_respaldo}: <strong>{dialog.row.nombre_archivo}</strong>
              </p>
              <CFormLabel htmlFor="backup-confirm">
                Escribe RESTAURAR {dialog.row.id_respaldo} para continuar
              </CFormLabel>
              <CFormInput
                id="backup-confirm"
                autoComplete="off"
                disabled={!!busy}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </>
          ) : (
            <p>Se creará una copia de la base de datos actual en el servidor. ¿Deseas continuar?</p>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" disabled={!!busy} onClick={close}>
            Cancelar
          </CButton>
          <CButton
            color={dialog?.kind === 'restore' ? 'danger' : 'primary'}
            disabled={
              !!busy ||
              !dialog ||
              (dialog.kind === 'restore'
                ? !restoreAllowed || confirmation !== `RESTAURAR ${dialog.row.id_respaldo}`
                : !allowed)
            }
            onClick={() => dialog && operate(dialog.kind, dialog.row)}
          >
            {busy ? 'Procesando…' : dialog?.kind === 'restore' ? 'Restaurar copia' : 'Crear copia'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}
const Backups = () => {
  const { can } = useAuth()
  return can('BACKUP_CREAR') ? (
    <BackupContent />
  ) : (
    <CAlert color="warning">No tienes permiso para consultar o crear copias de seguridad.</CAlert>
  )
}
export default Backups
