import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listProperties, importClients } from '../../lib/api'
import { IMPORT_COLUMNS, autoMap, readSpreadsheet, buildImportRows, templateCsv } from '../../lib/importer'
import { downloadFile, naira, toCsv } from '../../lib/format'
import { Card, ErrorBox, Loading, PageHeader } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

const BATCH = 500

export default function Import() {
  const { org, can } = useOrg()
  const { data: properties, error: loadError, loading } = useAsync(async () => can('exportData') ? listProperties(org.id) : null, [org.id])
  const [sheet, setSheet] = useState(null)
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  if (!can('exportData')) return <Navigate to="/app" replace />
  if (loading) return <Loading />
  if (loadError) return <ErrorBox error={loadError} />

  const propertyKeys = properties.flatMap(p => [p.name, p.code])
  const rows = sheet ? buildImportRows(sheet.rows, mapping, propertyKeys) : []
  const good = rows.filter(r => !r.problems.length)
  const bad = rows.filter(r => r.problems.length)

  const onFile = async file => {
    setError(''); setResult(null); setSheet(null)
    if (!file) return
    try {
      const parsed = await readSpreadsheet(file)
      setSheet({ ...parsed, name: file.name })
      setMapping(autoMap(parsed.headers))
    } catch (e) { setError(e.message) }
  }

  const runImport = async () => {
    if (!good.length) return
    setBusy(true); setError(''); setProgress(0)
    const all = { imported: 0, failed: 0, rows: [] }
    try {
      for (let i = 0; i < good.length; i += BATCH) {
        const chunk = good.slice(i, i + BATCH)
        const res = await importClients(org.id, chunk.map(r => r.data))
        all.imported += res.imported
        all.failed += res.failed
        res.rows.forEach((x, j) => all.rows.push({ ...x, line: chunk[j].line, name: chunk[j].data.full_name }))
        setProgress(Math.min(good.length, i + BATCH))
      }
      setResult(all)
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  const failedRows = result ? result.rows.filter(r => !r.ok) : []

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader subtitle="Bring in clients who paid before you started using DocuSend, straight from your Excel sheet." />

      <Card title="1. Get your spreadsheet ready">
        <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-5 mb-4">
          <li>One row per client per property. A client with two properties gets two rows.</li>
          <li>Needed: <strong>name</strong>, <strong>property</strong> (name or code, as set up in <Link to="/app/properties" className="text-blue-400 underline">Properties</Link>) and a <strong>price or payment plan</strong>.</li>
          <li>Helpful: email, phone, units, amount paid so far, purchase date, plot numbers, realtor, and your existing client number (we'll keep it).</li>
          <li>Your column headings don't have to match exactly; you can choose what each column means after uploading.</li>
        </ul>
        <Button variant="secondary" size="sm" onClick={() => downloadFile('docusend-client-import-template.csv', templateCsv())}>⬇ Download example sheet</Button>
      </Card>

      <Card title="2. Upload it">
        <label className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-white/20 hover:border-white/40 cursor-pointer">
          <span className="text-2xl">📊</span>
          <span className="text-sm text-slate-300 truncate">{sheet ? `${sheet.name} · ${sheet.rows.length} rows` : 'Choose an Excel (.xlsx) or CSV file'}</span>
          <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { onFile(e.target.files?.[0] || null); e.target.value = '' }} />
        </label>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </Card>

      {sheet && !result && (
        <>
          <Card title="3. Check the columns">
            <p className="text-sm text-slate-400 mb-4">We matched your headings automatically. Fix any that are wrong.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {IMPORT_COLUMNS.map(col => (
                <label key={col.key} className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">{col.label}{col.required && <span className="text-red-400"> *</span>}</span>
                  <select value={mapping[col.key] ?? ''} onChange={e => setMapping({ ...mapping, [col.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className={`bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none [&>option]:bg-navy2 ${mapping[col.key] != null ? 'border-blue-500/40' : 'border-white/10'}`}>
                    <option value="">Not in my sheet</option>
                    {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </Card>

          <Card title={`4. Review: ${good.length} ready, ${bad.length} need fixing`}>
            {bad.length > 0 && (
              <div className="mb-4">
                <Alert variant="warning">Rows with problems are skipped. Fix them in your sheet and upload again, or import the good rows now and the rest later.</Alert>
                <div className="mt-3 max-h-56 overflow-auto border border-white/8 rounded-lg divide-y divide-white/5">
                  {bad.slice(0, 100).map(r => (
                    <div key={r.line} className="px-3 py-2 text-sm"><strong>Row {r.line}{r.data.full_name ? ` · ${r.data.full_name}` : ''}:</strong> <span className="text-amber-300">{r.problems.join('; ')}</span></div>
                  ))}
                </div>
              </div>
            )}
            <div className="overflow-x-auto border border-white/8 rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-slate-400">
                  {['Name', 'Property', 'Plan', 'Units', 'Price', 'Paid', 'Purchase date', 'Client no.', 'Realtor'].map(h => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {good.slice(0, 8).map(r => (
                    <tr key={r.line} className="border-t border-white/5 whitespace-nowrap">
                      <td className="px-3 py-2">{[r.data.title, r.data.full_name].filter(Boolean).join(' ')}</td>
                      <td className="px-3 py-2">{r.data.property}</td><td className="px-3 py-2">{r.data.plan || '—'}</td>
                      <td className="px-3 py-2">{r.data.units || 1}</td>
                      <td className="px-3 py-2">{r.data.total_price ? naira(r.data.total_price) : r.data.unit_price ? `${naira(r.data.unit_price)}/unit` : 'from plan'}</td>
                      <td className="px-3 py-2">{naira(r.data.amount_paid || 0)}</td><td className="px-3 py-2">{r.data.purchase_date || 'today'}</td>
                      <td className="px-3 py-2">{r.data.client_number || 'new'}</td><td className="px-3 py-2">{r.data.realtor_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {good.length > 8 && <p className="text-xs text-slate-500 px-3 py-2 border-t border-white/5">…and {good.length - 8} more</p>}
            </div>
            {good.some(r => !r.data.plan && Number(r.data.amount_paid || 0) < Number(r.data.total_price || 0)) && (
              <div className="mb-3"><Alert variant="info">Some unpaid clients have no payment plan, so their full balance counts as due now and they may show as owing or defaulting. Add a "Payment plan" column (e.g. "6 months") to spread their balance over monthly instalments.</Alert></div>
            )}
            <p className="text-xs text-slate-500 mb-4">Amounts already paid are recorded as one confirmed payment ("balance brought forward") on the last payment date. Clients with the same email are combined. No emails are sent to clients.</p>
            <Button loading={busy} disabled={!good.length} onClick={runImport}>
              {busy ? `Importing… ${progress}/${good.length}` : `Import ${good.length} client purchase${good.length !== 1 ? 's' : ''}`}
            </Button>
          </Card>
        </>
      )}

      {result && (
        <Card title="Import finished">
          <Alert variant={result.failed ? 'warning' : 'success'}>
            {result.imported} imported{result.failed ? `, ${result.failed} could not be imported` : ''}.
          </Alert>
          {failedRows.length > 0 && (
            <div className="mt-3 max-h-56 overflow-auto border border-white/8 rounded-lg divide-y divide-white/5">
              {failedRows.map(r => <div key={r.line} className="px-3 py-2 text-sm"><strong>Row {r.line} · {r.name}:</strong> <span className="text-amber-300">{r.error}</span></div>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to="/app/clients" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">View clients</Link>
            {failedRows.length > 0 && <Button variant="secondary" onClick={() => downloadFile('import-problems.csv', toCsv(failedRows, [
              { label: 'Row', value: r => r.line }, { label: 'Name', value: r => r.name }, { label: 'Problem', value: r => r.error }]))}>⬇ Download problems</Button>}
            <Button variant="secondary" onClick={() => { setResult(null); setSheet(null) }}>Import another file</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
