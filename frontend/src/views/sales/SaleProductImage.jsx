import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import PropTypes from 'prop-types'

const PlaceholderIcon = () => (
  <svg viewBox="0 0 48 48" fill="none">
    <rect x="13" y="5" width="22" height="38" rx="5" stroke="currentColor" strokeWidth="2" />
    <path d="M20 10h8M22 37h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const ProductPlaceholder = () => (
  <span className="pos-product-image" aria-hidden="true">
    <PlaceholderIcon />
  </span>
)

const SaleProductImage = ({ productId, cache }) => {
  const element = useRef(null)
  const url = useSyncExternalStore(
    cache.subscribe,
    () => cache.get(productId),
    () => '',
  )
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      cache.load(productId)
      return
    }
    let active = true
    const observer = new IntersectionObserver(
      (entries) => {
        if (active && entries.some((entry) => entry.isIntersecting)) {
          cache.load(productId)
          observer.disconnect()
        }
      },
      { rootMargin: '150px' },
    )
    observer.observe(element.current)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [productId, cache])
  return (
    <span className="pos-product-image" aria-hidden="true" ref={element}>
      {url ? (
        <img src={url} alt="" decoding="async" onError={() => cache.fail(productId)} />
      ) : (
        <PlaceholderIcon />
      )}
    </span>
  )
}
SaleProductImage.propTypes = {
  productId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  cache: PropTypes.shape({
    subscribe: PropTypes.func,
    get: PropTypes.func,
    load: PropTypes.func,
    fail: PropTypes.func,
  }).isRequired,
}
export default SaleProductImage
