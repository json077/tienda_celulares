import React, {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { CCloseButton, CModal, CModalHeader, CModalTitle } from '@coreui/react'

const EXIT_MS = 220
const EXIT_FALLBACK_MS = EXIT_MS + 80
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Clearing a conditional editor must not interrupt its exit animation.
export const ModalPresence = ({ children }) => {
  const [retained, setRetained] = useState(children)
  if (children && children !== retained) setRetained(children)
  useLayoutEffect(() => {
    if (children) return
    const timer = setTimeout(() => setRetained(null), reducedMotion() ? 0 : EXIT_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [children])
  return children || (retained ? cloneElement(retained, { visible: false }) : null)
}
ModalPresence.propTypes = { children: PropTypes.node }

const AppModal = ({
  children,
  size = 'lg',
  duration = 280,
  scrollable = true,
  visible = false,
  backdrop = true,
  keyboard = true,
  onClose,
  onClosePrevented,
  onShow,
  container,
  portal = true,
  className = '',
  transition = true,
  ...props
}) => {
  const generatedId = useId()
  const [present, setPresent] = useState(visible)
  const [closing, setClosing] = useState(false)
  const [lastContent, setLastContent] = useState(children)
  const closeCallback = useRef(onClose)
  const showCallback = useRef(onShow)
  const mouseDown = useRef(null)
  const modalRef = useRef(null)
  const overlayRef = useRef(null)
  useLayoutEffect(() => {
    closeCallback.current = onClose
    showCallback.current = onShow
  })
  if (visible && !closing && lastContent !== children) setLastContent(children)

  const requestClose = () => {
    if (closing) return
    // If dismissal occurs during entrance, continue from the currently painted
    // frame instead of jumping to full opacity and scale before exiting.
    for (const node of [modalRef.current?.querySelector('.modal-dialog'), overlayRef.current]) {
      if (!node) continue
      const painted = getComputedStyle(node)
      node.style.setProperty('--tc-modal-exit-opacity', painted.opacity)
      node.style.setProperty('--tc-modal-exit-transform', painted.transform)
      node.style.setProperty('--tc-modal-exit-blur', painted.backdropFilter || 'blur(5px)')
    }
    setClosing(true)
  }

  useLayoutEffect(() => {
    if (visible) {
      // Synchronize presentation before paint to prevent a stale frame on reopening.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPresent(true)
      setClosing(false)
    } else if (present) requestClose()
    // Only a visibility change should reverse an in-progress exit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const finishClose = () => {
    setPresent(false)
    setClosing(false)
    closeCallback.current?.()
  }

  useLayoutEffect(() => {
    if (!closing) return
    const timer = setTimeout(
      finishClose,
      !transition || duration === 0 || reducedMotion() ? 0 : EXIT_FALLBACK_MS,
    )
    return () => clearTimeout(timer)
    // The timer is only a fallback for browsers that suppress animationend.
  }, [closing, duration, transition])

  useLayoutEffect(() => {
    if (present) showCallback.current?.()
  }, [present])

  // CoreUI retains focus through the animation. Its backdrop timeout is fixed at
  // 150 ms, so our backdrop shares the dialog's retained lifetime instead.
  useLayoutEffect(() => {
    if (!present || !backdrop) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [present, backdrop])

  const dismiss = () => {
    if (backdrop === 'static') onClosePrevented?.()
    else requestClose()
  }
  const header = Children.toArray(lastContent).find(
    (child) => isValidElement(child) && child.type === CModalHeader,
  )
  const title = Children.toArray(header?.props.children).find(
    (child) => isValidElement(child) && child.type === CModalTitle,
  )
  const titleId = title?.props.id || generatedId
  const content = Children.map(lastContent, (child) => {
    if (!isValidElement(child) || child.type !== CModalHeader) return child
    const titles = Children.map(child.props.children, (title) => {
      if (!isValidElement(title) || title.type !== CModalTitle) return title
      return title.props.id ? title : cloneElement(title, { id: titleId })
    })
    return cloneElement(
      child,
      { closeButton: false },
      titles,
      child.props.closeButton !== false && (
        <CCloseButton aria-label={child.props.ariaCloseLabel} onClick={requestClose} />
      ),
    )
  })
  const motion = closing ? 'closing' : 'opening'
  const style = {
    '--tc-modal-enter-duration': `${duration}ms`,
    ...(transition
      ? {}
      : { '--tc-modal-enter-duration': '0ms', '--tc-modal-exit-duration': '0ms' }),
  }
  const overlay = present && backdrop && (
    <div
      ref={overlayRef}
      className={`modal-backdrop app-modal-backdrop ${motion}`}
      style={style}
      aria-hidden="true"
    />
  )
  return (
    <>
      {present && (
        <CModal
          ref={modalRef}
          {...props}
          size={size}
          visible={present}
          scrollable={scrollable}
          aria-labelledby={props['aria-labelledby'] || titleId}
          className={`app-modal ${motion} ${className}`}
          style={{ display: present ? 'block' : undefined, ...style, ...props.style }}
          container={container}
          portal={portal}
          transition={false}
          backdrop={false}
          keyboard={false}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape' && keyboard) {
              event.stopPropagation()
              dismiss()
            }
          }}
          onMouseDownCapture={(event) => {
            mouseDown.current = event.target
          }}
          onMouseUpCapture={(event) => {
            if (event.target === event.currentTarget && mouseDown.current === event.target) {
              event.stopPropagation()
              dismiss()
            }
          }}
          onClickCapture={(event) => {
            if (closing) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
          onAnimationEnd={(event) => {
            if (
              closing &&
              event.animationName === 'tc-modal-exit' &&
              event.target.classList.contains('modal-dialog')
            )
              finishClose()
          }}
        >
          {content}
        </CModal>
      )}
      {overlay &&
        (portal
          ? createPortal(
              overlay,
              typeof container === 'function' ? container() : container || document.body,
            )
          : overlay)}
    </>
  )
}
AppModal.propTypes = {
  children: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'lg', 'xl']),
  duration: PropTypes.number,
  scrollable: PropTypes.bool,
  visible: PropTypes.bool,
  backdrop: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(['static'])]),
  keyboard: PropTypes.bool,
  onClose: PropTypes.func,
  onClosePrevented: PropTypes.func,
  onShow: PropTypes.func,
  container: PropTypes.any,
  portal: PropTypes.bool,
  className: PropTypes.string,
  transition: PropTypes.bool,
  style: PropTypes.object,
}
export default AppModal
