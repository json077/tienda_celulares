import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
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
import { apiErrorMessage } from '../../services/api'
import ContactForm from './ContactForm'

export const filterContacts = (records, config, search) => {
  const query = search.trim().toLocaleLowerCase('es')
  return records.filter((record) =>
    [config.displayName(record), ...config.fields.map(({ name }) => record[name])].some((value) =>
      String(value ?? '')
        .toLocaleLowerCase('es')
        .includes(query),
    ),
  )
}

export const ContactTable = ({ config, records, filtered, error, busy, onEdit, onStatus }) => (
  <CTable responsive hover align="middle" className="mb-0">
    <CTableHead>
      <CTableRow>
        {[
          ...(config.hideId ? [] : ['ID']),
          'Nombre',
          'Identificación',
          'Contacto',
          'Dirección',
          'Estado',
          'Acciones',
        ].map((title) => (
          <CTableHeaderCell scope="col" key={title}>
            {title}
          </CTableHeaderCell>
        ))}
      </CTableRow>
    </CTableHead>
    <CTableBody>
      {filtered.map((record) => (
        <CTableRow key={record[config.idKey]}>
          {!config.hideId && <CTableDataCell>{record[config.idKey]}</CTableDataCell>}
          <CTableDataCell>{config.displayName(record)}</CTableDataCell>
          <CTableDataCell>
            <div>{record.identificacion || '—'}</div>
            {record.tipo_identificacion && (
              <div className="small text-body-secondary">{record.tipo_identificacion}</div>
            )}
          </CTableDataCell>
          <CTableDataCell>
            <div>{record.telefono || '—'}</div>
            <div className="small text-body-secondary text-break">{record.email || '—'}</div>
          </CTableDataCell>
          <CTableDataCell>
            <div className="text-break" style={{ minWidth: '10rem', maxWidth: '20rem' }}>
              {record.direccion || '—'}
            </div>
          </CTableDataCell>
          <CTableDataCell>
            <CBadge color={Number(record.activo) === 1 ? 'success' : 'secondary'}>
              {Number(record.activo) === 1 ? 'Activo' : 'Inactivo'}
            </CBadge>
          </CTableDataCell>
          <CTableDataCell>
            <div className="d-flex gap-2">
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onEdit(record)}
                aria-label={`Editar ${config.displayName(record)}`}
              >
                Editar
              </CButton>
              <CButton
                color={Number(record.activo) === 1 ? 'warning' : 'success'}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onStatus(record)}
                aria-label={`${Number(record.activo) === 1 ? 'Desactivar' : 'Activar'} ${config.displayName(record)}`}
              >
                {Number(record.activo) === 1 ? 'Desactivar' : 'Activar'}
              </CButton>
            </div>
          </CTableDataCell>
        </CTableRow>
      ))}
      {!filtered.length && (
        <CTableRow>
          <CTableDataCell colSpan={config.hideId ? 6 : 7} className="text-center py-4">
            {error
              ? 'No hay registros disponibles para mostrar.'
              : records.length
                ? 'No hay coincidencias para la búsqueda.'
                : `No hay ${config.title.toLowerCase()} registrados.`}
          </CTableDataCell>
        </CTableRow>
      )}
    </CTableBody>
  </CTable>
)

ContactTable.propTypes = {
  config: PropTypes.object.isRequired,
  records: PropTypes.array.isRequired,
  filtered: PropTypes.array.isRequired,
  error: PropTypes.string.isRequired,
  busy: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onStatus: PropTypes.func.isRequired,
}

const ContactDirectory = ({ config, service }) => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [operation, setOperation] = useState('')
  const [editor, setEditor] = useState(null)
  const [formError, setFormError] = useState('')
  const [statusRecord, setStatusRecord] = useState(null)
  const [statusError, setStatusError] = useState('')
  const pending = useRef(false)

  const getRecord = async (id) => {
    const { data } = await service.get(id)
    if (config.readRecord) return config.readRecord(data, id)
    if (!data || Number(data[config.idKey]) !== Number(id)) {
      throw new Error('El servidor devolvió un registro inválido. Actualiza el listado.')
    }
    return data
  }

  const loadRecords = useCallback(
    (signal) =>
      service
        .list(signal)
        .then((response) => {
          if (!Array.isArray(response.data))
            throw new Error('El servidor devolvió un listado inválido.')
          const rows = config.readList ? config.readList(response) : response.data
          if (!signal?.aborted) {
            setRecords(rows)
            setError('')
          }
        })
        .catch((error) => {
          if (!signal?.aborted) setError(apiErrorMessage(error))
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false)
        }),
    [service, config],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadRecords(controller.signal)
    return () => controller.abort()
  }, [loadRecords])

  const refresh = async () => {
    setLoading(true)
    setError('')
    await loadRecords()
  }

  const openEditor = async (record = null) => {
    if (pending.current) return
    setError('')
    setSuccess('')
    setFormError('')
    if (!record) {
      setEditor({ record: null })
      return
    }
    pending.current = true
    setOperation('opening')
    try {
      const data = await getRecord(record[config.idKey])
      setEditor({ record: data })
    } catch (error) {
      setError(apiErrorMessage(error))
    } finally {
      pending.current = false
      setOperation('')
    }
  }

  const saveRecord = async (values) => {
    if (pending.current) return
    pending.current = true
    setOperation('saving')
    setFormError('')
    try {
      const response = editor.record
        ? await service.update(editor.record[config.idKey], values)
        : await service.create(values)
      setEditor(null)
      setSuccess(response.message)
      await refresh()
    } catch (error) {
      setFormError(apiErrorMessage(error))
    } finally {
      pending.current = false
      setOperation('')
    }
  }

  const changeStatus = async () => {
    if (pending.current) return
    pending.current = true
    setOperation('status')
    setStatusError('')
    setSuccess('')
    try {
      // PUT es una edición completa: recuperar los datos antes de reactivar.
      const current = await getRecord(statusRecord[config.idKey])
      if (Number(current.activo) !== Number(statusRecord.activo)) {
        throw new Error('El estado cambió. Cierra esta ventana y actualiza el listado.')
      }
      const response =
        Number(current.activo) === 1
          ? await service.deactivate(current[config.idKey])
          : await service.update(current[config.idKey], { ...current, activo: true })
      setStatusRecord(null)
      setSuccess(response.message)
      await refresh()
    } catch (error) {
      setStatusError(apiErrorMessage(error))
    } finally {
      pending.current = false
      setOperation('')
    }
  }

  const filtered = config.filter
    ? config.filter(records, search, status)
    : filterContacts(records, config, search)
  const busy = loading || !!operation
  const statusAction = Number(statusRecord?.activo) === 1 ? 'Desactivar' : 'Activar'

  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <h1 className="h4 mb-1">{config.title}</h1>
              <p className="text-body-secondary mb-0">
                Registro de {config.title.toLowerCase()} de Tienda Celulares.
              </p>
            </div>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" disabled={busy} onClick={refresh}>
                Actualizar
              </CButton>
              <CButton color="primary" disabled={busy} onClick={() => openEditor()}>
                Nuevo {config.singular}
              </CButton>
            </div>
          </div>
          {success && (
            <CAlert color="success" role="status">
              {success}
            </CAlert>
          )}
          {error && (
            <CAlert color="danger" role="alert">
              {error}
            </CAlert>
          )}
          {operation === 'opening' && (
            <div role="status" className="mb-3">
              <CSpinner size="sm" className="me-2" />
              Cargando datos...
            </div>
          )}
          <CRow className="mb-3">
            <CCol md={8} lg={6}>
              <CFormLabel htmlFor={`${config.idKey}-search`}>
                Buscar por nombre, identificación, teléfono o correo
              </CFormLabel>
              <CFormInput
                id={`${config.idKey}-search`}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Escribe para buscar"
              />
            </CCol>
            {config.stateFilter && (
              <>
                <CCol md={4} lg={3}>
                  <CFormLabel htmlFor={`${config.idKey}-state`}>Estado</CFormLabel>
                  <CFormSelect
                    id={`${config.idKey}-state`}
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="1">Activos</option>
                    <option value="0">Inactivos</option>
                  </CFormSelect>
                </CCol>
                <CCol xs={12} className="mt-2">
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setStatus('')
                    }}
                  >
                    Limpiar filtros
                  </CButton>
                </CCol>
              </>
            )}
          </CRow>
          {loading ? (
            <div className="text-center py-5" role="status">
              <CSpinner color="primary" />
              <div className="mt-2">Cargando {config.title.toLowerCase()}...</div>
            </div>
          ) : (
            <>
              {error && records.length > 0 && (
                <p className="small text-body-secondary">
                  Se muestra el último listado cargado. Usa Actualizar para volver a consultar la
                  API.
                </p>
              )}
              <ContactTable
                config={config}
                records={records}
                filtered={filtered}
                error={error}
                busy={busy}
                onEdit={openEditor}
                onStatus={(record) => {
                  setStatusError('')
                  setStatusRecord(record)
                }}
              />
              <p className="small text-body-secondary mt-3 mb-0">
                {filtered.length} de {records.length} registros.
              </p>
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal
        visible={!!editor}
        size="lg"
        backdrop="static"
        keyboard={!operation}
        onClose={() => {
          if (!operation) setEditor(null)
        }}
        aria-labelledby={`${config.idKey}-editor-title`}
      >
        <CModalHeader closeButton={!operation}>
          <CModalTitle id={`${config.idKey}-editor-title`}>
            {editor?.record ? 'Editar' : 'Nuevo'} {config.singular}
          </CModalTitle>
        </CModalHeader>
        {editor && (
          <ContactForm
            config={config}
            record={editor.record}
            saving={operation === 'saving'}
            error={formError}
            onSave={saveRecord}
            onCancel={() => setEditor(null)}
          />
        )}
      </CModal>

      <CModal
        visible={!!statusRecord}
        backdrop="static"
        keyboard={!operation}
        onClose={() => {
          if (!operation) setStatusRecord(null)
        }}
        aria-labelledby={`${config.idKey}-status-title`}
      >
        <CModalHeader closeButton={!operation}>
          <CModalTitle id={`${config.idKey}-status-title`}>
            {statusAction} {config.singular}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {statusError && (
            <CAlert color="danger" role="alert">
              {statusError}
            </CAlert>
          )}
          <p>
            ¿Deseas {statusAction.toLowerCase()} el registro de{' '}
            <strong>{statusRecord && config.displayName(statusRecord)}</strong>?
          </p>
          <p className="text-body-secondary mb-0">El registro y su historial se conservarán.</p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            disabled={!!operation}
            onClick={() => setStatusRecord(null)}
          >
            Cancelar
          </CButton>
          <CButton color="primary" disabled={!!operation} onClick={changeStatus}>
            {operation === 'status' && <CSpinner size="sm" className="me-2" aria-hidden="true" />}
            {operation === 'status' ? 'Procesando...' : statusAction}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

ContactDirectory.propTypes = {
  config: PropTypes.object.isRequired,
  service: PropTypes.shape({
    list: PropTypes.func.isRequired,
    get: PropTypes.func.isRequired,
    create: PropTypes.func.isRequired,
    update: PropTypes.func.isRequired,
    deactivate: PropTypes.func.isRequired,
  }).isRequired,
}

export default ContactDirectory
