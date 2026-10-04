import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listActivity } from '../../lib/api'
import { fmtDateTime, toCsv, downloadFile } from '../../lib/format'
import { Card, EmptyState, ErrorBox, Loading, PageHeader } from '../../components/ui/Data'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'

const ICONS = { payment: '💳', payments: '💳', client: '👤', clients: '👤', subscriptions: '🏷️', properties: '🏘️', payment_plans: '🏘️', member: '🧑‍🤝‍🧑', invitations: '✉️', organization: '🏢', organizations: '🏢' }

export default function Activity() {
  const { org, can } = useOrg()
  const [person, setPerson] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(200)
  const { data, error, loading, reload } = useAsync(async () => can('viewActivity') ? listActivity(org.id, { limit }) : null, [org.id, limit])

  if (!can('viewActivity')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const people = [...new Set(data.map(a => a.actor_name))].sort()
  const q = search.trim().toLowerCase()
  const rows = data.filter(a => (!person || a.actor_name === person) && (!q || a.summary.toLowerCase().includes(q)))

  return (
    <div>
      <PageHeader subtitle="Everything your team does in DocuSend, newest first. Only admins can see this."
        actions={<Button size="sm" variant="secondary" onClick={() => downloadFile('activity-log.csv', toCsv(rows, [
          { label: 'When', value: r => r.created_at }, { label: 'Who', value: r => r.actor_name }, { label: 'What', value: r => r.summary },
        ]))}>⬇ Export CSV</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-2.5 mb-4">
        <Input placeholder="Search activity…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={person} onChange={e => setPerson(e.target.value)}>
          <option value="">Everyone</option>
          {people.map(p => <option key={p}>{p}</option>)}
        </Select>
      </div>
      <Card className="!p-0">
        {rows.length === 0 ? <EmptyState icon="🧾" title="No activity yet" /> : (
          <div className="divide-y divide-white/5">
            {rows.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className="text-lg shrink-0 w-6 text-center">{ICONS[a.entity_type] || '•'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><strong className="font-semibold">{a.actor_name}</strong> <span className="text-slate-300">· {a.summary}</span></p>
                  <p className="text-xs text-slate-500">{fmtDateTime(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {data.length >= limit && <div className="text-center mt-4"><Button variant="secondary" size="sm" onClick={() => setLimit(limit + 300)}>Load older activity</Button></div>}
    </div>
  )
}
