import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listPurchases, listPayments, listProperties, seedDemoData } from '../../lib/api'
import { naira, nairaShort, fmtDate, unitLabel } from '../../lib/format'
import { Card, EmptyState, ErrorBox, Loading, Progress, StatCard, StatusBadge } from '../../components/ui/Data'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Badge'

export default function Overview() {
  const { org, can, member } = useOrg()
  const { data, error, loading, reload } = useAsync(async () => {
    const [purchases, payments, properties] = await Promise.all([
      listPurchases(org.id), listPayments(org.id), listProperties(org.id)])
    return { purchases, payments, properties }
  }, [org.id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const { purchases, payments, properties } = data
  if (!properties.length) return <GettingStarted onSeeded={reload} />

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const confirmed = payments.filter(p => p.status === 'confirmed')
  const pending   = payments.filter(p => p.status === 'pending')
  const thisMonth = confirmed.filter(p => new Date(p.paid_on) >= monthStart)
  const active    = purchases.filter(p => !['pending', 'cancelled'].includes(p.payment_status))
  const outstanding = active.reduce((s, p) => s + Number(p.balance), 0)
  const owing     = purchases.filter(p => p.payment_status === 'owing')
  const defaulting = purchases.filter(p => p.payment_status === 'defaulting')
  const firstName = (member?.full_name || '').split(' ')[0]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
        <p className="text-sm text-slate-400">Here's where things stand at {org.name}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="💰 Collected this month" value={nairaShort(thisMonth.reduce((s, p) => s + Number(p.amount), 0))}
          sub={`${thisMonth.length} payment${thisMonth.length !== 1 ? 's' : ''}`} tone="up" />
        <StatCard label="⏳ Awaiting confirmation" value={pending.length} to="/app/payments"
          sub={pending.length ? nairaShort(pending.reduce((s, p) => s + Number(p.amount), 0)) + ' to check' : 'All caught up'} tone={pending.length ? 'warn' : 'neutral'} />
        <StatCard label="📉 Outstanding balance" value={nairaShort(outstanding)} sub={`across ${active.filter(p => Number(p.balance) > 0).length} clients`} />
        <StatCard label="🚨 Owing / defaulting" value={`${owing.length} / ${defaulting.length}`} to="/app/collections"
          sub={defaulting.length ? `${defaulting.length} past the grace period` : 'No defaulters'} tone={defaulting.length ? 'down' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="⚡ Awaiting confirmation" action={<Link to="/app/payments" className="text-xs text-blue-400 hover:underline">View all →</Link>}>
          {pending.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">No payments waiting. New form submissions will appear here.</p>
            : <div className="divide-y divide-white/5 -my-2">
                {pending.slice(0, 5).map(p => (
                  <Link key={p.id} to="/app/payments" className="flex items-center justify-between gap-3 py-3 hover:bg-white/2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.subscriptions?.clients?.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">{p.subscriptions?.properties?.name} · {fmtDate(p.paid_on)}</p>
                    </div>
                    <p className="text-sm font-bold text-amber-400 shrink-0">{naira(p.amount)}</p>
                  </Link>
                ))}
              </div>}
        </Card>

        <Card title="🚨 Needs follow-up" action={<Link to="/app/collections" className="text-xs text-blue-400 hover:underline">View all →</Link>}>
          {owing.length + defaulting.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">Nobody is behind on payments. 🎉</p>
            : <div className="divide-y divide-white/5 -my-2">
                {[...defaulting, ...owing].sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 5).map(p => (
                  <Link key={p.id} to={`/app/clients/${p.client_id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-white/2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.client_name}</p>
                      <p className="text-xs text-slate-400 truncate">{p.client_number} · {p.days_overdue > 0 ? `${p.days_overdue} days late` : 'due today'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-300">{naira(p.amount_overdue)}</p>
                      <StatusBadge status={p.payment_status} />
                    </div>
                  </Link>
                ))}
              </div>}
        </Card>
      </div>

      {can('manageProperties') && (
        <Card title="🏘️ Sales by property" action={<Link to="/app/properties" className="text-xs text-blue-400 hover:underline">Manage →</Link>}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.filter(p => p.status !== 'archived').map(p => {
              const sold = purchases.filter(x => x.property_id === p.id && !['pending', 'cancelled'].includes(x.payment_status))
              const units = sold.reduce((s, x) => s + Number(x.units), 0)
              return (
                <Link key={p.id} to={`/app/properties/${p.id}`} className="block p-4 rounded-lg bg-white/3 border border-white/5 hover:border-blue-600/30">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <span className="text-xs text-slate-500">{p.code}</span>
                  </div>
                  <Progress value={units} max={Number(p.total_units)} className="mb-1.5" />
                  <p className="text-xs text-slate-400">{units} of {Number(p.total_units)} {unitLabel(p.unit_type, p.total_units)} sold · {sold.length} client{sold.length !== 1 ? 's' : ''}</p>
                </Link>
              )
            })}
          </div>
        </Card>
      )}

      <Card title="Recent confirmed payments">
        {confirmed.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No confirmed payments yet.</p> : (
          <div className="divide-y divide-white/5 -my-2">
            {confirmed.slice(0, 6).map(p => (
              <Link key={p.id} to={`/app/clients/${p.subscriptions?.client_id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-white/2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.subscriptions?.clients?.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{p.subscriptions?.client_number} · {p.receipt_number} · {fmtDate(p.paid_on)}</p>
                </div>
                <p className="text-sm font-bold text-green-400 shrink-0">{naira(p.amount)}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function GettingStarted({ onSeeded }) {
  const { org, can } = useOrg()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadSample = async () => {
    setBusy(true); setError('')
    try { await seedDemoData(org.id); onSeeded() }
    catch (e) { setError(e.message) }
    setBusy(false)
  }

  if (!can('manageProperties')) {
    return (
      <Card>
        <EmptyState icon="🏗️" title="Your workspace is being set up">
          An admin needs to add the company's first property before clients and payments can be recorded.
        </EmptyState>
      </Card>
    )
  }

  return (
    <Card>
      <EmptyState icon="🏘️" title={`Welcome to ${org.name}'s workspace`}>
        Start by adding your first property, with its location, units and prices for each payment plan.
        Or load sample data to see how everything works.
      </EmptyState>
      {error && <div className="mb-4 max-w-md mx-auto"><Alert>{error}</Alert></div>}
      <div className="flex flex-col sm:flex-row gap-2.5 justify-center pb-6">
        <Link to="/app/properties/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center">+ Add your first property</Link>
        <Button variant="secondary" loading={busy} onClick={loadSample}>Load sample data</Button>
      </div>
    </Card>
  )
}
