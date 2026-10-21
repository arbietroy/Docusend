import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listPurchases, listProperties, listPayments } from '../../lib/api'
import { naira, nairaShort, fmtDate, unitLabel, isoDate } from '../../lib/format'
import { reminderEmail } from '../../lib/emails'
import { Card, ErrorBox, Loading, PageHeader, Progress, StatCard, Table, Td } from '../../components/ui/Data'

const sum = (rows, f) => rows.reduce((s, r) => s + Number(r[f] || 0), 0)

export default function Operations() {
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('confirmPayments')) return null
    const [purchases, properties, pending] = await Promise.all([listPurchases(org.id), listProperties(org.id), listPayments(org.id, 'pending')])
    return { purchases, properties, pending }
  }, [org.id])

  if (!can('confirmPayments')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const { purchases, properties, pending } = data
  const today = isoDate()
  const inAWeek = isoDate(new Date(Date.now() + 7 * 864e5))
  const weekAgo = new Date(Date.now() - 7 * 864e5)
  const live = purchases.filter(p => !['pending', 'cancelled'].includes(p.payment_status))
  const dueSoon = live.filter(p => p.next_due_date && p.next_due_date >= today && p.next_due_date <= inAWeek && Number(p.next_due_amount) > 0)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  const behind = live.filter(p => ['owing', 'defaulting'].includes(p.payment_status))
  const toAllocate = live.filter(p => p.payment_status === 'fully_paid' && !p.plot_numbers)
  const newForms = pending.filter(p => p.source === 'form' && new Date(p.submitted_at) >= weekAgo)

  return (
    <div className="space-y-5">
      <PageHeader subtitle="What's happening across your properties and what needs doing." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="⏳ Payments to confirm" value={pending.length} sub={`${newForms.length} new form submission(s) this week`} tone={pending.length ? 'warn' : 'neutral'} to="/app/payments" />
        <StatCard label="📅 Due in the next 7 days" value={dueSoon.length} sub={nairaShort(sum(dueSoon, 'next_due_amount')) + ' expected'} />
        <StatCard label="🚨 Behind on payments" value={behind.length} sub={`${behind.filter(p => p.payment_status === 'defaulting').length} defaulting · ${nairaShort(sum(behind, 'amount_overdue'))} overdue`} tone={behind.length ? 'down' : 'neutral'} to="/app/collections" />
        <StatCard label="📍 Awaiting allocation" value={toAllocate.length} sub="fully paid, no plot number yet" tone={toAllocate.length ? 'warn' : 'neutral'} />
      </div>

      <div>
        <h3 className="text-sm font-bold mb-3">Inventory by property</h3>
        <Table headers={['Property', 'Total', 'Sold', 'Awaiting confirmation', 'Available', 'Fully paid', 'Allocated', 'Sold %']}>
          {properties.filter(p => p.status !== 'archived').map(p => {
            const mine = purchases.filter(x => x.property_id === p.id)
            const sold = mine.filter(x => !['pending', 'cancelled'].includes(x.payment_status))
            const unitsSold = sum(sold, 'units')
            const unitsPending = sum(mine.filter(x => x.payment_status === 'pending'), 'units')
            const paidOff = sold.filter(x => x.payment_status === 'fully_paid')
            const allocated = sum(sold.filter(x => x.plot_numbers), 'units')
            const total = Number(p.total_units)
            return (
              <tr key={p.id} className="hover:bg-white/3 cursor-pointer" onClick={() => can('manageProperties') && navigate(`/app/properties/${p.id}`)}>
                <Td><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-400">{unitLabel(p.unit_type, 2)}{p.status === 'pre_launch' ? ' · pre-launch' : ''}</p></Td>
                <Td>{total}</Td>
                <Td className="font-semibold">{unitsSold}</Td>
                <Td className={unitsPending ? 'text-amber-400' : 'text-slate-500'}>{unitsPending}</Td>
                <Td className="text-green-400 font-semibold">{Math.max(0, total - unitsSold)}</Td>
                <Td>{sum(paidOff, 'units')}</Td>
                <Td>{allocated}</Td>
                <Td><div className="w-24"><Progress value={unitsSold} max={total} /><p className="text-xs text-slate-400 mt-1">{total ? Math.round((unitsSold / total) * 100) : 0}%</p></div></Td>
              </tr>
            )
          })}
        </Table>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="📅 Due in the next 7 days">
          {dueSoon.length === 0 ? <p className="text-sm text-slate-400 text-center py-3">No instalments due this week.</p> : (
            <div className="divide-y divide-white/5 -my-2">
              {dueSoon.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/app/clients/${p.client_id}`} className="min-w-0 hover:opacity-80">
                    <p className="text-sm font-semibold truncate">{p.client_name}</p>
                    <p className="text-xs text-slate-400 truncate">{p.client_number} · {p.property_name} · due {fmtDate(p.next_due_date)}</p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold">{naira(p.next_due_amount)}</span>
                    {p.client_email && <a href={reminderEmail(org, { ...p, amount_overdue: p.next_due_amount })} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">✉️</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="📍 Fully paid, awaiting allocation">
          {toAllocate.length === 0 ? <p className="text-sm text-slate-400 text-center py-3">Every fully paid client has plot numbers.</p> : (
            <div className="divide-y divide-white/5 -my-2">
              {toAllocate.map(p => (
                <Link key={p.id} to={`/app/clients/${p.client_id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.client_name}</p>
                    <p className="text-xs text-slate-400 truncate">{p.client_number} · {p.property_name} · {Number(p.units)} {unitLabel(p.unit_type, p.units)}</p>
                  </div>
                  <span className="text-xs text-blue-400 shrink-0">Allocate →</span>
                </Link>
              ))}
            </div>
          )}
          {toAllocate.length > 0 && <p className="text-xs text-slate-500 mt-3">Open the client, click Edit on the purchase to add plot numbers, then create the allocation letter.</p>}
        </Card>
      </div>
    </div>
  )
}
