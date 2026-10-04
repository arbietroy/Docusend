import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listClients, listPurchases, listProperties } from '../../lib/api'
import { naira, PAYMENT_STATUS, toCsv, downloadFile } from '../../lib/format'
import { EmptyState, ErrorBox, Loading, PageHeader, StatusBadge, Table, Td } from '../../components/ui/Data'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'

export default function Clients() {
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [property, setProperty] = useState('')
  const [status, setStatus] = useState('')

  const { data, error, loading, reload } = useAsync(async () => {
    const [clients, purchases, properties] = await Promise.all([listClients(org.id), listPurchases(org.id), listProperties(org.id)])
    return { clients, purchases, properties }
  }, [org.id])

  // One row per purchase, plus clients who don't have a purchase yet
  const rows = useMemo(() => {
    if (!data) return []
    const byClient = new Set(data.purchases.map(p => p.client_id))
    const loose = data.clients.filter(c => !byClient.has(c.id)).map(c => ({
      id: 'c-' + c.id, client_id: c.id, client_name: c.full_name, client_email: c.email, client_phone: c.phone,
      client_number: null, property_name: '—', payment_status: null, total_price: 0, amount_paid: 0, balance: 0,
    }))
    return [...data.purchases, ...loose]
  }, [data])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const q = search.trim().toLowerCase()
  const filtered = rows.filter(r =>
    (!property || r.property_id === property) &&
    (!status || r.payment_status === status) &&
    (!q || [r.client_name, r.client_number, r.client_email, r.client_phone, r.realtor_name].some(v => v?.toLowerCase().includes(q))))

  const exportCsv = () => downloadFile('clients.csv', toCsv(filtered, [
    { label: 'Client number', value: r => r.client_number },
    { label: 'Name', value: r => r.client_name },
    { label: 'Email', value: r => r.client_email },
    { label: 'Phone', value: r => r.client_phone },
    { label: 'Property', value: r => r.property_name },
    { label: 'Plan', value: r => r.plan_name },
    { label: 'Units', value: r => r.units },
    { label: 'Total price', value: r => r.total_price },
    { label: 'Paid', value: r => r.amount_paid },
    { label: 'Balance', value: r => r.balance },
    { label: 'Status', value: r => PAYMENT_STATUS[r.payment_status]?.label },
    { label: 'Realtor', value: r => r.realtor_name },
  ]))

  return (
    <div>
      <PageHeader
        subtitle={`${data.clients.length} client${data.clients.length !== 1 ? 's' : ''} · ${data.purchases.length} purchase${data.purchases.length !== 1 ? 's' : ''}`}
        actions={<>
          {can('exportData') && <Button size="sm" variant="secondary" onClick={exportCsv}>⬇ Export CSV</Button>}
          <Button size="sm" onClick={() => navigate('/app/clients/new')}>+ Add client</Button>
        </>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_180px] gap-2.5 mb-4">
        <Input placeholder="Search name, client number, email, phone or realtor…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={property} onChange={e => setProperty(e.target.value)}>
          <option value="">All properties</option>
          {data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-navy2 border border-white/8 rounded-xl">
          <EmptyState icon="👥" title={rows.length ? 'No matching clients' : 'No clients yet'}
            action={!rows.length && <Link to="/app/forms" className="text-sm text-blue-400 hover:underline">Share your subscription form →</Link>}>
            {!rows.length && 'Clients appear here when they fill your subscription form, or when you add them yourself.'}
          </EmptyState>
        </div>
      ) : (
        <Table headers={['Client', 'Client no.', 'Property', 'Paid', 'Balance', 'Status']}>
          {filtered.map(r => (
            <tr key={r.id} onClick={() => navigate(`/app/clients/${r.client_id}`)} className="hover:bg-white/3 cursor-pointer">
              <Td><p className="font-semibold">{r.client_name}</p><p className="text-xs text-slate-400">{r.client_email || r.client_phone}</p></Td>
              <Td className="font-mono text-xs">{r.client_number || <span className="text-slate-500">—</span>}</Td>
              <Td className="text-slate-300">{r.property_name}</Td>
              <Td className="text-green-400 font-semibold">{r.payment_status ? naira(r.amount_paid) : '—'}</Td>
              <Td className={Number(r.balance) > 0 ? 'text-amber-400' : 'text-slate-400'}>{r.payment_status ? naira(r.balance) : '—'}</Td>
              <Td>{r.payment_status ? <StatusBadge status={r.payment_status} /> : <span className="text-xs text-slate-500">No purchase</span>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
