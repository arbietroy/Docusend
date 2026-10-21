import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import {
  listTemplates, listProperties, uploadTemplate, replaceTemplateFile, updateTemplate, deleteTemplate, downloadTemplate,
} from '../../lib/api'
import { DOC_TYPES, SEND_ON, PLACEHOLDERS, inspectTemplate } from '../../lib/documents'
import { downloadFile, fmtDate } from '../../lib/format'
import { Card, ErrorBox, Loading, PageHeader } from '../../components/ui/Data'
import { Alert, Badge, Modal } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'

const SAMPLE_TYPES = ['acknowledgement', 'contract_of_sale', 'receipt', 'allocation_letter', 'deed_of_assignment', 'provisional_survey', 'statement']

export default function Templates() {
  const { org, can } = useOrg()
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data, error: loadError, loading, reload } = useAsync(async () => {
    if (!can('manageProperties')) return null
    const [templates, properties] = await Promise.all([listTemplates(org.id), listProperties(org.id)])
    return { templates, properties }
  }, [org.id])

  if (!can('manageProperties')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (loadError) return <ErrorBox error={loadError} onRetry={reload} />
  const { templates, properties } = data
  const propName = id => properties.find(p => p.id === id)?.name

  const addSamples = async () => {
    setBusy(true); setError('')
    try {
      for (const type of SAMPLE_TYPES) {
        if (templates.some(t => t.doc_type === type && !t.property_id)) continue
        const res = await fetch(`/sample-templates/${type}.docx`)
        if (!res.ok) throw new Error('Could not load the sample templates.')
        const file = new File([await res.blob()], `${type}.docx`)
        await uploadTemplate(org.id, { doc_type: type, name: `${DOC_TYPES[type].label} (sample)`, send_on: DOC_TYPES[type].sendOn }, file)
      }
      reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  const act = async fn => { setError(''); try { await fn(); reload() } catch (e) { setError(e.message) } }

  const download = async t => {
    try { downloadFile(t.file_name, await downloadTemplate(t.file_path), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        subtitle="Upload your Word documents with {{placeholders}} where client details go. DocuSend fills them in for each client."
        actions={<>
          <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'guide' })}>📖 Placeholder guide</Button>
          <Button size="sm" onClick={() => setModal({ type: 'upload', docType: 'receipt' })}>+ Upload template</Button>
        </>}
      />
      {error && <Alert>{error}</Alert>}

      {templates.length === 0 && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Start with our sample templates</p>
              <p className="text-sm text-slate-400">Receipt, acknowledgement, contract of sale, allocation letter, deed of assignment, survey plan and statement. Download them, put in your own wording and letterhead, then upload them back.</p>
            </div>
            <Button loading={busy} onClick={addSamples} className="shrink-0">Add sample templates</Button>
          </div>
        </Card>
      )}

      {Object.entries(DOC_TYPES).map(([type, meta]) => {
        const list = templates.filter(t => t.doc_type === type)
        return (
          <Card key={type}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{meta.icon}</span>
                <h3 className="font-bold">{meta.label}</h3>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'upload', docType: type })}>+ Add</Button>
            </div>
            {list.length === 0 ? <p className="text-sm text-slate-500">No template yet.</p> : (
              <div className="divide-y divide-white/5 border border-white/8 rounded-lg">
                {list.map(t => (
                  <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name} {!t.is_active && <Badge variant="slate">Off</Badge>}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {t.property_id ? `Only for ${propName(t.property_id)}` : 'All properties'} · {t.file_name} · updated {fmtDate(t.updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={t.send_on} onChange={e => act(() => updateTemplate(t.id, { send_on: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none [&>option]:bg-navy2" aria-label="When to send">
                        {Object.entries(SEND_ON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <Button size="sm" variant="secondary" onClick={() => download(t)}>Download</Button>
                      <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'replace', template: t })}>Replace</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(() => updateTemplate(t.id, { is_active: !t.is_active }))}>{t.is_active ? 'Turn off' : 'Turn on'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => window.confirm(`Remove "${t.name}"? Documents already generated stay on file.`) && act(() => deleteTemplate(t))}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {modal?.type === 'guide' && <PlaceholderGuide onClose={() => setModal(null)} />}
      {(modal?.type === 'upload' || modal?.type === 'replace') && (
        <UploadModal mode={modal.type} docType={modal.docType} template={modal.template} properties={properties}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />
      )}
    </div>
  )
}

function UploadModal({ mode, docType, template, properties, onClose, onSaved }) {
  const { org } = useOrg()
  const [v, setV] = useState({
    doc_type: template?.doc_type || docType, property_id: '', name: DOC_TYPES[docType || 'other'].label,
    send_on: DOC_TYPES[docType || 'other'].sendOn,
  })
  const [file, setFile] = useState(null)
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onFile = async f => {
    setFile(f); setCheck(null); setError('')
    if (!f) return
    if (!/\.docx$/i.test(f.name)) return setError('Please choose a Word file ending in .docx. Older .doc files: open them in Word and "Save As" .docx.')
    try { setCheck(await inspectTemplate(await f.arrayBuffer())) } catch (e) { setError(e.message) }
  }

  const save = async () => {
    if (!file || !check) return setError('Choose a Word (.docx) file first.')
    if (mode === 'upload' && v.name.trim().length < 2) return setError('Give the template a name.')
    setBusy(true); setError('')
    try {
      if (mode === 'replace') await replaceTemplateFile(template, file)
      else await uploadTemplate(org.id, v, file)
      onSaved()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <Modal isOpen wide onClose={onClose} title={mode === 'replace' ? `Replace "${template.name}"` : 'Upload a template'}
      subtitle="A Word (.docx) file with placeholders like {{client_name}} where the client's details should go.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mode === 'upload' && <>
          <Select label="Document type" value={v.doc_type} onChange={e => setV({ ...v, doc_type: e.target.value, name: DOC_TYPES[e.target.value].label, send_on: DOC_TYPES[e.target.value].sendOn })}>
            {Object.entries(DOC_TYPES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
          <Select label="Used for" value={v.property_id} onChange={e => setV({ ...v, property_id: e.target.value })}
            hint="A property's own template is used instead of the company-wide one">
            <option value="">All properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>Only {p.name}</option>)}
          </Select>
          <Input label="Name" value={v.name} onChange={e => setV({ ...v, name: e.target.value })} />
          <Select label="When it's due" value={v.send_on} onChange={e => setV({ ...v, send_on: e.target.value })}>
            {Object.entries(SEND_ON).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </>}
        <label className="sm:col-span-2 flex items-center gap-3 p-4 rounded-lg border border-dashed border-white/20 hover:border-white/40 cursor-pointer">
          <span className="text-2xl">📄</span>
          <span className="text-sm text-slate-300 truncate">{file ? file.name : 'Choose a .docx file'}</span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
            onChange={e => onFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      {check && (
        <div className="mt-4">
          {check.found.length === 0
            ? <Alert variant="warning">No placeholders found. Every client will get the same document. Add placeholders like {'{{client_name}}'} where details should go.</Alert>
            : <Alert variant={check.unknown.length ? 'warning' : 'success'}>
                Found {check.found.length} placeholder{check.found.length !== 1 ? 's' : ''}.
                {check.unknown.length > 0 && <> These aren't recognised and will be left blank: <strong>{check.unknown.join(', ')}</strong>. Check the spelling against the placeholder guide.</>}
              </Alert>}
        </div>
      )}
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} disabled={!check} onClick={save}>{mode === 'replace' ? 'Replace file' : 'Save template'}</Button>
      </div>
    </Modal>
  )
}

function PlaceholderGuide({ onClose }) {
  const [copied, setCopied] = useState('')
  const copy = async key => {
    const text = key.startsWith('#') ? '{{#payments}}{{date}} {{amount}} {{receipt}}{{/payments}}' : `{{${key}}}`
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }
  return (
    <Modal isOpen wide onClose={onClose} title="Placeholder guide"
      subtitle="Type these into your Word document exactly as shown, including the double curly brackets. Tap one to copy it.">
      <div className="space-y-5">
        {PLACEHOLDERS.map(([group, items]) => (
          <div key={group}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{group}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {items.map(([key, label]) => (
                <button key={key} onClick={() => copy(key)} className="text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/3 hover:bg-white/8">
                  <span className="min-w-0">
                    <code className="text-xs text-blue-300 break-all">{key.startsWith('#') ? '{{#payments}} … {{/payments}}' : `{{${key}}}`}</code>
                    <span className="block text-xs text-slate-500">{label}</span>
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">{copied === key ? '✓' : 'Copy'}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <Alert variant="info">Tip: type each placeholder in one go. If Word underlines it or you change the formatting halfway through, retype it. Otherwise Word can split it and it won't be filled in.</Alert>
      </div>
    </Modal>
  )
}
