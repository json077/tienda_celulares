// Synchronous lock: two clicks before React renders cannot start two operations.
export async function runBackupOperation(lock, action) {
  if (lock.current) return
  lock.current = true
  try {
    return await action()
  } finally {
    lock.current = false
  }
}

export const backupSize = (value) => {
  const bytes = Number(value)
  return Number.isFinite(bytes) && bytes >= 0
    ? `${(bytes / 1024).toLocaleString('es-NI', { maximumFractionDigits: 1 })} KB`
    : '—'
}

export const backupDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-NI') : '—'
}

export function assertBackupAction(can, kind, confirmation, id) {
  if (!can(kind === 'restore' ? 'BACKUP_RESTAURAR' : 'BACKUP_CREAR'))
    throw new Error('No tienes permiso para realizar esta operación.')
  if (kind === 'restore' && confirmation !== `RESTAURAR ${id}`)
    throw new Error(`Escribe RESTAURAR ${id} para confirmar.`)
}
