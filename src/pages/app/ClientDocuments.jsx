import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { downloadTemplate, saveDocument, downloadDocument } from '../../lib/api'
import { DOC_TYPES, PAYMENT_DOCS, buildDocumentData, fillTemplate, renderPreview, printDocument } from '../../lib/documents'
import { downloadFile, fmtDate, fmtDateTime, naira } from '../../lib/format'
import { Alert, Badge, Modal } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'

// A property's own template wins over the company-wide one
export function pickTemplate(templates, propertyId, docType) {
  const active = templates.filter(t => t.is_active && t.doc_type === docType)
  return active.find(t => t.property_id === propertyId) || active.find(t => !t.property_id) || null
}

// Which documents are due at this point in the client's journey
export function suggestedTypes(templates, purchase, payment, purchasePayments) {
  if (payment?.status === 'pending') {
    return Object.keys(DOC_TYPES).filter(type => pickTemplate(templates, purchase.property_id, type)?.send_on === 'form_submitted')
  }
  const confirmed = purchasePayments.filter(p => p.status === 'confirmed')
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on) || String(a.reviewed_at).localeCompare(String(b.reviewed_at)))
  const isFirst = !!payment && confirmed[0]?.id === payment.id
  const fullyPaid = Number(purchase.amount_paid) >= Number(purchase.total_price)
  return Object.keys(DOC_TYPES).filter(type => {
    const t = pickTemplate(templates, purchase.property_id, type)
    if (!t) return false
    if (t.send_on === 'form_submitted') return false
    if (t.send_on === 'every_payment') return !!payment
    if (t.send_on === 'first_payment') return !!isFirst
    if (t.send_on === 'fully_paid') return fullyPaid
    return false
  })
}

const safeName = s => s.replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim()

export function DocumentsList({ documents, onCreate, canCreate }) {
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  const fetchBlob = async d => {
    setError('')
    try { return await downloadDocument(d.file_path) } catch (e) { setError(e.message); return null }
  }
  const download = async d => { const b = await fetchBlob(d); if (b) downloadFile(`${safeName(d.name)}.docx`, b, b.type) }
  const print = async d => { const b = await fetchBlob(d); if (b) printDocument(b, d.name).catch(e => setError(e.message)) }
  const view = async d => { const b = await fetchBlob(d); if (b) setPreview({ blob: b, name: d.name }) }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Documents</p>
        {canCreate && <button onClick={onCreate} className="text-xs text-blue-400 hover:underline">+ Create document</button>}
      </div>
      {error && <div className="mb-2"><Alert>{error}</Alert></div>}
      {documents.length === 0 ? <p className="text-sm text-slate-500">No documents yet.</p> : (
        <div className="divide-y divide-white/5 border border-white/8 rounded-lg">
          {documents.map(d => (
            <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm truncate">{DOC_TYPES[d.doc_type]?.icon} {d.name}</p>
                <p className="text-xs text-slate-500">{fmtDateTime(d.created_at)}{d.status === 'sent' ? ` · emailed to ${d.sent_to}` : ''}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => view(d)}>View</Button>
                <Button size="sm" variant="secondary" onClick={() => print(d)}>PDF</Button>
                <Button size="sm" variant="secondary" onClick={() => download(d)}>Word</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {preview && <PreviewModal {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

export function PreviewModal({ blob, name, onClose }) {
  const ref = useRef(null)
  const boxRef = useRef(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    // Shrink the Word page (about 816px wide plus margins) to fit the preview box
    const fit = () => boxRef.current && setZoom(Math.min(1, (boxRef.current.clientWidth - 8) / 840))
    fit()
    window.addEventListener('resize', fit)
    if (ref.current) renderPreview(blob, ref.current).catch(e => setError(e.message))
    return () => window.removeEventListener('resize', fit)
  }, [blob])
  return (
    <Modal isOpen wide onClose={onClose} title={name}>
      {error && <Alert>{error}</Alert>}
      <div ref={boxRef} className="bg-slate-200 rounded-lg overflow-auto max-h-[65vh] mb-4">
        <div ref={ref} style={{ zoom }} className="[&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-3" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadFile(`${safeName(name)}.docx`, blob, blob.type)}>⬇ Word</Button>
        <Button onClick={() => printDocument(blob, name).catch(e => setError(e.message))}>🖨 Print / Save as PDF</Button>
      </div>
    </Modal>
  )
}

// Choose which documents to generate for a purchase, fill them in and file them
export function CreateDocumentsModal({ client, purchase, property, payments, templates, initialPaymentId, onClose, onSaved }) {
  const { org, can } = useOrg()
  // Acknowledgements can go out before a payment is confirmed; receipts can't
  const usable = payments.filter(p => p.status !== 'rejected').sort((a, b) => b.paid_on.localeCompare(a.paid_on))
  const [paymentId, setPaymentId] = useState(initialPaymentId || usable.find(p => p.status === 'confirmed')?.id || usable[0]?.id || '')
  const payment = usable.find(p => p.id === paymentId)
  const available = Object.keys(DOC_TYPES).filter(type => pickTemplate(templates, purchase.property_id, type))
  const [selected, setSelected] = useState(() => new Set(suggestedTypes(templates, purchase, payment, payments)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [preview, setPreview] = useState(null)

  const toggle = type => setSelected(s => { const n = new Set(s); n.has(type) ? n.delete(type) : n.add(type); return n })
  const needsPayment = [...selected].some(t => PAYMENT_DOCS.includes(t))

  const generate = async () => {
    if (!selected.size) return setError('Choose at least one document.')
    if (needsPayment && !payment) return setError('Choose which payment these documents are for.')
    if (selected.has('receipt') && payment?.status !== 'confirmed') return setError('A receipt can only be issued for a confirmed payment. Untick it, or confirm the payment first.')
    setBusy(true); setError('')
    const out = []
    try {
      for (const type of available.filter(t => selected.has(t))) {
        const template = pickTemplate(templates, purchase.property_id, type)
        const usesPayment = PAYMENT_DOCS.includes(type)
        const data = buildDocumentData({ org, client, purchase, property, payment: usesPayment ? payment : null, payments })
        const blob = await fillTemplate(await downloadTemplate(template.file_path), data)
        const label = DOC_TYPES[type].label
        const name = `${label} · ${purchase.client_number || client.full_name}${usesPayment && payment?.receipt_number ? ` · ${payment.receipt_number}` : ''}`
        const doc = await saveDocument({ orgId: org.id, subscriptionId: purchase.id, paymentId: usesPayment ? payment.id : null, template, name, blob })
        out.push({ doc, blob })
      }
      setResults(out)
    } catch (e) {
      setError(e.message)
      if (out.length) setResults(out)
    }
    setBusy(false)
  }

  if (results) {
    return (
      <Modal isOpen wide onClose={() => { onClose(); onSaved() }} title="Documents ready"
        subtitle={`Saved to ${client.full_name}'s file. Preview them, then download or save as PDF.`}>
        {error && <div className="mb-3"><Alert>{error}</Alert></div>}
        <div className="divide-y divide-white/5 border border-white/8 rounded-lg mb-4">
          {results.map(({ doc, blob }) => (
            <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
              <p className="text-sm min-w-0 truncate">{DOC_TYPES[doc.doc_type]?.icon} {doc.name}</p>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" onClick={() => setPreview({ blob, name: doc.name })}>Preview</Button>
                <Button size="sm" variant="secondary" onClick={() => printDocument(blob, doc.name).catch(e => setError(e.message))}>PDF</Button>
                <Button size="sm" variant="secondary" onClick={() => downloadFile(`${safeName(doc.name)}.docx`, blob, blob.type)}>Word</Button>
              </div>
            </div>
          ))}
        </div>
        <Alert variant="info">Emailing documents to the client (with the realtor copied in) is coming in the next update.</Alert>
        <Button className="w-full mt-4" onClick={() => { onClose(); onSaved() }}>Done</Button>
        {preview && <PreviewModal {...preview} onClose={() => setPreview(null)} />}
      </Modal>
    )
  }

  return (
    <Modal isOpen wide onClose={onClose} title="Create documents"
      subtitle={`${client.full_name} · ${purchase.property_name} · ${purchase.client_number || 'no client number yet'}`}>
      {available.length === 0 ? (
        <Alert variant="info">
          No document templates yet. {can('manageProperties')
            ? <>Add them on the <Link to="/app/templates" className="underline">Templates</Link> page (sample templates are one click away).</>
            : 'Ask an admin to add them on the Templates page.'}
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {available.map(type => (
              <label key={type} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer ${selected.has(type) ? 'border-blue-500/50 bg-blue-600/10' : 'border-white/10'}`}>
                <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={selected.has(type)} onChange={() => toggle(type)} />
                <span className="text-sm">{DOC_TYPES[type].icon} {DOC_TYPES[type].label}</span>
              </label>
            ))}
          </div>
          {needsPayment && (
            usable.length
              ? <Select label="For which payment?" value={paymentId} className="mb-4"
                  onChange={e => { setPaymentId(e.target.value); setSelected(new Set(suggestedTypes(templates, purchase, usable.find(p => p.id === e.target.value), payments))) }}>
                  {usable.map(p => <option key={p.id} value={p.id}>{fmtDate(p.paid_on)} · {naira(p.amount)} · {p.receipt_number || 'awaiting confirmation'}</option>)}
                </Select>
              : <div className="mb-4"><Alert variant="warning">This client has no payments yet, so receipts and acknowledgements can't be created.</Alert></div>
          )}
          {!purchase.plot_numbers && [...selected].some(t => ['allocation_letter', 'deed_of_assignment', 'provisional_survey'].includes(t)) && (
            <div className="mb-4"><Alert variant="warning">No plot numbers are recorded for this purchase, so they'll show as "To be allocated". A team lead can add them with Edit on the purchase.</Alert></div>
          )}
          {error && <div className="mb-4"><Alert>{error}</Alert></div>}
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" loading={busy} onClick={generate}>Create {selected.size || ''} document{selected.size !== 1 ? 's' : ''}</Button>
          </div>
          <p className="text-xs text-slate-500 mt-3"><Badge variant="slate">Tip</Badge> Ticked documents are the ones due now, based on each template's settings.</p>
        </>
      )}
    </Modal>
  )
}
