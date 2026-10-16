import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getRealtorPortal } from '../../lib/api'
import { naira, nairaShort, fmtDate, fmtDateTime, initials, isoDate, unitLabel } from '../../lib/format'
import { Loading, Progress, StatusBadge, Tabs } from '../../components/ui/Data'

// A realtor's private, read-only view of their own clients
export default function RealtorPortal() {
  const { token } = useParams()
  const { data, error, loading, reload } = useAsync(() => getRealtorPortal(token), [token])
  const [tab, setTab] = useState('attention')

  if (loading && !data) return <div className="min-h-screen bg-navy"><Loading /></div>
  if (error || !data) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold mb-2">This link isn't active</h1>
          <p className="text-sm text-slate-400 max-w-sm">It may have been turned off or replaced. Please ask the company for your current link.</p>
        </div>
      </div>
    )
  }

  const { company, realtor, commission, clients } = data
  const today = isoDate()
  const in30 = isoDate(new Date(Date.now() + 30 * 864e5))
  const attention = clients.filter(c => ['owing', 'defaulting'].includes(c.status))
  const upcoming = clients.filter(c => c.next_due_date && c.next_due_date >= today && c.next_due_date <= in30 && !['owing', 'defaulting'].includes(c.status))
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  const lists = { attention, upcoming, all: clients }
  const owed = Math.max(0, Number(commission?.earned || 0) - Number(commission?.paid || 0))

  return (
    <div className="min-h-screen bg-navy">
      <div className="h-1.5" style={{ background: company.brand_color }} />
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center gap-3 mb-6">
          {company.logo_url
            ? <img src={company.logo_url} alt="" className="w-11 h-11 rounded-xl object-contain bg-white/5" />
            : <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black" style={{ background: company.brand_color }}>{initials(company.name)}</div>}
          <div className="min-w-0">
            <p className="font-bold truncate">{company.name}</p>
            <p className="text-xs text-slate-400">Realtor dashboard</p>
          </div>
        </div>

        <h1 className="text-2xl font-black mb-1">Hello, {realtor.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-400 mb-6">Your clients' payments at a glance. Updated {fmtDateTime(data.generated_at)}.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Tile label="Clients" value={clients.length} />
          <Tile label="Need follow-up" value={attention.length} tone={attention.length ? 'text-red-300' : ''} />
          <Tile label="Due in 30 days" value={upcoming.length} />
          <Tile label="Commission owed" value={nairaShort(owed)} sub={`${Number(realtor.commission_percent)}% · ${nairaShort(commission?.earned)} earned`} />
        </div>

        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'attention', label: 'Owing & defaulting', count: attention.length },
          { id: 'upcoming', label: 'Due soon', count: upcoming.length },
          { id: 'all', label: 'All clients', count: clients.length },
        ]} />

        <div className="space-y-3">
          {lists[tab].length === 0 && (
            <div className="bg-navy2 border border-white/8 rounded-xl p-8 text-center text-sm text-slate-400">
              {tab === 'attention' ? 'None of your clients are behind. 🎉' : tab === 'upcoming' ? 'No payments due in the next 30 days.' : 'No clients yet.'}
            </div>
          )}
          {lists[tab].map(c => (
            <div key={c.client_number} className="bg-navy2 border border-white/8 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 truncate">{c.client_number} · {c.property} · {Number(c.units)} {unitLabel(c.unit_type, c.units)} · {c.plan}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <Progress value={Number(c.paid)} max={Number(c.total_price)} className="mb-2" />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-slate-500">Paid</p><p className="font-semibold text-green-400">{naira(c.paid)}</p></div>
                <div><p className="text-slate-500">Balance</p><p className="font-semibold">{naira(c.balance)}</p></div>
                <div>
                  {['owing', 'defaulting'].includes(c.status)
                    ? <><p className="text-slate-500">Overdue</p><p className="font-semibold text-red-300">{naira(c.overdue)}{c.days_overdue > 0 ? ` · ${c.days_overdue}d late` : ''}</p></>
                    : c.next_due_date && Number(c.balance) > 0
                      ? <><p className="text-slate-500">Next payment</p><p className="font-semibold">{naira(c.next_due_amount)} · {fmtDate(c.next_due_date)}</p></>
                      : <><p className="text-slate-500">Status</p><p className="font-semibold text-green-400">{Number(c.balance) > 0 ? 'Up to date' : 'Fully paid'}</p></>}
                </div>
              </div>
              {c.last_paid_on && <p className="text-[11px] text-slate-500 mt-2">Last payment {fmtDate(c.last_paid_on)}</p>}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 text-center mt-8">
          Questions about a client's account? Contact {company.name}{company.phone ? ` on ${company.phone}` : ''}{company.contact_email ? ` or ${company.contact_email}` : ''}.
          <br />This page is private to you. Please don't share the link. <button onClick={reload} className="underline">Refresh</button>
        </p>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, tone = '' }) {
  return (
    <div className="bg-navy2 border border-white/8 rounded-xl p-3.5 min-w-0">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black truncate ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
    </div>
  )
}
