// Reading a company's existing client spreadsheet (Excel or CSV) into rows
// that import_clients() understands.

export const IMPORT_COLUMNS = [
  { key: 'title',             label: 'Title',             aliases: ['title', 'salutation'] },
  { key: 'full_name',         label: 'Full name',         required: true, aliases: ['full name', 'name', 'client name', 'client', 'customer', 'customer name', 'purchaser', 'subscriber'] },
  { key: 'email',             label: 'Email',             aliases: ['email', 'email address', 'e-mail', 'mail'] },
  { key: 'phone',             label: 'Phone',             aliases: ['phone', 'phone number', 'phone no', 'mobile', 'telephone', 'tel', 'gsm'] },
  { key: 'address',           label: 'Address',           aliases: ['address', 'home address', 'residential address'] },
  { key: 'occupation',        label: 'Occupation',        aliases: ['occupation', 'profession', 'job'] },
  { key: 'property',          label: 'Property',          required: true, aliases: ['property', 'estate', 'project', 'product', 'property name', 'estate name', 'property code'] },
  { key: 'plan',              label: 'Payment plan',      aliases: ['plan', 'payment plan', 'duration', 'tenure', 'months'] },
  { key: 'units',             label: 'Units / plots',     aliases: ['units', 'plots', 'no of plots', 'number of plots', 'quantity', 'qty', 'no of units'] },
  { key: 'total_price',       label: 'Total price',       aliases: ['total price', 'total', 'price', 'amount', 'total amount', 'property amount', 'total product amount', 'cost'] },
  { key: 'unit_price',        label: 'Price per unit',    aliases: ['price per unit', 'unit price', 'price per plot'] },
  { key: 'amount_paid',       label: 'Amount paid so far', aliases: ['amount paid', 'paid', 'total paid', 'total amount paid', 'amount paid so far', 'deposit'] },
  { key: 'purchase_date',     label: 'Purchase date',     aliases: ['purchase date', 'date', 'date of purchase', 'subscription date', 'start date'] },
  { key: 'last_payment_date', label: 'Last payment date', aliases: ['last payment date', 'last payment', 'date of last payment'] },
  { key: 'plot_numbers',      label: 'Plot numbers',      aliases: ['plot numbers', 'plot number', 'plot no', 'plot', 'allocation', 'block'] },
  { key: 'client_number',     label: 'Client number',     aliases: ['client number', 'client no', 'client id', 'file number', 'file no', 'customer id'] },
  { key: 'realtor_name',      label: 'Realtor name',      aliases: ['realtor', 'realtor name', 'agent', 'agent name', 'consultant', 'referred by'] },
  { key: 'realtor_email',     label: 'Realtor email',     aliases: ['realtor email', 'agent email'] },
  { key: 'realtor_phone',     label: 'Realtor phone',     aliases: ['realtor phone', 'agent phone', 'realtor number'] },
  { key: 'next_of_kin_name',  label: 'Next of kin',       aliases: ['next of kin', 'next of kin name', 'nok'] },
  { key: 'next_of_kin_phone', label: 'Next of kin phone', aliases: ['next of kin phone', 'nok phone'] },
  { key: 'notes',             label: 'Notes',             aliases: ['notes', 'remarks', 'comment', 'comments'] },
]

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Guess which spreadsheet column holds which field
export function autoMap(headers) {
  const mapping = {}
  const used = new Set()
  // Exact alias matches first, then "contains" matches
  for (const pass of ['exact', 'contains']) {
    for (const col of IMPORT_COLUMNS) {
      if (mapping[col.key] != null) continue
      const idx = headers.findIndex((h, i) => {
        if (used.has(i)) return false
        const n = norm(h)
        return pass === 'exact' ? col.aliases.includes(n) : col.aliases.some(a => a.length > 3 && n.includes(a))
      })
      if (idx >= 0) { mapping[col.key] = idx; used.add(idx) }
    }
  }
  return mapping
}

export async function readSpreadsheet(file) {
  const name = file.name.toLowerCase()
  let rows
  if (name.endsWith('.csv')) {
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    rows = Papa.parse(text, { skipEmptyLines: true }).data
  } else if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    rows = await readSheet(file)
  } else {
    throw new Error('Please upload an Excel (.xlsx) or CSV file. For older .xls files, open them in Excel and "Save As" .xlsx.')
  }
  rows = rows.filter(r => r.some(c => c !== null && String(c).trim() !== ''))
  if (rows.length < 2) throw new Error('The spreadsheet needs a heading row and at least one client.')
  // The heading row is the first row with several text cells
  const headerIdx = Math.max(0, rows.findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 2))
  return { headers: rows[headerIdx].map(h => String(h ?? '').trim()), rows: rows.slice(headerIdx + 1) }
}

// "₦2,000,000.00" → 2000000
export function toNumber(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(/[₦N,\s]/gi, '').replace(/naira/i, ''))
  return Number.isFinite(n) ? n : NaN
}

const pad = n => String(n).padStart(2, '0')
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Dates come as Date objects, Excel serial numbers, "30/12/2025" (day first,
// as used in Nigeria), "2025-12-30" or "30 Dec 2025"
export function toDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return isNaN(v) ? undefined : iso(v)
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return iso(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4))
    return undefined
  }
  const s = String(v).trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    const d = new Date(y, +m[2] - 1, +m[1])
    return d.getMonth() === +m[2] - 1 ? iso(d) : undefined
  }
  const d = new Date(s.replace(/(\d+)(st|nd|rd|th)/i, '$1'))
  return isNaN(d) ? undefined : iso(d)
}

// Turn spreadsheet rows into import rows, with a list of problems per row
export function buildImportRows(rows, mapping, propertyNames) {
  const known = new Set(propertyNames.map(norm))
  return rows.map((r, i) => {
    const get = key => (mapping[key] == null ? null : r[mapping[key]])
    const text = key => { const v = get(key); return v == null ? '' : String(v instanceof Date ? iso(v) : v).trim() }
    const out = {}
    const problems = []
    for (const col of IMPORT_COLUMNS) out[col.key] = text(col.key)
    for (const key of ['units', 'total_price', 'unit_price', 'amount_paid']) {
      const n = toNumber(get(key))
      if (Number.isNaN(n)) problems.push(`"${text(key)}" isn't a number`)
      out[key] = n == null || Number.isNaN(n) ? '' : n
    }
    for (const key of ['purchase_date', 'last_payment_date']) {
      const d = toDate(get(key))
      if (d === undefined) problems.push(`"${text(key)}" isn't a date we recognise`)
      out[key] = d || ''
    }
    // "MR. PETER OKORO" → title "Mr.", name "Peter Okoro"
    const tm = /^(mr|mrs|miss|ms|dr|chief|engr|prof|pastor|alhaji|alhaja|barr)\.?\s+(.+)$/i.exec(out.full_name)
    if (tm) {
      if (!out.title) out.title = tm[1][0].toUpperCase() + tm[1].slice(1).toLowerCase() + (/^(mr|mrs|ms|dr|engr|prof|barr)$/i.test(tm[1]) ? '.' : '')
      out.full_name = tm[2]
    }
    if (out.full_name && out.full_name === out.full_name.toUpperCase()) {
      out.full_name = out.full_name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    }
    if (!out.full_name) problems.push('No name')
    if (!out.property) problems.push('No property')
    else if (!known.has(norm(out.property))) problems.push(`Property "${out.property}" isn't set up in DocuSend`)
    if (!out.total_price && !out.unit_price && !out.plan) problems.push('No price or plan')
    return { line: i + 1, data: out, problems }
  })
}

export function templateCsv() {
  const head = IMPORT_COLUMNS.map(c => c.label)
  const example = ['Mr.', 'Peter Okoro', 'peter@example.com', '08031234567', '4 Allen Avenue, Ikeja', 'Engineer',
    'Palm Grove Estate', '6 months', '2', '10000000', '', '6500000', '30/12/2025', '27/04/2026', 'Block C, Plots 14-15',
    '', 'Kunle Ade', 'kunle@example.com', '08051234567', 'Ada Okoro', '08059876543', '']
  const esc = v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [head, example].map(r => r.map(esc).join(',')).join('\n')
}
