import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { CCloseButton, CSidebar, CSidebarBrand, CSidebarHeader } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMobile, cilPin } from '@coreui/icons'
import { Link } from 'react-router-dom'
import { AppSidebarNav } from './AppSidebarNav'
import navigationFor from '../_nav'
import { useAuth } from '../contexts/AuthContext'

const desktopQuery = '(min-width: 992px)'
const pinKey = 'tienda-celulares.sidebar-pinned'
const subscribeDesktop = (notify) => {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches
const readPin = () => {
  try {
    return localStorage.getItem(pinKey) === 'true'
  } catch {
    return false
  }
}

const AppSidebar = () => {
  const { can } = useAuth()
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false)
  const [pinned, setPinned] = useState(readPin)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const sidebarRef = useRef(null)
  const mobileOpen = !desktop && sidebarShow
  const expanded = !desktop || pinned || (!dismissed && (hovered || focused))

  useEffect(() => {
    if (mobileOpen) sidebarRef.current?.querySelector('.btn-close')?.focus()
  }, [mobileOpen])

  const closeMobile = () => {
    dispatch({ type: 'set', sidebarShow: false })
    document.getElementById('sidebar-menu-toggle')?.focus()
  }
  const togglePin = () => {
    const next = !pinned
    setPinned(next)
    try {
      localStorage.setItem(pinKey, String(next))
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }
  const handleKeyDown = (event) => {
    if (event.key === 'Tab' && desktop) {
      setFocused(true)
      setDismissed(false)
    }
    if (event.key === 'Escape') {
      if (mobileOpen) {
        event.preventDefault()
        closeMobile()
      } else if (desktop && !pinned) {
        event.preventDefault()
        setDismissed(true)
      }
    }
    if (event.key === 'Tab' && mobileOpen) {
      const controls = [
        ...sidebarRef.current.querySelectorAll('a[href], button:not(:disabled)'),
      ].filter((element) => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && (event.target === first || !controls.includes(event.target))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && event.target === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return (
    <CSidebar
      as="aside"
      ref={sidebarRef}
      id="app-sidebar"
      className="smart-sidebar border-end"
      aria-label="Menú principal"
      data-expanded={expanded}
      data-pinned={pinned}
      inert={!desktop && !sidebarShow}
      colorScheme="dark"
      position="fixed"
      visible={desktop || sidebarShow}
      onVisibleChange={(visible) => {
        if (!window.matchMedia(desktopQuery).matches) {
          dispatch({ type: 'set', sidebarShow: visible })
        }
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && desktop) {
          setHovered(true)
          setDismissed(false)
        }
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setFocused(false)}
      onFocus={(event) => {
        setFocused(event.target.matches(':focus-visible'))
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setDismissed(false)
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        const link = event.target.closest('a.nav-link:not(.nav-group-toggle), a.sidebar-brand')
        if (link && mobileOpen) closeMobile()
      }}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand as={Link} to="/dashboard" aria-label="Tienda Celulares, inicio">
          <CIcon className="smart-brand-icon" icon={cilMobile} height={24} />
          <span className="smart-sidebar-label smart-brand-label">
            <span className="d-block fw-semibold">Tienda Celulares</span>
            <span className="d-block small">Inventario y Facturación</span>
          </span>
        </CSidebarBrand>
        <CCloseButton
          aria-label="Cerrar menú lateral"
          className="d-lg-none"
          dark
          onClick={closeMobile}
        />
        <button
          type="button"
          className="smart-sidebar-pin d-none d-lg-flex"
          aria-label={
            pinned ? 'Desfijar menú lateral: activar modo automático' : 'Fijar menú lateral abierto'
          }
          title={pinned ? 'Desfijar menú: modo automático' : 'Fijar menú abierto'}
          aria-pressed={pinned}
          onClick={togglePin}
        >
          <CIcon icon={cilPin} className="smart-pin-icon" />
          <span className="smart-sidebar-label">{pinned ? 'Menú fijado' : 'Fijar menú'}</span>
        </button>
      </CSidebarHeader>
      <AppSidebarNav items={navigationFor(can)} compact={desktop && !expanded} />
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
