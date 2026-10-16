import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { executiveSummary, listPurchases } from '../../lib/api'
import { naira, nairaShort, fmtDate, isoDate, unitLabel } from '../../lib/format'
import { Card, ErrorBox, Loading, Progress, StatCard, Tabs } from '../../components/ui/Data'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import BarChart from '../../components/ui/BarChart'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function rangeFor(id) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth()
  if (id === 'this_month') return [new Date(y, m, 1), t]
  if (id === 'last_month') return [new Date(y, m - 1, 1), new Date(y, m, 0)]
  if (id === 'this_quarter') return [new Date(y, m - (m % 3), 1), t]
  if (id === 'this_year') return [new Date(y, 0, 1), t]
  if (id === 'this_week') { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [d, t] }
  return null
}

const PERIODS = [
  { id: 'this_week', label: 'This week' }, { id: 'this_month', label: 'This month' }, { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' }, { id: 'this_year', label: 'This year' }, { id: 'custom', label: 'Custom' },
]

export default function Directors() {
  const { org, can } = useOrg()
  const [period, setPeriod] = useState('this_month')
  const [custom, setCustom] = useState({ from: isoDate(new Date(new Date().getFullYear(), 0, 1)), to: isoDate() })
  const [from, to] = period === 'custom' ? [custom.from, custom.to] : rangeFor(period).map(isoDate)

  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('viewReports')) return null
    const [s, purchases] = await Promise.all([executiveSummary(org.id, from, to), listPurchases(org.id)])
    return { s, purchases }
  }, [org.id, from, to])

  if (!can('viewReports')) return <Navigate to="/app" replace />

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{org.name} at a glance</h2>
          <p className="text-sm text-slate-400">{fmtDate(from)} – {fmtDate(to)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>🖨 Print / save PDF</Button>
      </div>
      <Tabs tabs={PERIODS} value={period} onChange={setPeriod} />
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Input label="From" type="date" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} />
          <Input label="To" type="date" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : <Dashboard {...data} />}
    </div>
  )
}

function Dashboard({ s, purchases }) {
  const soldPct = Number(s.units_total) ? Math.round((Number(s.units_sold_total) / Number(s.units_total)) * 100) : 0
  const collectedPct = Number(s.contract_value) ? Math.round((Number(s.collected_total) / Number(s.contract_value)) * 100) : 0
  const active = purchases.filter(p => ['owing', 'defaulting', 'on_track'].includes(p.payment_status))
  const overdue = active.reduce((t, p) => t + Number(p.amount_overdue), 0)
  const defaulting = active.filter(p => p.payment_status === 'defaulting')
  const monthly = s.monthly.map(m => {
    const [y, mm] = m.month.split('-').map(Number)
    return { ...m, label: MONTHS[mm - 1], fullLabel: `${MONTHS[mm - 1]} ${y}` }
  })

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="💰 Money collected" value={nairaShort(s.collected)} sub="in this period" tone="up" />
        <StatCard label="🏷️ New sales" value={nairaShort(s.sales_value)} sub={`${s.new_sales} sale${s.new_sales !== 1 ? 's' : ''} · ${Number(s.units_sold_period)} unit(s)`} tone="up" />
        <StatCard label="🏘️ Inventory sold" value={`${soldPct}%`} sub={`${Number(s.units_sold_total)} of ${Number(s.units_total)} units, all time`} />
        <StatCard label="📉 Still to collect" value={nairaShort(s.outstanding)} sub={`${collectedPct}% of all sales collected`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="⏰ Overdue right now" value={nairaShort(overdue)} sub={`${active.filter(p => p.payment_status === 'owing').length} owing · ${defaulting.length} defaulting`} tone={overdue ? 'down' : 'neutral'} to="/app/collections" />
        <StatCard label="⏳ Awaiting confirmation" value={nairaShort(s.pending_value)} sub={`${s.pending_count} payment(s) for the team to check`} tone={s.pending_count ? 'warn' : 'neutral'} to="/app/payments" />
        <StatCard label="📑 Total sales on the books" value={nairaShort(s.contract_value)} sub={`${nairaShort(s.collected_total)} collected so far`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card><BarChart title="Money collected, last 12 months" data={monthly.map(m => ({ ...m, value: Number(m.collected) }))} format={nairaShort} /></Card>
        <Card><BarChart title="New sales, last 12 months" data={monthly.map(m => ({ ...m, value: Number(m.sales) }))} format={nairaShort} /></Card>
      </div>

      <Card title="Properties" action={<Link to="/app/properties" className="text-xs text-blue-400 hover:underline">Details →</Link>}>
        <div className="space-y-4">
          {s.properties.length === 0 && <p className="text-sm text-slate-400">No properties yet.</p>}
          {s.properties.map(p => {
            const pct = Number(p.total_units) ? Math.round((Number(p.units_sold) / Number(p.total_units)) * 100) : 0
            return (
              <div key={p.code}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1.5">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    <strong className="text-white">{pct}% sold</strong> · {Number(p.units_sold)} of {Number(p.total_units)} {unitLabel(p.unit_type, p.total_units)}
                    {' · '}{nairaShort(p.sales_value)} sales · {nairaShort(p.collected)} collected · {nairaShort(p.outstanding)} to collect
                  </p>
                </div>
                <Progress value={Number(p.units_sold)} max={Number(p.total_units)} />
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Top realtors this period" action={<Link to="/app/realtors" className="text-xs text-blue-400 hover:underline">All realtors →</Link>}>
        {s.top_realtors.length === 0 ? <p className="text-sm text-slate-400">No realtor sales in this period.</p> : (
          <div className="divide-y divide-white/5 -my-2">
            {s.top_realtors.map((r, i) => (
              <div key={r.name} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm"><span className="text-slate-500 mr-2">{i + 1}.</span>{r.name}</p>
                <p className="text-sm"><strong>{naira(r.sales_value)}</strong> <span className="text-xs text-slate-400">· {r.sales} sale{r.sales !== 1 ? 's' : ''}</span></p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
