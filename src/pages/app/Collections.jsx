import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listPurchases } from '../../lib/api'
import { naira, fmtDate, toCsv, downloadFile } from '../../lib/format'
import { reminderEmail } from '../../lib/emails'
import { Card, EmptyState, ErrorBox, Loading, PageHeader, StatusBadge, Tabs } from '../../components/ui/Data'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'

export default function Collections() {
  const { org, can } = useOrg()
  const [tab, setTab] = useState('all')
  const [property, setProperty] = useState('')
  const [copied, setCopied] = useState(false)
  const { data, error, loading, reload } = useAsync(() => listPurchases(org.id), [org.id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const behind = data.filter(p => ['owing', 'defaulting'].includes(p.payment_status))
  const properties = [...new Map(behind.map(p => [p.property_id, p.property_name])).entries()]
  const rows = behind
    .filter(p => tab === 'all' || p.payment_status === tab)
    .filter(p => !property || p.property_id === property)
    .sort((a, b) => b.days_overdue - a.days_overdue || b.amount_overdue - a.amount_overdue)
  const totalOverdue = rows.reduce((s, p) => s + Number(p.amount_overdue), 0)

  const copyEmails = async () => {
    const emails = [...new Set(rows.map(r => r.client_email).filter(Boolean))].join(', ')
    try { await navigator.clipboard.writeText(emails); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { window.prompt('Copy these emails:', emails) }
  }

  const exportCsv = () => downloadFile('owing-and-defaulting.csv', toCsv(rows, [
    { label: 'Client number', value: r => r.client_number }, { label: 'Name', value: r => r.client_name },
    { label: 'Email', value: r => r.client_email }, { label: 'Phone', value: r => r.client_phone },
    { label: 'Property', value: r => r.property_name }, { label: 'Overdue amount', value: r => r.amount_overdue },
    { label: 'Days late', value: r => r.days_overdue }, { label: 'Balance', value: r => r.balance },
    { label: 'Last payment', value: r => r.last_paid_on }, { label: 'Realtor', value: r => r.realtor_name },
  ]))

  return (
    <div>
      <PageHeader
        subtitle={`Clients behind on their instalment schedule. "Defaulting" means more than ${org.grace_days} days late.`}
        actions={<>
          {rows.length > 0 && <Button size="sm" variant="secondary" onClick={copyEmails}>{copied ? '✓ Copied' : '📋 Copy emails'}</Button>}
          {can('exportData') && rows.length > 0 && <Button size="sm" variant="secondary" onClick={exportCsv}>⬇ Export CSV</Button>}
        </>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'all', label: 'All', count: behind.length },
        { id: 'owing', label: 'Owing', count: behind.filter(p => p.payment_status === 'owing').length },
        { id: 'defaulting', label: 'Defaulting', count: behind.filter(p => p.payment_status === 'defaulting').length },
      ]} />
      {properties.length > 1 && (
        <Select value={property} onChange={e => setProperty(e.target.value)} className="mb-4 sm:max-w-xs">
          <option value="">All properties</option>
          {properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
      )}

      {rows.length > 0 && <p className="text-sm text-slate-400 mb-3">{rows.length} client{rows.length !== 1 ? 's' : ''} · <span className="text-red-300 font-semibold">{naira(totalOverdue)}</span> overdue</p>}

      <Card className="!p-0">
        {rows.length === 0 ? <EmptyState icon="🎉" title="Nobody here">All clients in this view are up to date.</EmptyState> : (
          <div className="divide-y divide-white/5">
            {rows.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5">
                <Link to={`/app/clients/${p.client_id}`} className="min-w-0 flex-1 hover:opacity-80">
                  <p className="text-sm font-semibold truncate">{p.client_name} <span className="ml-1"><StatusBadge status={p.payment_status} /></span></p>
                  <p className="text-xs text-slate-400 truncate">
                    {p.client_number} · {p.property_name} · {p.days_overdue > 0 ? `${p.days_overdue} days late` : 'due today'}
                    {' · '}last paid {fmtDate(p.last_paid_on)}
                  </p>
                </Link>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="sm:text-right">
                    <p className="text-sm font-bold text-red-300">{naira(p.amount_overdue)}</p>
                    <p className="text-xs text-slate-500">balance {naira(p.balance)}</p>
                  </div>
                  {p.client_email
                    ? <a href={reminderEmail(org, p)} className="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">✉️ Remind</a>
                    : p.client_phone && <a href={`tel:${p.client_phone}`} className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10">📞 Call</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500 mt-3">Reminders open in your email app with the realtor copied in. Automatic reminders from DocuSend are coming with the email update.</p>
    </div>
  )
}
