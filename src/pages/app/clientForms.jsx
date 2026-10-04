import { useState } from 'react'
import { useOrg } from '../../hooks/useOrg.jsx'
import { recordPayment, confirmPayment, uploadProof, updatePurchase } from '../../lib/api'
import { naira, isoDate } from '../../lib/format'
import { Alert, Modal } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Input'

export const ID_TYPES = ['NIN', 'International passport', "Driver's licence", "Voter's card", 'Other']
export const TITLES = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Chief', 'Engr.', 'Prof.', 'Pastor', 'Alhaji', 'Alhaja', 'Barr.']

export const emptyClient = {
  title: '', full_name: '', email: '', phone: '', address: '', occupation: '', date_of_birth: '',
  id_type: '', id_number: '', next_of_kin_name: '', next_of_kin_phone: '', next_of_kin_relationship: '', notes: '',
}

export function cleanClient(c) {
  const out = {}
  for (const k of Object.keys(emptyClient)) {
    const v = typeof c[k] === 'string' ? c[k].trim() : c[k]
    out[k] = v === '' ? null : v
  }
  if (out.email) out.email = out.email.toLowerCase()
  return out
}

export function ClientFields({ value, onChange }) {
  const set = k => e => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 grid grid-cols-[110px_1fr] gap-3">
        <Select label="Title" value={value.title || ''} onChange={set('title')}>
          <option value="">—</option>
          {TITLES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Input label="Full name" required value={value.full_name} onChange={set('full_name')} placeholder="e.g. Adaeze Nwankwo" />
      </div>
      <Input label="Email" type="email" value={value.email} onChange={set('email')} placeholder="client@email.com" hint="Documents and reminders go here" />
      <Input label="Phone" type="tel" value={value.phone} onChange={set('phone')} placeholder="0803 000 0000" />
      <Input label="Address" className="sm:col-span-2" value={value.address} onChange={set('address')} />
      <Input label="Occupation" value={value.occupation} onChange={set('occupation')} />
      <Input label="Date of birth" type="date" value={value.date_of_birth || ''} onChange={set('date_of_birth')} />
      <Select label="ID type" value={value.id_type || ''} onChange={set('id_type')}>
        <option value="">Select…</option>
        {ID_TYPES.map(t => <option key={t}>{t}</option>)}
      </Select>
      <Input label="ID number" value={value.id_number} onChange={set('id_number')} />
      <Input label="Next of kin" value={value.next_of_kin_name} onChange={set('next_of_kin_name')} placeholder="Full name" />
      <Input label="Next of kin phone" type="tel" value={value.next_of_kin_phone} onChange={set('next_of_kin_phone')} />
      <Input label="Relationship" value={value.next_of_kin_relationship} onChange={set('next_of_kin_relationship')} placeholder="e.g. Spouse" />
      <Textarea label="Internal notes" className="sm:col-span-2" value={value.notes || ''} onChange={set('notes')} hint="Only your team sees this" />
    </div>
  )
}

// Property + plan + units, with the price worked out live
export function PurchaseFields({ properties, value, onChange }) {
  const set = k => e => onChange({ ...value, [k]: e.target.value })
  const property = properties.find(p => p.id === value.property_id)
  const plans = (property?.payment_plans || []).filter(p => p.is_active).sort((a, b) => a.duration_months - b.duration_months)
  const plan = plans.find(p => p.id === value.payment_plan_id)
  const total = plan ? Number(plan.price_per_unit) * Number(value.units || 0) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Select label="Property" required value={value.property_id} onChange={e => onChange({ ...value, property_id: e.target.value, payment_plan_id: '' })}>
        <option value="">Select a property…</option>
        {properties.filter(p => p.status !== 'archived').map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
      </Select>
      <Select label="Payment plan" required value={value.payment_plan_id} onChange={set('payment_plan_id')} disabled={!property}>
        <option value="">{property ? 'Select a plan…' : 'Choose a property first'}</option>
        {plans.map(p => <option key={p.id} value={p.id}>{p.name} · {naira(p.price_per_unit)}/{property.unit_type}</option>)}
      </Select>
      <Input label={`Number of ${property?.unit_type || 'unit'}s`} type="number" min="0.01" step="any" required value={value.units} onChange={set('units')} />
      <Input label="Purchase date" type="date" required value={value.start_date} onChange={set('start_date')} hint="Instalments are due monthly from this date" />
      <Input label="Realtor name" value={value.realtor_name} onChange={set('realtor_name')} />
      <Input label="Realtor email" type="email" value={value.realtor_email} onChange={set('realtor_email')} hint="Copied on emails to this client" />
      <Input label="Realtor phone" type="tel" value={value.realtor_phone} onChange={set('realtor_phone')} />
      {plan && (
        <div className="sm:col-span-2 bg-blue-600/8 border border-blue-600/20 rounded-lg p-3.5 text-sm">
          Total price: <strong>{naira(total)}</strong>
          {plan.duration_months > 0 && <span className="text-slate-400">
            {' '}· {Number(plan.min_deposit_percent)}% deposit ({naira(total * plan.min_deposit_percent / 100)}), then {plan.duration_months} monthly instalments of {naira((total - total * plan.min_deposit_percent / 100) / plan.duration_months)}
          </span>}
        </div>
      )}
    </div>
  )
}

export const emptyPurchase = () => ({
  property_id: '', payment_plan_id: '', units: '1', start_date: isoDate(),
  realtor_name: '', realtor_email: '', realtor_phone: '',
})

export function purchaseRow(orgId, clientId, properties, p) {
  const property = properties.find(x => x.id === p.property_id)
  const plan = property?.payment_plans?.find(x => x.id === p.payment_plan_id)
  if (!plan) throw new Error('Please choose a property and payment plan.')
  if (!(Number(p.units) > 0)) throw new Error('Please enter how many units were bought.')
  return {
    org_id: orgId, client_id: clientId, property_id: property.id, payment_plan_id: plan.id,
    units: Number(p.units), plan_name: plan.name, duration_months: plan.duration_months,
    unit_price: plan.price_per_unit, min_deposit_percent: plan.min_deposit_percent, start_date: p.start_date,
    realtor_name: p.realtor_name.trim() || null, realtor_email: p.realtor_email.trim().toLowerCase() || null,
    realtor_phone: p.realtor_phone.trim() || null,
  }
}

export const emptyPayment = () => ({ amount: '', paid_on: isoDate(), method: 'bank_transfer', payer_name: '', bank_reference: '', notes: '', file: null, confirm: false })

export function PaymentFields({ value, onChange, canConfirm }) {
  const set = k => e => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input label="Amount (₦)" type="number" min="1" step="any" required value={value.amount} onChange={set('amount')} />
      <Input label="Date paid" type="date" required value={value.paid_on} onChange={set('paid_on')} />
      <Select label="Method" value={value.method} onChange={set('method')}>
        <option value="bank_transfer">Bank transfer</option>
        <option value="cash">Cash</option>
        <option value="cheque">Cheque</option>
        <option value="pos">POS</option>
        <option value="other">Other</option>
      </Select>
      <Input label="Bank reference" value={value.bank_reference} onChange={set('bank_reference')} />
      <Input label="Payer name" value={value.payer_name} onChange={set('payer_name')} hint="If someone else paid" />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Proof of payment</label>
        <input type="file" accept="image/*,application/pdf" onChange={e => onChange({ ...value, file: e.target.files?.[0] || null })}
          className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-sm" />
      </div>
      <Textarea label="Notes" className="sm:col-span-2" rows={2} value={value.notes} onChange={set('notes')} />
      {canConfirm && (
        <label className="sm:col-span-2 flex items-start gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-500" checked={value.confirm} onChange={e => onChange({ ...value, confirm: e.target.checked })} />
          <span>I've checked this against the bank statement. <strong>Confirm it now.</strong>
            <span className="block text-xs text-slate-500">Otherwise it waits in Payments for a team lead.</span></span>
        </label>
      )}
    </div>
  )
}

export async function savePayment(orgId, subscriptionId, p) {
  if (!(Number(p.amount) > 0)) throw new Error('Please enter the amount paid.')
  const proof_path = p.file ? await uploadProof(orgId, p.file) : null
  const row = await recordPayment({
    org_id: orgId, subscription_id: subscriptionId, amount: Number(p.amount), paid_on: p.paid_on, method: p.method,
    payer_name: p.payer_name.trim() || null, bank_reference: p.bank_reference.trim() || null,
    notes: p.notes.trim() || null, proof_path, source: 'manual',
  })
  if (p.confirm) return { payment: row, receipt: await confirmPayment(row.id) }
  return { payment: row }
}

export function RecordPaymentModal({ purchase, onClose, onSaved }) {
  const { org, can } = useOrg()
  const [value, setValue] = useState(emptyPayment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!purchase) return null

  const save = async () => {
    setBusy(true); setError('')
    try { await savePayment(org.id, purchase.id, value); setValue(emptyPayment()); onSaved() }
    catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <Modal isOpen wide onClose={onClose} title="Record a payment"
      subtitle={`${purchase.property_name} · ${purchase.client_number || 'awaiting first confirmation'} · balance ${naira(purchase.balance)}`}>
      <PaymentFields value={value} onChange={setValue} canConfirm={can('confirmPayments')} />
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Save payment</Button>
      </div>
    </Modal>
  )
}

// Team leads: plot numbers, discounts, cancellation
export function EditPurchaseModal({ purchase, onClose, onSaved }) {
  const [value, setValue] = useState(() => purchase && ({
    plot_numbers: purchase.plot_numbers || '', discount_amount: String(Number(purchase.discount_amount) || ''),
    discount_reason: purchase.discount_reason || '', start_date: purchase.start_date,
    realtor_name: purchase.realtor_name || '', realtor_email: purchase.realtor_email || '', realtor_phone: purchase.realtor_phone || '',
    status: purchase.status,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!purchase || !value) return null
  const set = k => e => setValue({ ...value, [k]: e.target.value })
  const gross = Number(purchase.units) * Number(purchase.unit_price)

  const save = async () => {
    const discount = Number(value.discount_amount || 0)
    if (discount < 0 || discount > gross) return setError(`Discount must be between ₦0 and ${naira(gross)}.`)
    if (discount > 0 && !value.discount_reason.trim()) return setError('Please give a reason for the discount.')
    setBusy(true); setError('')
    try {
      await updatePurchase(purchase.id, {
        plot_numbers: value.plot_numbers.trim() || null, discount_amount: discount,
        discount_reason: discount > 0 ? value.discount_reason.trim() : null, start_date: value.start_date,
        realtor_name: value.realtor_name.trim() || null, realtor_email: value.realtor_email.trim().toLowerCase() || null,
        realtor_phone: value.realtor_phone.trim() || null, status: value.status,
      })
      onSaved()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <Modal isOpen wide onClose={onClose} title="Edit purchase" subtitle={`${purchase.property_name} · ${purchase.plan_name} · ${Number(purchase.units)} × ${naira(purchase.unit_price)} = ${naira(gross)}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Plot / unit numbers" className="sm:col-span-2" value={value.plot_numbers} onChange={set('plot_numbers')} placeholder="e.g. Block C, Plots 14–15" />
        <Input label="Special discount (₦)" type="number" min="0" step="any" value={value.discount_amount} onChange={set('discount_amount')} hint={`New total: ${naira(gross - Number(value.discount_amount || 0))}`} />
        <Input label="Reason for discount" value={value.discount_reason} onChange={set('discount_reason')} placeholder="e.g. Loyal client, MD approved" />
        <Input label="Purchase date" type="date" value={value.start_date} onChange={set('start_date')} />
        <Select label="Status" value={value.status} onChange={set('status')}>
          <option value="pending" disabled={purchase.status !== 'pending'}>Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Input label="Realtor name" value={value.realtor_name} onChange={set('realtor_name')} />
        <Input label="Realtor email" type="email" value={value.realtor_email} onChange={set('realtor_email')} />
        <Input label="Realtor phone" type="tel" value={value.realtor_phone} onChange={set('realtor_phone')} />
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="flex gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" loading={busy} onClick={save}>Save changes</Button>
      </div>
    </Modal>
  )
}
