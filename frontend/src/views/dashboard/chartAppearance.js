import { useSyncExternalStore } from 'react'

const preference = '(prefers-reduced-motion: reduce)'
function subscribe(notify) {
  const media = window.matchMedia(preference)
  media.addEventListener('change', notify)
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-coreui-theme'],
  })
  return () => {
    media.removeEventListener('change', notify)
    observer.disconnect()
  }
}
function snapshot() {
  return `${window.matchMedia(preference).matches}|${document.documentElement.getAttribute('data-coreui-theme')}`
}

// Canvas cannot resolve CSS custom properties; read the same tokens used by CoreUI.
export function useChartAppearance() {
  const state = useSyncExternalStore(subscribe, snapshot, () => 'true|light')
  const styles = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement)
  const color = (key) => styles?.getPropertyValue(key).trim() || undefined
  return {
    animation: state.startsWith('true') ? false : { duration: 400, easing: 'easeOutQuart' },
    action: color('--tc-action'),
    positive: color('--tc-positive'),
    warning: color('--cui-warning'),
    danger: color('--cui-danger'),
    text: color('--cui-body-color'),
    muted: color('--cui-secondary-color'),
    grid: color('--cui-border-color'),
    dark: state.endsWith('|dark'),
    chartAction: color('--tc-chart-action'),
    chartSecondary: color('--tc-chart-secondary'),
    chartSurface: color('--tc-chart-surface'),
    chartText: color('--tc-chart-text'),
    chartMuted: color('--tc-chart-muted'),
    chartGrid: color('--tc-chart-grid'),
    chartBorder: color('--tc-chart-border'),
  }
}
