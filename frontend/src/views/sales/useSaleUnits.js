import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../../services/api'
import { createAvailabilityQuery } from './saleAvailability'

export const useSaleUnits = (scope, canRead, load) => {
  const key = JSON.stringify([scope, canRead])
  const [result, setResult] = useState({ scope: '', rows: [], loading: false, error: '' })
  const [query] = useState(createAvailabilityQuery)
  useEffect(() => {
    const current = query
    const [branch, , products] = JSON.parse(scope)
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setResult({ scope: key, rows: [], loading: true, error: '' })
      void current.run(
        (signal) =>
          !branch || !products.length || !canRead
            ? Promise.resolve([])
            : load(branch, products, signal),
        (rows) => setResult({ scope: key, rows, loading: false, error: '' }),
        (error) =>
          setResult({ scope: key, rows: [], loading: false, error: apiErrorMessage(error) }),
      )
    })
    return () => {
      cancelled = true
      current.cancel()
    }
  }, [scope, load, canRead, query, key])
  // Hide previous data synchronously, before the effect for the new filters runs.
  return result.scope === key ? result : { rows: [], loading: canRead, error: '' }
}
