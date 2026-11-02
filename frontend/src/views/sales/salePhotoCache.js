// One cache per mounted sale, shared by catalog and cart. Missing/failed photos
// are cached too, so filtering or changing quantities never retries downloads.
export function createSalePhotoCache(load, urls = URL, concurrency = 4) {
  let generation = { entries: new Map(), queue: [], active: 0, disposed: false }
  const listeners = new Set()
  const notify = () => listeners.forEach((listener) => listener())
  const pump = (state) => {
    while (!state.disposed && state.active < concurrency && state.queue.length) {
      const entry = state.queue.shift()
      state.active++
      entry.controller = new AbortController()
      Promise.resolve()
        .then(() => (state.disposed ? null : load(entry.id, entry.controller.signal)))
        .then((blob) => {
          if (state.disposed || entry.controller.signal.aborted) return
          entry.url = blob ? urls.createObjectURL(blob) : ''
          entry.status = 'done'
          notify()
        })
        .catch(() => {
          if (!state.disposed) {
            entry.status = 'done'
            notify()
          }
        })
        .finally(() => {
          state.active--
          pump(state)
        })
    }
  }
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get(id) {
      return generation.entries.get(String(id))?.url || ''
    },
    load(id) {
      const key = String(id)
      if (!/^[1-9]\d*$/.test(key) || generation.entries.has(key)) return
      const entry = { id: key, url: '', status: 'queued' }
      generation.entries.set(key, entry)
      generation.queue.push(entry)
      pump(generation)
    },
    fail(id) {
      const entry = generation.entries.get(String(id))
      if (!entry?.url) return
      urls.revokeObjectURL(entry.url)
      entry.url = ''
      entry.status = 'done'
      notify()
    },
    dispose() {
      const state = generation
      state.disposed = true
      state.queue.length = 0
      for (const entry of state.entries.values()) {
        entry.controller?.abort()
        if (entry.url) urls.revokeObjectURL(entry.url)
      }
      // A fresh generation also supports React StrictMode effect reactivation.
      generation = { entries: new Map(), queue: [], active: 0, disposed: false }
    },
  }
}
