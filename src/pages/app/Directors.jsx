import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { directorsSummary, listPurchases } from '../../lib/api'
import { naira, nairaShort, fmtDate, isoDate } from '../../lib/format'
import { Card, ErrorBox, Loading, PageHeader, StatCard, Table, Td, Tabs } from '../../components/ui/Data'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

function monday(d) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day); return x
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function rangeFor(id) {
  const today = new Date()
  if (id === 'this_week') return [monday(today), today]
  if (id === 'last_week') { const m = addDays(monday(today), -7); return [m, addDays(m, 6)] }
  if (id === 'this_month') return [new Date(today.getFullYear(), today.getMonth(), 1), today]
  if (id === 'last_month') return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)]
  return null
}

export default function Directors() {
  const { org, can } = useOrg()
  const [period, setPeriod] = useState('this_week')
  const [custom, setCustom] = useState({ from: isoDate(addDays(new Date(), -30)), to: isoDate() })
  const [from, to] = period === 'custom' ? [custom.from, custom.to] : rangeFor(period).map(isoDate)

  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('viewReports')) return null
    const [summary, purchases] = await Promise.all([directorsSummary(org.id, from, to), listPurchases(org.id)])
    return { summary, purchases }
  }, [org.id, from, to])

  if (!can('viewReports')) return <Navigate to="/app" replace />

  return (
    <div className="space-y-5">
      <PageHeader title={`${org.name}: sales summary`} subtitle={`${fmtDate(from)} – ${fmtDate(to)}`}
        actions={<Button size="sm" variant="secondary" onClick={() => window.print()}>🖨 Print / save PDF</Button>} />
      <Tabs value={period} onChange={setPeriod} tabs={[
        { id: 'this_week', label: 'This week' }, { id: 'last_week', label: 'Last week' },
        { id: 'this_month', label: 'This month' }, { id: 'last_month', label: 'Last month' }, { id: 'custom', label: 'Custom' },
      ]} />
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Input label="From" type="date" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} />
          <Input label="To" type="date" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}

      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : <Report {...data} />}
    </div>
  )
}

function Report({ summary: s, purchases }) {
  const active = purchases.filter(p => !['pending', 'cancelled'].includes(p.payment_status))
  const outstanding = active.reduce((t, p) => t + Number(p.balance), 0)
  const overdue = active.reduce((t, p) => t + Number(p.amount_overdue), 0)
  const defaulting = active.filter(p => p.payment_status === 'defaulting')

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="💰 Money collected" value={nairaShort(s.collected)} sub={`${s.payments_count} confirmed payment${s.payments_count !== 1 ? 's' : ''}`} tone="up" />
        <StatCard label="🏷️ New sales" value={s.new_sales} sub={`${Number(s.units_sold)} unit(s) · ${nairaShort(s.sales_value)} value`} tone="up" />
        <StatCard label="✅ Fully paid off" value={s.completed} sub="clients who completed payment" />
        <StatCard label="⏳ Awaiting confirmation" value={s.pending_count} sub={`${nairaShort(s.pending_value)} right now`} tone={s.pending_count ? 'warn' : 'neutral'} />
      </div>

      <Card title="Company position today">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-400 text-xs">Total outstanding</p><p className="text-xl font-black">{naira(outstanding)}</p></div>
          <div><p className="text-slate-400 text-xs">Overdue right now</p><p className="text-xl font-black text-amber-400">{naira(overdue)}</p></div>
          <div><p className="text-slate-400 text-xs">Defaulting clients</p><p className="text-xl font-black text-red-300">{defaulting.length}</p></div>
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-bold mb-3">By property</h3>
        <Table headers={['Property', 'Collected', 'Units sold']}>
          {s.by_property.map(p => (
            <tr key={p.code}><Td className="font-semibold">{p.name} <span className="text-slate-500 text-xs">{p.code}</span></Td>
              <Td className="text-green-400">{naira(p.collected)}</Td><Td>{Number(p.units_sold)}</Td></tr>
          ))}
        </Table>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-3">Team activity</h3>
        {s.by_staff.length === 0 ? <Card><p className="text-sm text-slate-400 text-center py-3">No staff activity in this period.</p></Card> : (
          <Table headers={['Team member', 'Payments confirmed', 'Total actions']}>
            {s.by_staff.map(m => <tr key={m.name}><Td className="font-semibold">{m.name}</Td><Td>{m.confirmed}</Td><Td>{m.actions}</Td></tr>)}
          </Table>
        )}
      </div>
    </>
  )
}
