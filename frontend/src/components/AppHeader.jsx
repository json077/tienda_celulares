import React, { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilContrast, cilMenu, cilMoon, cilSun } from '@coreui/icons'
import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'

const themes = [
  { value: 'light', label: 'Claro', icon: cilSun },
  { value: 'dark', label: 'Oscuro', icon: cilMoon },
  { value: 'auto', label: 'Automático', icon: cilContrast },
]

const AppHeader = () => {
  const headerRef = useRef()
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  useEffect(() => {
    const handleScroll = () => {
      headerRef.current?.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    }
    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          aria-label="Abrir o cerrar menú lateral"
          aria-expanded={!!sidebarShow}
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <span className="fw-semibold d-none d-sm-inline">Tienda Celulares</span>
        <CHeaderNav className="ms-auto">
          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false} aria-label="Seleccionar tema">
              <CIcon
                icon={themes.find(({ value }) => value === colorMode)?.icon || cilSun}
                size="lg"
              />
            </CDropdownToggle>
            <CDropdownMenu>
              {themes.map(({ value, label, icon }) => (
                <CDropdownItem
                  key={value}
                  active={colorMode === value}
                  as="button"
                  type="button"
                  onClick={() => setColorMode(value)}
                >
                  <CIcon className="me-2" icon={icon} />
                  {label}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
