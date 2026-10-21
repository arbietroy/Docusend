import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listRealtors, getRealtor, saveRealtor, listPurchasesForRealtor, listPayouts, addPayout, deletePayout, realtorLeaderboard, getRealtorAccount, disconnectRealtorAccount } from '../../lib/api'
import { naira, nairaShort, fmtDate, isoDate, initials, toCsv, downloadFile } from '../../lib/format'
import { Card, EmptyState, ErrorBox, Field, Loading, PageHeader, StatCard, StatusBadge, Table, Td, Tabs } from '../../components/ui/Data'
import { Alert, Badge, Modal } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'

const owed = r => Math.max(0, Number(r.commission_earned) - Number(r.commission_paid))

export default function Realtors() {
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, error, loading, reload } = useAsync(async () => can('viewReports') ? listRealtors(org.id) : null, [org.id])

  if (!can('viewReports')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const q = search.trim().toLowerCase()
  const rows = data.filter(r => !q || [r.full_name, r.email, r.phone, r.agency].some(v => v?.toLowerCase().includes(q)))
  const sum = f => data.reduce((s, r) => s + Number(r[f] || 0), 0)
  const totalOwed = data.reduce((s, r) => s + owed(r), 0)

  const exportCsv = () => downloadFile('realtors.csv', toCsv(rows, [
    { label: 'Name', value: r => r.full_name }, { label: 'Email', value: r => r.email }, { label: 'Phone', value: r => r.phone },
    { label: 'Clients', value: r => r.clients }, { label: 'Sales value', value: r => r.sales_value }, { label: 'Collected', value: r => r.collected },
    { label: 'Commission %', value: r => r.commission_percent }, { label: 'Commission earned', value: r => r.commission_earned },
    { label: 'Commission paid', value: r => r.commission_paid }, { label: 'Commission owed', value: owed },
    { label: 'Bank', value: r => r.bank_name }, { label: 'Account name', value: r => r.account_name }, { label: 'Account number', value: r => r.account_number },
  ]))

  return (
    <div className="space-y-5">
      <PageHeader subtitle="Realtors are added automatically when clients name them on the form. Set each one's commission rate to track what they've earned."
        actions={<>
          <Button size="sm" variant="secondary" onClick={exportCsv}>⬇ Export CSV</Button>
          <Button size="sm" onClick={() => setAdding(true)}>+ Add realtor</Button>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Realtors" value={data.filter(r => Number(r.sales) > 0).length} sub={`with sales · ${data.length} in total`} />
        <StatCard label="Sales they brought" value={nairaShort(sum('sales_value'))} sub={`${sum('clients')} clients`} tone="up" />
        <StatCard label="Commission earned" value={nairaShort(sum('commission_earned'))} sub={`on ${nairaShort(sum('collected'))} collected`} />
        <StatCard label="Commission owed" value={nairaShort(totalOwed)} sub={`${nairaShort(sum('commission_paid'))} paid so far`} tone={totalOwed > 0 ? 'warn' : 'neutral'} />
      </div>

      <Leaderboard />

      <RealtorLoginLink org={org} />

      <Input placeholder="Search name, email, phone or agency…" value={search} onChange={e => setSearch(e.target.value)} />

      {rows.length === 0 ? (
        <Card><EmptyState icon="🤝" title={data.length ? 'No matching realtors' : 'No realtors yet'}>
          {!data.length && 'When clients name their realtor on the subscription form, the realtor appears here automatically.'}
        </EmptyState></Card>
      ) : (
        <Table headers={['Realtor', 'Clients', 'Sales value', 'Collected', 'Rate', 'Earned', 'Owed']}>
          {rows.map(r => (
            <tr key={r.id} onClick={() => navigate(`/app/realtors/${r.id}`)} className="hover:bg-white/3 cursor-pointer">
              <Td><p className="font-semibold">{r.full_name} {!r.is_active && <Badge variant="slate">Inactive</Badge>}</p><p className="text-xs text-slate-400">{r.email || r.phone || r.agency}</p></Td>
              <Td>{r.clients}</Td>
              <Td>{naira(r.sales_value)}</Td>
              <Td className="text-green-400">{naira(r.collected)}</Td>
              <Td>{Number(r.commission_percent) ? `${Number(r.commission_percent)}%` : <span className="text-slate-500">not set</span>}</Td>
              <Td>{naira(r.commission_earned)}</Td>
              <Td className={owed(r) > 0 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>{naira(owed(r))}</Td>
            </tr>
          ))}
        </Table>
      )}

      {adding && <RealtorModal onClose={() => setAdding(false)} onSaved={r => { setAdding(false); navigate(`/app/realtors/${r.id}`) }} />}
    </div>
  )
}

export function RealtorDetail() {
  const { id } = useParams()
  const { can } = useOrg()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('viewReports')) return null
    const [realtor, purchases, payouts, account] = await Promise.all([getRealtor(id), listPurchasesForRealtor(id), listPayouts(id), getRealtorAccount(id)])
    return { realtor, purchases, payouts, account }
  }, [id])

  if (!can('viewReports')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const { realtor: r, purchases, payouts, account } = data
  const rate = p => Number(p.commission_percent ?? r.commission_percent)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center font-bold shrink-0">{initials(r.full_name)}</div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{r.full_name} {!r.is_active && <Badge variant="slate">Inactive</Badge>}</h2>
            <p className="text-sm text-slate-400 truncate">{[r.agency, r.email, r.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.phone && <a href={`tel:${r.phone}`} className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10">📞 Call</a>}
          <Button size="sm" variant="secondary" onClick={() => setModal('edit')}>Edit details & rate</Button>
          <Button size="sm" onClick={() => setModal('payout')}>+ Record payout</Button>
        </div>
      </div>

      {!Number(r.commission_percent) && <Alert variant="info">No commission rate set yet. Click "Edit details & rate" to add one, and earned commission will be worked out from every confirmed payment their clients make.</Alert>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Clients" value={r.clients} sub={`${Number(r.units_sold)} unit(s) sold`} />
        <StatCard label="Sales value" value={nairaShort(r.sales_value)} sub={`${nairaShort(r.collected)} collected`} tone="up" />
        <StatCard label={`Earned (${Number(r.commission_percent)}%)`} value={nairaShort(r.commission_earned)} sub={`${nairaShort(r.commission_paid)} paid`} />
        <StatCard label="Owed to realtor" value={nairaShort(owed(r))} tone={owed(r) > 0 ? 'warn' : 'neutral'} sub={r.last_sale_on ? `last sale ${fmtDate(r.last_sale_on)}` : 'no sales yet'} />
      </div>

      <div>
        <h3 className="text-sm font-bold mb-3">Clients</h3>
        {purchases.length === 0 ? <Card><p className="text-sm text-slate-400 text-center py-3">No clients yet.</p></Card> : (
          <Table headers={['Client', 'Client no.', 'Property', 'Price', 'Paid', 'Commission', 'Status']}>
            {purchases.map(p => (
              <tr key={p.id} onClick={() => navigate(`/app/clients/${p.client_id}`)} className="hover:bg-white/3 cursor-pointer">
                <Td className="font-semibold">{p.client_name}</Td>
                <Td className="font-mono text-xs">{p.client_number || '—'}</Td>
                <Td>{p.property_name}</Td>
                <Td>{naira(p.total_price)}</Td>
                <Td className="text-green-400">{naira(p.amount_paid)}</Td>
                <Td>{naira(Number(p.amount_paid) * rate(p) / 100)}{p.commission_percent != null && <span className="text-xs text-slate-500"> ({rate(p)}%)</span>}</Td>
                <Td><StatusBadge status={p.payment_status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <ConnectedLogin realtor={r} account={account} onChanged={reload} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Commission payouts">
          {payouts.length === 0 ? <p className="text-sm text-slate-400">No payouts recorded yet.</p> : (
            <div className="divide-y divide-white/5 -my-2">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{naira(p.amount)}</p>
                    <p className="text-xs text-slate-400 truncate">{fmtDate(p.paid_on)}{p.reference ? ` · ${p.reference}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <button className="text-xs text-slate-500 hover:text-red-300" onClick={async () => {
                    if (!window.confirm(`Delete the ${naira(p.amount)} payout?`)) return
                    try { await deletePayout(p.id); reload() } catch (e) { window.alert(e.message) }
                  }}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Bank details">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Bank">{r.bank_name}</Field>
            <Field label="Account name">{r.account_name}</Field>
            <Field label="Account number">{r.account_number}</Field>
            {r.notes && <Field label="Notes">{r.notes}</Field>}
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-500">Commission is the realtor's rate on every confirmed payment from their clients. A different rate for one sale can be set on that purchase. <Link to="/app/realtors" className="text-blue-400">← All realtors</Link></p>

      {modal === 'edit' && <RealtorModal realtor={r} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
      {modal === 'payout' && <PayoutModal realtor={r} owedAmount={owed(r)} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
    </div>
  )
}

function RealtorModal({ realtor, onClose, onSaved }) {
  const { org } = useOrg()
  const [v, setV] = useState(() => realtor
    ? Object.fromEntries(['id', 'full_name', 'email', 'phone', 'agency', 'bank_name', 'account_name', 'account_number', 'commission_percent', 'is_active', 'notes'].map(k => [k, realtor[k] ?? '']))
    : { full_name: '', email: '', phone: '', agency: '', bank_name: '', account_name: '', account_number: '', commission_percent: '', is_active: true, notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setV({ ...v, [k]: e.target.value })
  const save = async () => {
    if (v.full_name.trim().length < 2) return setError("Enter the realtor's name.")
    const rate = Number(v.commission_percent || 0)
    if (rate < 0 || rate > 100) return setError('Commission must be between 0 and 100%.')
    setBusy(true); setError('')
    try { onSaved(await saveRealtor(org.id, v)) } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <Modal isOpen wide onClose={onClose} title={realtor ? 'Edit realtor' : 'Add a realtor'}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Full name" required className="sm:col-span-2" value={v.full_name} onChange={set('full_name')} />
        <Input label="Email" type="email" value={v.email} onChange={set('email')} hint="Copied on their clients' emails" />
        <Input label="Phone" type="tel" value={v.phone} onChange={set('phone')} />
        <Input label="Agency / firm" value={v.agency} onChange={set('agency')} />
        <Input label="Commission (%)" type="number" min="0" max="100" step="0.1" value={v.commission_percent} onChange={set('commission_percent')} hint="Of every confirmed payment from their clients" />
        <Input label="Bank" value={v.bank_name} onChange={set('bank_name')} />
        <Input label="Account name" value={v.account_name} onChange={set('account_name')} />
        <Input label="Account number" inputMode="numeric" value={v.account_number} onChange={set('account_number')} />
        {realtor && (
          <label className="flex items-center gap-2 text-sm cursor-pointer self-end pb-3">
            <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={v.is_active !== false} onChange={e => setV({ ...v, is_active: e.target.checked })} /> Active
          </label>
        )}
        <Textarea label="Notes" className="sm:col-span-2" rows={2} value={v.notes} onChange={set('notes')} />
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Save</Button>
      </div>
    </Modal>
  )
}

function PayoutModal({ realtor, owedAmount, onClose, onSaved }) {
  const { org } = useOrg()
  const [v, setV] = useState({ amount: owedAmount > 0 ? String(Math.round(owedAmount * 100) / 100) : '', paid_on: isoDate(), reference: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setV({ ...v, [k]: e.target.value })
  const save = async () => {
    if (!(Number(v.amount) > 0)) return setError('Enter the amount paid.')
    setBusy(true); setError('')
    try {
      await addPayout({ org_id: org.id, realtor_id: realtor.id, amount: Number(v.amount), paid_on: v.paid_on, reference: v.reference.trim() || null, notes: v.notes.trim() || null })
      onSaved()
    } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <Modal isOpen onClose={onClose} title="Record a commission payout" subtitle={`${realtor.full_name} · ${naira(owedAmount)} owed`}>
      <div className="flex flex-col gap-3">
        <Input label="Amount (₦)" type="number" min="1" step="any" value={v.amount} onChange={set('amount')} />
        <Input label="Date paid" type="date" value={v.paid_on} onChange={set('paid_on')} />
        <Input label="Reference" value={v.reference} onChange={set('reference')} placeholder="e.g. bank transfer reference" />
        <Textarea label="Notes" rows={2} value={v.notes} onChange={set('notes')} />
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Save payout</Button>
      </div>
    </Modal>
  )
}

const PERIODS = [
  { id: 'month', label: 'This month' }, { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' }, { id: 'all', label: 'All time' },
]
export function periodRange(id) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth()
  const from = id === 'month' ? new Date(y, m, 1) : id === 'quarter' ? new Date(y, m - (m % 3), 1) : id === 'year' ? new Date(y, 0, 1) : new Date(2000, 0, 1)
  return [isoDate(from), isoDate(t)]
}

// Who brought in the most money: confirmed payments from each realtor's clients
function Leaderboard() {
  const { org } = useOrg()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('year')
  const [from, to] = periodRange(period)
  const { data, error, loading } = useAsync(() => realtorLeaderboard(org.id, from, to), [org.id, from, to])
  const top = (data || []).slice(0, 10)
  const max = Math.max(...top.map(r => Number(r.collected)), 1)

  return (
    <Card title="🏆 Who brings in the most money">
      <Tabs tabs={PERIODS} value={period} onChange={setPeriod} />
      {error ? <p className="text-sm text-red-300">{error.message}</p> : loading && !data ? <Loading /> : top.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">No money from realtors' clients in this period.</p>
      ) : (
        <ol className="space-y-3">
          {top.map((r, i) => (
            <li key={r.id}>
              <button onClick={() => navigate(`/app/realtors/${r.id}`)} className="w-full text-left group">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="text-sm min-w-0 truncate"><span className="text-slate-500 w-5 inline-block">{i + 1}.</span><span className="font-semibold group-hover:underline">{r.name}</span>
                    {r.agency && <span className="text-xs text-slate-500"> · {r.agency}</span>}</p>
                  <p className="text-sm font-bold shrink-0">{naira(r.collected)}</p>
                </div>
                <div className="h-2 bg-white/8 rounded-full overflow-hidden ml-5">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(Number(r.collected) / max) * 100}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-5">
                  {Number(r.sales)} new sale{Number(r.sales) !== 1 ? 's' : ''}{Number(r.sales) ? ` worth ${nairaShort(r.sales_value)}` : ''} · {nairaShort(r.commission)} commission earned
                </p>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-slate-500 mt-3">Money brought in = confirmed payments from the realtor's clients in the period, including instalments on earlier sales.</p>
    </Card>
  )
}

export function realtorLoginUrl(org) {
  return `${window.location.origin}/realtor/${org.slug}`
}

function RealtorLoginLink({ org }) {
  const [copied, setCopied] = useState(false)
  const url = realtorLoginUrl(org)
  const message = `Hello! Follow your ${org.name} clients' payments (who is owing, what's due soon and your commission) here: ${url} . Sign up with your email and your name as your clients know you.`
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { window.prompt('Copy this link:', url) }
  }
  return (
    <Card title="🔗 Realtor login link">
      <p className="text-sm text-slate-400 mb-3">
        One link for all your realtors. They sign up with their email and the name clients know them by, and we connect them to
        the clients who named them. Each realtor sees only their own clients (no client phone numbers or emails) and their commission.
      </p>
      <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-300 break-all mb-3">{url}</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>{copied ? '✓ Copied' : 'Copy link'}</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600/20 text-green-300 border border-green-600/30">Share on WhatsApp</a>
      </div>
    </Card>
  )
}

function ConnectedLogin({ realtor, account, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const first = realtor.full_name.split(' ')[0]
  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${account.email}? They will stop seeing ${first}'s clients straight away and can't reconnect this login.`)) return
    setBusy(true); setError('')
    try { await disconnectRealtorAccount(realtor.id); onChanged() } catch (e) { setError(e.message) }
    setBusy(false)
  }
  return (
    <Card title="🔐 Realtor login">
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      {account ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-slate-300">
            Connected to <strong>{account.email}</strong> on {fmtDate(account.created_at)}
            <span className="text-slate-500"> ({account.linked_by === 'email' ? 'matched by email' : 'matched by name'})</span>.
            {account.linked_by === 'name' && <span className="block text-xs text-slate-500 mt-1">If this isn't {first}, disconnect it.</span>}
          </p>
          <Button size="sm" variant="ghost" loading={busy} onClick={disconnect}>Disconnect</Button>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          {first} hasn't signed in yet. Send them your realtor login link from the <Link to="/app/realtors" className="text-blue-400">Realtors page</Link>.
        </p>
      )}
    </Card>
  )
}
