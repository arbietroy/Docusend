import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listProperties, listPurchases, getProperty, saveProperty } from '../../lib/api'
import { naira, nairaShort, unitLabel, UNIT_LABELS } from '../../lib/format'
import { Card, EmptyState, ErrorBox, Loading, PageHeader, Progress, StatCard, StatusBadge, Table, Td } from '../../components/ui/Data'
import { Alert, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Input'

const STATUS = { pre_launch: ['Pre-launch', 'blue'], active: ['Selling', 'green'], sold_out: ['Sold out', 'amber'], archived: ['Archived', 'slate'] }

export function inventory(property, purchases) {
  const mine = purchases.filter(p => p.property_id === property.id)
  const sold = mine.filter(p => !['pending', 'cancelled'].includes(p.payment_status))
  const sum = (rows, f) => rows.reduce((s, r) => s + Number(r[f] || 0), 0)
  const unitsSold = sum(sold, 'units')
  return {
    clients: new Set(sold.map(p => p.client_id)).size,
    unitsSold,
    unitsPaidOff: sum(sold.filter(p => p.payment_status === 'fully_paid'), 'units'),
    unitsPending: sum(mine.filter(p => p.payment_status === 'pending'), 'units'),
    available: Math.max(0, Number(property.total_units) - unitsSold),
    salesValue: sum(sold, 'total_price'),
    collected: sum(sold, 'amount_paid'),
    outstanding: sum(sold, 'balance'),
    behind: sold.filter(p => ['owing', 'defaulting'].includes(p.payment_status)).length,
    rows: mine,
  }
}

export default function Properties() {
  const { org, can } = useOrg()
  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('manageProperties')) return null
    const [properties, purchases] = await Promise.all([listProperties(org.id), listPurchases(org.id)])
    return { properties, purchases }
  }, [org.id])

  if (!can('manageProperties')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  return (
    <div>
      <PageHeader subtitle="Each property's units, prices and sales progress."
        actions={<Link to="/app/properties/new" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg">+ New property</Link>} />
      {data.properties.length === 0 ? (
        <Card><EmptyState icon="🏘️" title="No properties yet" action={<Link to="/app/properties/new" className="text-sm text-blue-400 hover:underline">Add your first property →</Link>}>
          Set up each estate or development once: location, number of units, and prices for each payment plan.
        </EmptyState></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.properties.map(p => {
            const inv = inventory(p, data.purchases)
            const [label, variant] = STATUS[p.status]
            return (
              <Link key={p.id} to={`/app/properties/${p.id}`} className="block bg-navy2 border border-white/8 hover:border-blue-600/30 rounded-xl p-5 transition-colors">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-bold">{p.name}</h3>
                  <Badge variant={variant}>{label}</Badge>
                </div>
                <p className="text-xs text-slate-400 mb-4">{p.code} · {p.location || 'No location set'}</p>
                <Progress value={inv.unitsSold} max={Number(p.total_units)} className="mb-1.5" />
                <p className="text-xs text-slate-400 mb-4">
                  <strong className="text-white">{inv.unitsSold}</strong> of {Number(p.total_units)} {unitLabel(p.unit_type, p.total_units)} sold · {inv.available} available
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Clients" value={inv.clients} />
                  <Mini label="Collected" value={nairaShort(inv.collected)} />
                  <Mini label="Outstanding" value={nairaShort(inv.outstanding)} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Mini({ label, value }) {
  return <div className="bg-white/3 rounded-lg py-2"><p className="text-sm font-bold">{value}</p><p className="text-[11px] text-slate-500">{label}</p></div>
}

export function PropertyDetail() {
  const { id } = useParams()
  const { org, can } = useOrg()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('manageProperties')) return null
    const [property, purchases] = await Promise.all([getProperty(id), listPurchases(org.id)])
    return { property, purchases }
  }, [id, org.id])

  if (!can('manageProperties')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const { property: p, purchases } = data
  if (editing) return <PropertyForm property={p} onSaved={() => { setEditing(false); reload() }} onCancel={() => setEditing(false)} />

  const inv = inventory(p, purchases)
  const plans = [...p.payment_plans].sort((a, b) => a.duration_months - b.duration_months)
  const [label, variant] = STATUS[p.status]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-bold">{p.name}</h2><Badge variant={variant}>{label}</Badge></div>
          <p className="text-sm text-slate-400">Code {p.code} · {p.location || 'No location set'}{p.unit_size_sqm ? ` · ${Number(p.unit_size_sqm)} sqm per ${p.unit_type}` : ''}</p>
          {p.description && <p className="text-sm text-slate-300 mt-2 max-w-2xl">{p.description}</p>}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit property</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Units sold" value={`${inv.unitsSold} / ${Number(p.total_units)}`} sub={`${inv.available} available · ${inv.unitsPaidOff} fully paid`} />
        <StatCard label="Clients" value={inv.clients} sub={inv.unitsPending ? `${inv.unitsPending} unit(s) awaiting confirmation` : 'buying here'} />
        <StatCard label="Collected" value={nairaShort(inv.collected)} sub={`of ${nairaShort(inv.salesValue)} sold`} tone="up" />
        <StatCard label="Outstanding" value={nairaShort(inv.outstanding)} sub={`${inv.behind} client(s) behind`} tone={inv.behind ? 'warn' : 'neutral'} />
      </div>

      <Card title="Payment plans">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map(pl => (
            <div key={pl.id} className={`p-4 rounded-lg border ${pl.is_active ? 'border-white/10 bg-white/3' : 'border-white/5 opacity-50'}`}>
              <p className="text-sm font-semibold">{pl.name}{!pl.is_active && ' (hidden)'}</p>
              <p className="text-lg font-black">{naira(pl.price_per_unit)}<span className="text-xs text-slate-400 font-normal"> / {p.unit_type}</span></p>
              <p className="text-xs text-slate-400">{pl.duration_months ? `${Number(pl.min_deposit_percent)}% deposit, then ${pl.duration_months} monthly instalments` : 'Paid in full'}</p>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-bold mb-3">Clients in {p.name}</h3>
        {inv.rows.length === 0 ? <Card><p className="text-sm text-slate-400 text-center py-4">No clients yet.</p></Card> : (
          <Table headers={['Client', 'Client no.', 'Units', 'Plot', 'Paid', 'Balance', 'Status']}>
            {inv.rows.map(r => (
              <tr key={r.id} className="hover:bg-white/3 cursor-pointer" onClick={() => navigate(`/app/clients/${r.client_id}`)}>
                <Td className="font-semibold">{r.client_name}</Td>
                <Td className="font-mono text-xs">{r.client_number || '—'}</Td>
                <Td>{Number(r.units)}</Td>
                <Td className="text-slate-300">{r.plot_numbers || '—'}</Td>
                <Td className="text-green-400">{naira(r.amount_paid)}</Td>
                <Td className={Number(r.balance) > 0 ? 'text-amber-400' : 'text-slate-400'}>{naira(r.balance)}</Td>
                <Td><StatusBadge status={r.payment_status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  )
}

export function NewProperty() {
  const { can } = useOrg()
  const navigate = useNavigate()
  if (!can('manageProperties')) return <Navigate to="/app" replace />
  return <PropertyForm onSaved={p => navigate(`/app/properties/${p.id}`, { replace: true })} onCancel={() => navigate(-1)} />
}

const blankPlan = (name = '', months = 0) => ({ name, duration_months: String(months), price_per_unit: '', min_deposit_percent: months ? '30' : '0', is_active: true })

function PropertyForm({ property, onSaved, onCancel }) {
  const { org } = useOrg()
  const [value, setValue] = useState(() => property
    ? Object.fromEntries(Object.entries(property).map(([k, v]) => [k, v ?? '']))
    : { name: '', code: '', location: '', description: '', unit_type: 'plot', unit_size_sqm: '', total_units: '', status: 'active', bank_name: '', account_name: '', account_number: '' })
  const [plans, setPlans] = useState(() => property
    ? [...property.payment_plans].sort((a, b) => a.duration_months - b.duration_months).map(p => ({ ...p, duration_months: String(p.duration_months), price_per_unit: String(p.price_per_unit), min_deposit_percent: String(p.min_deposit_percent) }))
    : [blankPlan('Outright', 0), blankPlan('6 months', 6), blankPlan('12 months', 12)])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setValue({ ...value, [k]: e.target.value })
  const setPlan = (i, k, v) => setPlans(plans.map((p, j) => j === i ? { ...p, [k]: v } : p))

  const save = async () => {
    setError('')
    if (value.name.trim().length < 2) return setError('Please enter the property name.')
    if (!/^[A-Za-z0-9]{1,6}$/.test(value.code.trim())) return setError('The property code should be 1–6 letters or numbers, e.g. NA for Nest Apartments.')
    const usable = plans.filter(p => p.id || p.price_per_unit)
    if (!usable.some(p => p.is_active !== false && Number(p.price_per_unit) > 0)) return setError('Add a price for at least one payment plan.')
    for (const p of usable) {
      if (!p.name.trim()) return setError('Every payment plan needs a name.')
      if (!(Number(p.price_per_unit) > 0)) return setError(`Enter a price for the "${p.name}" plan.`)
    }
    setBusy(true)
    try { onSaved(await saveProperty(org.id, value, usable)) }
    catch (e) { setError(e.message.includes('properties_org_id_code_key') ? 'Another property already uses that code.' : e.message); setBusy(false) }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Card title="Property details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Property name" required value={value.name} onChange={set('name')} placeholder="e.g. Nest Apartments" />
          <Input label="Property code" required value={value.code} onChange={e => setValue({ ...value, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
            placeholder="e.g. NA" hint={`Client numbers will look like ${org.client_prefix}-${value.code || 'NA'}-001`} disabled={!!property} />
          <Input label="Location" className="sm:col-span-2" value={value.location} onChange={set('location')} placeholder="e.g. KM 35, Iseyin Road, Oyo State" />
          <Textarea label="Description" className="sm:col-span-2" value={value.description} onChange={set('description')} />
          <Select label="Sold as" value={value.unit_type} onChange={set('unit_type')}>
            {Object.keys(UNIT_LABELS).map(u => <option key={u} value={u}>{UNIT_LABELS[u][1]}</option>)}
          </Select>
          <Input label={`Total ${UNIT_LABELS[value.unit_type][1]} available`} type="number" min="0" step="any" value={value.total_units} onChange={set('total_units')} placeholder="e.g. 100" />
          <Input label="Size per unit (sqm)" type="number" min="0" step="any" value={value.unit_size_sqm} onChange={set('unit_size_sqm')} placeholder="e.g. 500" />
          <Select label="Status" value={value.status} onChange={set('status')} hint="Only pre-launch and selling properties appear on client forms">
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
      </Card>

      <Card title="Payment plans and prices">
        <p className="text-sm text-slate-400 mb-4">Price per {value.unit_type} for each plan. Clients pay the deposit first, then equal monthly instalments.</p>
        <div className="space-y-3">
          {plans.map((p, i) => (
            <div key={p.id || i} className="grid grid-cols-2 sm:grid-cols-[1.2fr_0.8fr_1.3fr_0.8fr_auto] gap-2.5 items-end p-3 rounded-lg bg-white/3 border border-white/5">
              <Input label="Plan name" value={p.name} onChange={e => setPlan(i, 'name', e.target.value)} />
              <Input label="Months" type="number" min="0" max="120" value={p.duration_months} onChange={e => setPlan(i, 'duration_months', e.target.value)} hint="0 = outright" />
              <Input label={`Price / ${value.unit_type} (₦)`} type="number" min="0" step="any" value={p.price_per_unit} onChange={e => setPlan(i, 'price_per_unit', e.target.value)} />
              <Input label="Deposit %" type="number" min="0" max="100" value={p.min_deposit_percent} onChange={e => setPlan(i, 'min_deposit_percent', e.target.value)} />
              {p.id
                ? <label className="flex items-center gap-1.5 text-xs text-slate-400 pb-3 cursor-pointer"><input type="checkbox" className="accent-blue-500" checked={p.is_active !== false} onChange={e => setPlan(i, 'is_active', e.target.checked)} /> On sale</label>
                : <button onClick={() => setPlans(plans.filter((_, j) => j !== i))} className="text-xs text-slate-400 hover:text-red-300 pb-3">Remove</button>}
            </div>
          ))}
        </div>
        <button onClick={() => setPlans([...plans, blankPlan()])} className="mt-3 text-sm text-blue-400 hover:underline">+ Add a plan</button>
        {property && <p className="text-xs text-slate-500 mt-3">Price changes only apply to new purchases. Existing clients keep the price they signed up at.</p>}
      </Card>

      <Card title="Bank account for this property (optional)">
        <p className="text-sm text-slate-400 mb-4">Leave blank to use the company account from Settings.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Bank" value={value.bank_name} onChange={set('bank_name')} />
          <Input label="Account name" value={value.account_name} onChange={set('account_name')} />
          <Input label="Account number" value={value.account_number} onChange={set('account_number')} inputMode="numeric" />
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2.5 pb-8">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={busy} onClick={save}>{property ? 'Save changes' : 'Create property'}</Button>
      </div>
    </div>
  )
}
