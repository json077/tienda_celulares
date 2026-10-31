import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CFormSelect,
  CModal,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useAuth } from '../../contexts/AuthContext'
import { userErrorMessage, userService } from '../../services/userService'
import { assertOperation, can, canCreate, exclusive } from './userModel'
import UserTable from './UserTable'
import UserForm from './UserForm'
import { UserDetail, UserRoles, UserState } from './UserPanels'

const titles = {
  create: 'Nuevo usuario',
  edit: 'Editar usuario',
  detail: 'Detalle del usuario',
  roles: 'Asignar roles',
  state: 'Cambiar estado del usuario',
}

const Users = () => {
  const { usuario } = useAuth()
  const [actor, setActor] = useState(null)
  const [users, setUsers] = useState([])
  const [catalog, setCatalog] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [filters, setFilters] = useState({
    buscar: '',
    activo: '',
    id_rol: '',
    pagina: 1,
    limite: 20,
  })
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editor, setEditor] = useState(null)
  const [formError, setFormError] = useState('')
  const [revision, setRevision] = useState(0)
  const pending = useRef(false)
  const lifetime = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])

  const load = useCallback(
    async (signal) => {
      setLoading(true)
      setError('')
      setCatalogError('')
      try {
        const current = await userService.me(signal)
        if (signal.aborted) return
        setActor(current)
        setCatalog([])
        if (!can(current, 'USUARIO_VER')) {
          setUsers([])
          setPagination(null)
          return
        }
        if (can(current, 'ROL_VER')) {
          try {
            const roles = await userService.roles(signal)
            if (!signal.aborted) setCatalog(roles)
          } catch (err) {
            if (signal.aborted) return
            setCatalogError(userErrorMessage(err))
          }
        }
        const result = await userService.list(filters, signal)
        if (signal.aborted) return
        if (
          result.pagination.total_paginas > 0 &&
          filters.pagina > result.pagination.total_paginas
        ) {
          setFilters((old) => ({ ...old, pagina: result.pagination.total_paginas }))
          return
        }
        setUsers(result.users)
        setPagination(result.pagination)
      } catch (err) {
        if (!signal.aborted) {
          setUsers([])
          setPagination(null)
          setError(userErrorMessage(err))
          if (err.status === 401 || err.status === 403) setActor(null)
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [filters],
  )

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) load(controller.signal)
    })
    return () => controller.abort()
  }, [load, revision, usuario])

  const open = (type, row = null) =>
    exclusive(pending, async () => {
      setOperation('opening')
      setError('')
      setSuccess('')
      setFormError('')
      const signal = lifetime.current.signal
      try {
        const current = await userService.me(signal)
        if (signal.aborted) return
        setActor(current)
        const target = row ? await userService.detail(row.id_usuario, signal) : null
        if (type === 'detail') {
          if (!can(current, 'USUARIO_VER'))
            throw new Error('No tienes permiso para consultar usuarios.')
        } else assertOperation(type, current, target)
        const roles = ['create', 'roles'].includes(type) ? await userService.roles(signal) : []
        if (!signal.aborted) setEditor({ type, target, catalog: roles })
      } catch (err) {
        if (!signal.aborted) setError(userErrorMessage(err))
      } finally {
        if (!signal.aborted) setOperation('')
      }
    })

  const save = (values) =>
    exclusive(pending, async () => {
      setOperation('saving')
      setFormError('')
      const signal = lifetime.current.signal
      try {
        await userService.commit(editor.type, editor.target, values, signal, (current) => {
          if (!signal.aborted) setActor(current)
        })
        if (signal.aborted) return
        setEditor(null)
        setSuccess(
          {
            create: 'Usuario creado correctamente.',
            edit: 'Datos del usuario actualizados.',
            state: 'Estado del usuario actualizado.',
            roles: 'Roles del usuario actualizados.',
          }[editor.type],
        )
        setRevision((value) => value + 1)
      } catch (err) {
        if (!signal.aborted) {
          setFormError(userErrorMessage(err))
          if (err.status === 401 || err.status === 403) {
            setEditor(null)
            setActor(null)
            setError(userErrorMessage(err))
          }
        }
      } finally {
        values.password = ''
        values.confirmPassword = ''
        if (!signal.aborted) setOperation('')
      }
    })

  const close = () => {
    if (!pending.current) {
      setEditor(null)
      setFormError('')
    }
  }
  const busy = loading || !!operation
  const readable = actor && can(actor, 'USUARIO_VER')
  const changeFilter = (key, value) => setFilters((old) => ({ ...old, [key]: value, pagina: 1 }))
  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h1 className="h4 mb-1">Usuarios y roles</h1>
              <p className="text-body-secondary mb-0">
                Administra el acceso del personal a Tienda Celulares.
              </p>
            </div>
            <div className="d-flex gap-2">
              <CButton
                color="secondary"
                variant="outline"
                disabled={busy}
                onClick={() => setRevision((value) => value + 1)}
              >
                Actualizar
              </CButton>
              {readable && canCreate(actor) && (
                <CButton color="primary" disabled={busy} onClick={() => open('create')}>
                  Nuevo usuario
                </CButton>
              )}
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
          {catalogError && (
            <CAlert color="warning" role="alert">
              No se pudo cargar el catálogo de roles. {catalogError}
            </CAlert>
          )}
          {loading && (
            <div role="status" className="py-4 text-center">
              <CSpinner color="primary" />
              <div>Cargando usuarios y permisos...</div>
            </div>
          )}
          {operation === 'opening' && (
            <div role="status">
              <CSpinner size="sm" className="me-2" />
              Cargando usuario...
            </div>
          )}
          {!loading && !readable && !error && (
            <CAlert color="warning">No tienes permiso para consultar usuarios.</CAlert>
          )}
          {readable && (
            <>
              <CForm
                className="mb-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!busy) changeFilter('buscar', search.trim())
                }}
              >
                <CRow className="g-3 align-items-end">
                  <CCol md={5}>
                    <CFormInput
                      id="user-search"
                      type="search"
                      label="Buscar nombre, usuario o correo"
                      maxLength={100}
                      value={search}
                      disabled={busy}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </CCol>
                  <CCol md={2}>
                    <CFormSelect
                      id="user-filter-state"
                      label="Estado"
                      value={filters.activo}
                      disabled={busy}
                      onChange={(event) => changeFilter('activo', event.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="1">Activos</option>
                      <option value="0">Inactivos</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={3}>
                    <CFormSelect
                      id="user-filter-role"
                      label="Rol"
                      value={filters.id_rol}
                      disabled={busy || !can(actor, 'ROL_VER') || !catalog.length}
                      onChange={(event) => changeFilter('id_rol', event.target.value)}
                    >
                      <option value="">Todos</option>
                      {catalog.map((role) => (
                        <option key={role.id_rol} value={role.id_rol}>
                          {role.nombre}
                        </option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol md={2}>
                    <CButton type="submit" color="primary" disabled={busy}>
                      Buscar
                    </CButton>
                  </CCol>
                </CRow>
                <CButton
                  className="mt-2"
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setSearch('')
                    setFilters({ buscar: '', activo: '', id_rol: '', pagina: 1, limite: 20 })
                  }}
                >
                  Limpiar filtros
                </CButton>
              </CForm>
              {!can(actor, 'ROL_VER') && (
                <p className="small text-body-secondary">
                  No tienes permiso para consultar el catálogo de roles.
                </p>
              )}
              {!loading && <UserTable users={users} actor={actor} busy={busy} onOpen={open} />}
              {pagination && !loading && (
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <span role="status">
                    {pagination.total} usuarios · Página {pagination.pagina} de{' '}
                    {Math.max(1, pagination.total_paginas)}
                  </span>
                  <div className="d-flex align-items-center gap-2">
                    <CFormSelect
                      id="user-page-size"
                      aria-label="Usuarios por página"
                      value={filters.limite}
                      disabled={busy}
                      onChange={(event) => changeFilter('limite', Number(event.target.value))}
                    >
                      {[10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size} por página
                        </option>
                      ))}
                    </CFormSelect>
                    <CButton
                      color="secondary"
                      variant="outline"
                      disabled={busy || filters.pagina <= 1}
                      onClick={() => setFilters((old) => ({ ...old, pagina: old.pagina - 1 }))}
                    >
                      Anterior
                    </CButton>
                    <CButton
                      color="secondary"
                      variant="outline"
                      disabled={
                        busy ||
                        filters.pagina >= pagination.total_paginas ||
                        filters.pagina >= 1000000
                      }
                      onClick={() => setFilters((old) => ({ ...old, pagina: old.pagina + 1 }))}
                    >
                      Siguiente
                    </CButton>
                  </div>
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>
      {editor && (
        <CModal visible alignment="center" size="lg" backdrop="static" onClose={close}>
          <CModalHeader closeButton={!operation}>
            <CModalTitle>{titles[editor.type]}</CModalTitle>
          </CModalHeader>
          {['create', 'edit'].includes(editor.type) && (
            <UserForm
              user={editor.target}
              catalog={editor.catalog}
              saving={operation === 'saving'}
              error={formError}
              onSave={save}
              onCancel={close}
            />
          )}
          {editor.type === 'detail' && <UserDetail user={editor.target} />}
          {editor.type === 'state' && (
            <UserState
              user={editor.target}
              saving={operation === 'saving'}
              error={formError}
              onConfirm={save}
              onCancel={close}
            />
          )}
          {editor.type === 'roles' && (
            <UserRoles
              user={editor.target}
              catalog={editor.catalog}
              saving={operation === 'saving'}
              error={formError}
              onConfirm={save}
              onCancel={close}
            />
          )}
        </CModal>
      )}
    </>
  )
}
export default Users
