import { naira, fmtDate, unitLabel } from './format'

export const DOC_TYPES = {
  acknowledgement:    { label: 'Acknowledgement letter', icon: '📬', sendOn: 'form_submitted' },
  contract_of_sale:   { label: 'Contract of sale',       icon: '📝', sendOn: 'first_payment' },
  receipt:            { label: 'Payment receipt',        icon: '🧾', sendOn: 'every_payment' },
  allocation_letter:  { label: 'Allocation letter',      icon: '📍', sendOn: 'fully_paid' },
  deed_of_assignment: { label: 'Deed of assignment',     icon: '📜', sendOn: 'fully_paid' },
  provisional_survey: { label: 'Provisional survey plan', icon: '🗺️', sendOn: 'manual' },
  statement:          { label: 'Statement of account',   icon: '📊', sendOn: 'manual' },
  other:              { label: 'Other document',         icon: '📄', sendOn: 'manual' },
}

export const SEND_ON = {
  form_submitted: 'When the client submits a payment (before confirmation)',
  first_payment: 'When the first payment is confirmed',
  every_payment: 'Every confirmed payment',
  fully_paid:    'When the client finishes paying',
  manual:        'Only when the team chooses',
}

// Documents that need a specific payment (they quote its amount and receipt)
export const PAYMENT_DOCS = ['receipt', 'acknowledgement']

export const PLACEHOLDERS = [
  ['Company', [
    ['company_name', 'Company name'], ['company_rc_number', 'RC number'], ['company_address', 'Company address'],
    ['company_phone', 'Company phone'], ['company_email', 'Company contact email'],
  ]],
  ['Client', [
    ['client_name', 'Full name'], ['client_title', 'Mr., Mrs., Miss, Dr.…'],
    ['client_name_full', 'Title and name, e.g. Mr. Peter Adama'], ['client_name_upper', 'TITLE AND NAME IN CAPITALS'],
    ['his_her', 'his / her / their'], ['he_she', 'he / she / they'], ['him_her', 'him / her / them'],
    ['client_number', 'Client number, e.g. HCH-PG-022'],
    ['client_email', 'Email'], ['client_phone', 'Phone'], ['client_address', 'Address'],
    ['client_occupation', 'Occupation'], ['client_id_type', 'ID type'], ['client_id_number', 'ID number'],
    ['next_of_kin_name', 'Next of kin'], ['next_of_kin_phone', 'Next of kin phone'], ['next_of_kin_relationship', 'Next of kin relationship'],
  ]],
  ['Property & purchase', [
    ['property_name', 'Property name'], ['property_name_upper', 'PROPERTY NAME IN CAPITALS'],
    ['property_location', 'Location'], ['property_location_upper', 'LOCATION IN CAPITALS'], ['property_code', 'Property code'],
    ['units', 'Number of units bought, e.g. 6'], ['unit_label', '"plot", "plots", "apartment"…'],
    ['unit_size_sqm', 'Size per unit (sqm)'], ['total_size_sqm', 'Total size (sqm), e.g. 3,000'], ['plot_numbers', 'Plot / unit numbers'],
    ['plan_name', 'Payment plan'], ['duration_months', 'Months to pay, e.g. 6'], ['duration_months_words', 'Months in words, e.g. Six'],
    ['unit_price', 'Price per unit'], ['total_price', 'Total price, e.g. ₦2,000,000.00'], ['total_price_words', 'Total price in words'],
    ['discount_amount', 'Discount given'], ['deposit', 'Required deposit'],
    ['purchase_date', 'Purchase date, e.g. 30 Dec 2025'], ['purchase_date_long', 'e.g. 30th day of December 2025'],
    ['realtor_name', 'Realtor name'], ['realtor_phone', 'Realtor phone'], ['grace_days', 'Grace period (days)'],
  ]],
  ['Payment', [
    ['amount_paid', 'This payment'], ['amount_paid_words', 'This payment in words'],
    ['payment_date', 'Date of this payment'], ['payment_status', '"confirmed" or "awaiting confirmation"'],
    ['receipt_number', 'Receipt number'], ['payment_method', 'Payment method'], ['bank_reference', 'Bank reference'], ['payer_name', 'Payer name'],
    ['total_paid', 'Total paid so far'], ['total_paid_words', 'Total paid in words'],
    ['balance', 'Outstanding balance'], ['balance_words', 'Balance in words'],
  ]],
  ['Other', [
    ['today', "Today's date"], ['today_long', 'e.g. 4th day of October 2026'],
    ['#field … /field', 'Show text only when a field has a value, e.g. {{#company_rc_number}}RC {{company_rc_number}}{{/company_rc_number}}. Use ^ instead of # for "when empty".'],
    ['#payments … /payments', 'Repeats for every confirmed payment. Inside use sn, label ("Initial deposit", "Second payment"…), amount, date, receipt. In a table row, it repeats the row.'],
  ]],
]

// ── Amounts in words: "Five Hundred Thousand Naira Only" ──
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion']

function under1000(n) {
  const h = Math.floor(n / 100), rest = n % 100
  const parts = []
  if (h) parts.push(ONES[h] + ' Hundred')
  if (rest) {
    const words = rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? '-' + ONES[rest % 10] : '')
    parts.push(h ? 'and ' + words : words)
  }
  return parts.join(' ')
}

export function numberToWords(n) {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'Zero'
  const lastChunk = n % 1000
  const groups = []
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000
    if (chunk) groups.unshift(under1000(chunk) + (SCALES[i] ? ' ' + SCALES[i] : ''))
  }
  // "One Thousand and Five", not "One Thousand, Five"
  if (groups.length > 1 && lastChunk > 0 && lastChunk < 100) {
    return groups.slice(0, -1).join(', ') + ' and ' + groups[groups.length - 1]
  }
  return groups.join(', ')
}

export function nairaWords(amount) {
  const value = Math.round(Number(amount || 0) * 100)
  const naira = Math.floor(value / 100), kobo = value % 100
  return `${numberToWords(naira)} Naira${kobo ? `, ${numberToWords(kobo)} Kobo` : ''} Only`
}

const METHODS = { bank_transfer: 'Bank transfer', cash: 'Cash', cheque: 'Cheque', pos: 'POS', other: 'Other' }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ORDINALS = ['Initial deposit', 'Second payment', 'Third payment', 'Fourth payment', 'Fifth payment', 'Sixth payment',
  'Seventh payment', 'Eighth payment', 'Ninth payment', 'Tenth payment', 'Eleventh payment', 'Twelfth payment']

// Documents show kobo: ₦2,000,000.00
const money = v => naira(v, { decimals: true })

// "2025-12-30" is a calendar date: read it in local time so it never shifts a day
const toDate = value => {
  const m = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value)
}

function ordinalDay(d) {
  const n = d.getDate(), s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
// "30th day of December 2025"
export function longDate(value) {
  if (!value) return ''
  const d = toDate(value)
  return `${ordinalDay(d)} day of ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
const slashDate = value => {
  if (!value) return ''
  const d = toDate(value)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function pronouns(title) {
  const t = (title || '').toLowerCase().replace(/\./g, '')
  if (['mr', 'master', 'alhaji', 'sir', 'chief mr'].includes(t)) return { his_her: 'his', he_she: 'he', him_her: 'him' }
  if (['mrs', 'miss', 'ms', 'madam', 'alhaja', 'lady'].includes(t)) return { his_her: 'her', he_she: 'she', him_her: 'her' }
  return { his_her: 'their', he_she: 'they', him_her: 'them' }
}

// Everything a template can use, for one purchase (and optionally one payment)
export function buildDocumentData({ org, client, purchase, property, payment, payments = [] }) {
  const confirmed = payments.filter(p => p.status === 'confirmed')
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on) || String(a.reviewed_at).localeCompare(String(b.reviewed_at)))
  const units = Number(purchase.units)
  const sqm = property?.unit_size_sqm ? Number(property.unit_size_sqm) : null
  const totalPaid = Number(purchase.amount_paid ?? confirmed.reduce((s, p) => s + Number(p.amount), 0))
  const balance = Math.max(0, Number(purchase.total_price) - totalPaid)
  const title = client.title ? client.title.trim() : ''
  const fullName = [title, client.full_name].filter(Boolean).join(' ')
  const location = property?.location || ''
  const propertyName = purchase.property_name || property?.name || ''
  return {
    company_name: org.name, company_rc_number: org.rc_number, company_address: org.address,
    company_phone: org.phone, company_email: org.contact_email,
    client_name: client.full_name, client_title: title, client_name_full: fullName, client_name_upper: fullName.toUpperCase(),
    ...pronouns(title),
    client_number: purchase.client_number || '',
    client_email: client.email, client_phone: client.phone, client_address: client.address,
    client_occupation: client.occupation, client_id_type: client.id_type, client_id_number: client.id_number,
    next_of_kin_name: client.next_of_kin_name, next_of_kin_phone: client.next_of_kin_phone,
    next_of_kin_relationship: client.next_of_kin_relationship,
    property_name: propertyName, property_name_upper: propertyName.toUpperCase(),
    property_location: location, property_location_upper: location.toUpperCase(),
    property_code: purchase.property_code || property?.code,
    units: units.toLocaleString('en-NG'), unit_label: unitLabel(purchase.unit_type || property?.unit_type, units),
    unit_size_sqm: sqm?.toLocaleString('en-NG'), total_size_sqm: sqm ? (sqm * units).toLocaleString('en-NG') : null,
    plot_numbers: purchase.plot_numbers || 'To be allocated',
    plan_name: purchase.plan_name, duration_months: String(purchase.duration_months),
    duration_months_words: numberToWords(Number(purchase.duration_months) || 0),
    unit_price: money(purchase.unit_price), total_price: money(purchase.total_price), total_price_words: nairaWords(purchase.total_price),
    discount_amount: money(purchase.discount_amount), deposit: money(Number(purchase.total_price) * Number(purchase.min_deposit_percent) / 100),
    purchase_date: fmtDate(purchase.start_date), purchase_date_long: longDate(purchase.start_date),
    realtor_name: purchase.realtor_name, realtor_phone: purchase.realtor_phone, grace_days: String(org.grace_days),
    amount_paid: payment ? money(payment.amount) : null, amount_paid_words: payment ? nairaWords(payment.amount) : null,
    payment_date: payment ? fmtDate(payment.paid_on) : null,
    payment_status: payment ? (payment.status === 'confirmed' ? 'confirmed' : 'awaiting confirmation') : null,
    receipt_number: payment?.receipt_number, payment_method: payment ? METHODS[payment.method] || payment.method : null,
    bank_reference: payment?.bank_reference, payer_name: payment?.payer_name,
    total_paid: money(totalPaid), total_paid_words: nairaWords(totalPaid),
    balance: money(balance), balance_words: nairaWords(balance),
    today: fmtDate(new Date()), today_long: longDate(new Date()),
    payments: confirmed.map((p, i) => ({
      sn: String(i + 1), label: ORDINALS[i] || `Payment ${i + 1}`,
      amount: money(p.amount), date: slashDate(p.paid_on), date_long: fmtDate(p.paid_on), receipt: p.receipt_number || '',
    })),
  }
}

// The Word libraries are loaded on first use to keep the app's first load small
const loadDocx = () => Promise.all([import('pizzip'), import('docxtemplater')])
  .then(([z, d]) => ({ PizZip: z.default, Docxtemplater: d.default }))

// Fills a .docx template. Returns the new file, or throws with a readable message.
export async function fillTemplate(arrayBuffer, data) {
  const { PizZip, Docxtemplater } = await loadDocx()
  let doc
  try {
    doc = new Docxtemplater(new PizZip(arrayBuffer), {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    })
    doc.render(data)
  } catch (e) {
    const errors = e.properties?.errors?.map(x => x.properties?.explanation).filter(Boolean)
    throw new Error(errors?.length
      ? `The template has a problem: ${errors.slice(0, 3).join('; ')}`
      : "This file couldn't be read as a Word template. Please upload a .docx file.")
  }
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

// Checks an uploaded template and lists the placeholders it uses
export async function inspectTemplate(arrayBuffer) {
  const { PizZip, Docxtemplater } = await loadDocx()
  const known = new Set(PLACEHOLDERS.flatMap(([, items]) => items.map(([k]) => k)).concat(['sn', 'label', 'date', 'date_long', 'amount', 'receipt']))
  let text
  try {
    const doc = new Docxtemplater(new PizZip(arrayBuffer), { delimiters: { start: '{{', end: '}}' }, paragraphLoop: true })
    text = doc.getFullText()
  } catch (e) {
    const errors = e.properties?.errors?.map(x => x.properties?.explanation).filter(Boolean)
    throw new Error(errors?.length ? `The template has a problem: ${errors.slice(0, 3).join('; ')}` : "This doesn't look like a Word (.docx) file.")
  }
  const found = [...new Set([...text.matchAll(/\{\{\s*([#/]?)([\w.]+)\s*\}\}/g)].map(m => m[2]))]
  return { found, unknown: found.filter(k => !known.has(k) && k !== 'payments') }
}

// Shows a .docx inside an element (Word-like pages)
export async function renderPreview(blob, container) {
  const { renderAsync } = await import('docx-preview')
  container.innerHTML = ''
  await renderAsync(blob, container, undefined, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true })
}

// Opens the document in a new tab and brings up the print dialog, where
// "Save as PDF" is available on every device
export async function printDocument(blob, title) {
  const w = window.open('', '_blank')
  if (!w) throw new Error('Please allow pop-ups for this site to print or save as PDF.')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title>
    <style>@page{margin:0}body{margin:0;background:#fff}.docx-wrapper{background:#fff!important;padding:0!important}
    .docx-wrapper>section.docx{box-shadow:none!important;margin:0 auto!important}</style></head><body><p style="font-family:sans-serif;padding:16px">Preparing…</p></body></html>`)
  w.document.close()
  const { renderAsync } = await import('docx-preview')
  w.document.body.innerHTML = ''
  await renderAsync(blob, w.document.body, w.document.head, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true })
  setTimeout(() => { w.focus(); w.print() }, 300)
}
