export function formatTimestamp(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toEpoch(ts) {
  const d = new Date(ts)
  const t = d.getTime()
  return Number.isFinite(t) ? t : 0
}

