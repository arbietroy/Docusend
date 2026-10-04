export function naira(value, { decimals = false } = {}) {
  const n = Number(value || 0)
  return '₦' + n.toLocaleString('en-NG', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })
}

// Short form for stat cards: ₦18.4M, ₦950K
export function nairaShort(value) {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1e9) return '₦' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  if (Math.abs(n) >= 1e6) return '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(n) >= 1e3) return '₦' + (n / 1e3).toFixed(0) + 'K'
  return naira(n)
}

export function fmtDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function isoDate(d = new Date()) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const PAYMENT_STATUS = {
  pending:    { label: 'Awaiting confirmation', short: 'Pending',    variant: 'blue'  },
  on_track:   { label: 'On track',              short: 'On track',   variant: 'green' },
  owing:      { label: 'Owing',                 short: 'Owing',      variant: 'amber' },
  defaulting: { label: 'Defaulting',            short: 'Defaulting', variant: 'red'   },
  fully_paid: { label: 'Fully paid',            short: 'Fully paid', variant: 'green' },
  cancelled:  { label: 'Cancelled',             short: 'Cancelled',  variant: 'slate' },
}

export const UNIT_LABELS = {
  plot: ['plot', 'plots'], acre: ['acre', 'acres'], hectare: ['hectare', 'hectares'], sqm: ['sqm', 'sqm'],
  apartment: ['apartment', 'apartments'], house: ['house', 'houses'], unit: ['unit', 'units'],
}
export const unitLabel = (type, n) => (UNIT_LABELS[type] || UNIT_LABELS.unit)[Number(n) === 1 ? 0 : 1]

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function slugify(s = '') {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
}

// Prefilled email in the staff member's own mail app. In-app sending comes with
// the email integration.
export function mailto({ to, cc, subject, body }) {
  const params = new URLSearchParams()
  if (cc) params.set('cc', cc)
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  return `mailto:${encodeURIComponent(to || '')}?${params.toString().replace(/\+/g, '%20')}`
}

export function toCsv(rows, columns) {
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map(c => esc(c.label)).join(','), ...rows.map(r => columns.map(c => esc(c.value(r))).join(','))].join('\n')
}

export function downloadFile(name, content, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}
