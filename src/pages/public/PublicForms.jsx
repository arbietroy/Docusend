import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getPublicForm, submitSubscriptionForm, submitPaymentForm, uploadProof } from '../../lib/api'
import { naira, isoDate, initials, unitLabel } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Badge'
import { Loading } from '../../components/ui/Data'
import { ID_TYPES, TITLES } from '../app/clientForms'

function Shell({ company, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-navy">
      <div className="h-1.5" style={{ background: company?.brand_color || '#2563EB' }} />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {company && (
          <div className="flex items-center gap-3 mb-8">
            {company.logo_url
              ? <img src={company.logo_url} alt="" className="w-12 h-12 rounded-xl object-contain bg-white/5" />
              : <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black" style={{ background: company.brand_color }}>{initials(company.name)}</div>}
            <div>
              <p className="font-bold text-lg leading-tight">{company.name}</p>
              {(company.phone || company.contact_email) && <p className="text-xs text-slate-400">{[company.phone, company.contact_email].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>
        )}
        {title && <h1 className="text-2xl sm:text-3xl font-black mb-2">{title}</h1>}
        {subtitle && <p className="text-sm text-slate-400 mb-8 leading-relaxed">{subtitle}</p>}
        {children}
        <p className="text-center text-xs text-slate-600 mt-12">Secured by DocuSend</p>
      </div>
    </div>
  )
}

function Section({ n, title, children }) {
  return (
    <section className="bg-navy2 border border-white/8 rounded-xl p-4 sm:p-6 mb-4">
      <h2 className="text-sm font-bold mb-4"><span className="text-slate-500 mr-2">{n}.</span>{title}</h2>
      {children}
    </section>
  )
}

function BankBox({ bank }) {
  if (!bank?.account_number) return null
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 text-sm">
      <p className="text-xs text-slate-400 mb-1">Pay by bank transfer to</p>
      <p className="font-bold text-lg tracking-wide">{bank.account_number}</p>
      <p>{bank.account_name}</p>
      <p className="text-slate-400">{bank.bank_name}</p>
    </div>
  )
}

function ProofInput({ file, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label className="text-sm font-medium">Proof of payment <span className="text-red-400">*</span></label>
      <label className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-white/20 hover:border-white/40 cursor-pointer">
        <span className="text-2xl">📎</span>
        <span className="text-sm text-slate-300 min-w-0 truncate">{file ? file.name : 'Upload a screenshot or PDF of your transfer receipt'}</span>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
      </label>
      <p className="text-xs text-slate-500">Image or PDF, up to 10MB</p>
    </div>
  )
}

function useCompany() {
  const { slug } = useParams()
  const state = useAsync(() => getPublicForm(slug), [slug])
  return { slug, ...state }
}

function NotFound() {
  return <Shell title="Form not found" subtitle="This link may be mistyped, or the company may have changed its address. Please ask them for a new link." />
}

function Done({ company, title, children }) {
  return (
    <Shell company={company}>
      <div className="text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-black mb-3">{title}</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">{children}</p>
      </div>
    </Shell>
  )
}

const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

// ── New purchase ──
export function SubscribeForm() {
  const { slug, data: company, loading, error } = useCompany()
  const [v, setV] = useState({
    title: '', full_name: '', email: '', phone: '', address: '', occupation: '', date_of_birth: '', id_type: '', id_number: '',
    next_of_kin_name: '', next_of_kin_phone: '', next_of_kin_relationship: '',
    property_id: '', payment_plan_id: '', units: '1', realtor_name: '', realtor_email: '', realtor_phone: '',
    amount: '', paid_on: isoDate(), payer_name: '', bank_reference: '', notes: '',
  })
  const [noRealtor, setNoRealtor] = useState(false)
  const [file, setFile] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  if (loading) return <Loading />
  if (error || !company) return <NotFound />
  if (done) return <Done company={company} title="Thank you! We've received your details">
    {company.name} will check your payment and email your documents to <strong className="text-white">{v.email}</strong> once it's confirmed.
  </Done>
  if (!company.properties.length) return <Shell company={company} title="Subscription form" subtitle="There are no properties open for subscription right now. Please contact us." />

  const set = k => e => setV({ ...v, [k]: e.target.value })
  const property = company.properties.find(p => p.id === v.property_id)
  const plan = property?.plans.find(p => p.id === v.payment_plan_id)
  const total = plan ? plan.price_per_unit * Number(v.units || 0) : 0
  const deposit = plan ? total * plan.min_deposit_percent / 100 : 0
  const bank = property?.account_number ? property : company

  const submit = async () => {
    setErr('')
    if (v.full_name.trim().length < 2) return setErr('Please enter your full name.')
    if (!validEmail(v.email)) return setErr('Please enter a valid email address. Your documents will be sent there.')
    if (v.phone.replace(/\D/g, '').length < 7) return setErr('Please enter your phone number.')
    if (!plan) return setErr('Please choose a property and payment plan.')
    if (!(Number(v.units) > 0)) return setErr('Please enter how many units you are buying.')
    if (!noRealtor && v.realtor_email && !validEmail(v.realtor_email)) return setErr("Please check your realtor's email address.")
    if (!(Number(v.amount) > 0)) return setErr('Please enter the amount you paid.')
    if (!file) return setErr('Please upload your proof of payment.')
    if (file.size > 10 * 1024 * 1024) return setErr('Your proof of payment must be under 10MB.')
    if (!agreed) return setErr('Please confirm the declaration at the bottom of the form.')
    setBusy(true)
    try {
      const proof_path = await uploadProof(company.org_id, file)
      await submitSubscriptionForm(slug, {
        ...v, units: Number(v.units), amount: Number(v.amount), proof_path,
        ...(noRealtor ? { realtor_name: '', realtor_email: '', realtor_phone: '' } : {}),
      })
      setDone(true); window.scrollTo(0, 0)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Shell company={company} title="Subscription form" subtitle="Fill this form after making your payment. Fields marked * are required.">
      <Section n={1} title="Your details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 grid grid-cols-[110px_1fr] gap-3">
            <Select label="Title" value={v.title} onChange={set('title')}>
              <option value="">—</option>
              {TITLES.map(t => <option key={t}>{t}</option>)}
            </Select>
            <Input label="Full name" required value={v.full_name} onChange={set('full_name')} placeholder="As it should appear on your documents" />
          </div>
          <Input label="Email" required type="email" value={v.email} onChange={set('email')} hint="Your documents will be sent here" />
          <Input label="Phone" required type="tel" value={v.phone} onChange={set('phone')} />
          <Input label="Home address" className="sm:col-span-2" value={v.address} onChange={set('address')} />
          <Input label="Occupation" value={v.occupation} onChange={set('occupation')} />
          <Input label="Date of birth" type="date" value={v.date_of_birth} onChange={set('date_of_birth')} />
          <Select label="Means of ID" value={v.id_type} onChange={set('id_type')}>
            <option value="">Select…</option>
            {ID_TYPES.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Input label="ID number" value={v.id_number} onChange={set('id_number')} />
        </div>
      </Section>

      <Section n={2} title="Next of kin">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Full name" value={v.next_of_kin_name} onChange={set('next_of_kin_name')} />
          <Input label="Phone" type="tel" value={v.next_of_kin_phone} onChange={set('next_of_kin_phone')} />
          <Input label="Relationship" value={v.next_of_kin_relationship} onChange={set('next_of_kin_relationship')} placeholder="e.g. Spouse" />
        </div>
      </Section>

      <Section n={3} title="What you're buying">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Property" required className="sm:col-span-2" value={v.property_id} onChange={e => setV({ ...v, property_id: e.target.value, payment_plan_id: '' })}>
            <option value="">Select a property…</option>
            {company.properties.map(p => <option key={p.id} value={p.id}>{p.name}{p.location ? ` · ${p.location}` : ''}</option>)}
          </Select>
          {property && (
            <Select label="Payment plan" required value={v.payment_plan_id} onChange={set('payment_plan_id')}>
              <option value="">Select a plan…</option>
              {property.plans.map(p => <option key={p.id} value={p.id}>{p.name} · {naira(p.price_per_unit)} per {property.unit_type}</option>)}
            </Select>
          )}
          {property && <Input label={`Number of ${unitLabel(property.unit_type, 2)}`} required type="number" min="1" step="any" value={v.units} onChange={set('units')}
            hint={property.unit_size_sqm ? `${Number(property.unit_size_sqm)} sqm each` : undefined} />}
          {plan && (
            <div className="sm:col-span-2 bg-blue-600/10 border border-blue-600/25 rounded-lg p-4 text-sm">
              <p>Total: <strong className="text-lg">{naira(total)}</strong></p>
              {plan.duration_months > 0
                ? <p className="text-slate-300 mt-1">Pay at least <strong>{naira(deposit)}</strong> now ({Number(plan.min_deposit_percent)}% deposit), then {plan.duration_months} monthly payments of about {naira((total - deposit) / plan.duration_months)}.</p>
                : <p className="text-slate-300 mt-1">Paid in full.</p>}
            </div>
          )}
        </div>
      </Section>

      <Section n={4} title="Your realtor">
        <label className="flex items-center gap-2.5 text-sm mb-4 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={noRealtor} onChange={e => setNoRealtor(e.target.checked)} />
          I wasn't referred by a realtor
        </label>
        {!noRealtor && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Realtor's name" value={v.realtor_name} onChange={set('realtor_name')} />
            <Input label="Realtor's email" type="email" value={v.realtor_email} onChange={set('realtor_email')} hint="They'll be copied on your documents" />
            <Input label="Realtor's phone" type="tel" value={v.realtor_phone} onChange={set('realtor_phone')} />
          </div>
        )}
      </Section>

      <Section n={5} title="Your payment">
        <BankBox bank={bank} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Amount paid (₦)" required type="number" min="1" step="any" value={v.amount} onChange={set('amount')} />
          <Input label="Date of payment" required type="date" value={v.paid_on} onChange={set('paid_on')} />
          <Input label="Name on the paying account" value={v.payer_name} onChange={set('payer_name')} hint="If different from yours" />
          <Input label="Transaction reference" value={v.bank_reference} onChange={set('bank_reference')} />
          <ProofInput file={file} onChange={setFile} />
          <Textarea label="Anything else we should know?" className="sm:col-span-2" rows={2} value={v.notes} onChange={set('notes')} />
        </div>
      </Section>

      <label className="flex items-start gap-3 text-sm text-slate-300 mb-5 cursor-pointer">
        <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-500" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
        I confirm that the information I've given is correct, and I agree to {company.name}'s terms of sale for this property.
      </label>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <Button className="w-full" size="lg" loading={busy} onClick={submit}>Submit</Button>
      <p className="text-center text-xs text-slate-500 mt-4">Already a client? <Link to={`/f/${slug}/pay`} className="text-blue-400 hover:underline">Submit an instalment payment instead</Link></p>
    </Shell>
  )
}

// ── Instalment ──
export function PayForm() {
  const { slug, data: company, loading, error } = useCompany()
  const [v, setV] = useState({ client_number: '', contact: '', amount: '', paid_on: isoDate(), payer_name: '', bank_reference: '', notes: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)

  if (loading) return <Loading />
  if (error || !company) return <NotFound />
  if (done) return <Done company={company} title={`Thank you, ${done.split(' ')[0]}!`}>
    We've received your payment details. {company.name} will confirm it and send your receipt by email.
  </Done>

  const set = k => e => setV({ ...v, [k]: e.target.value })
  const submit = async () => {
    setErr('')
    if (!v.client_number.trim()) return setErr('Please enter your client number. It is on your receipts and documents.')
    if (!v.contact.trim()) return setErr('Please enter the email or phone number you registered with.')
    if (!(Number(v.amount) > 0)) return setErr('Please enter the amount you paid.')
    if (!file) return setErr('Please upload your proof of payment.')
    if (file.size > 10 * 1024 * 1024) return setErr('Your proof of payment must be under 10MB.')
    setBusy(true)
    try {
      const proof_path = await uploadProof(company.org_id, file)
      const res = await submitPaymentForm(slug, { ...v, amount: Number(v.amount), proof_path })
      setDone(res.client_name); window.scrollTo(0, 0)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Shell company={company} title="Instalment payment" subtitle="Already a client? Tell us about your latest payment and we'll update your balance.">
      <Section n={1} title="Find your account">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Client number" required value={v.client_number} onChange={set('client_number')} placeholder="e.g. LNH-NA-012" />
          <Input label="Email or phone you registered with" required value={v.contact} onChange={set('contact')} />
        </div>
      </Section>
      <Section n={2} title="Your payment">
        <BankBox bank={company} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Amount paid (₦)" required type="number" min="1" step="any" value={v.amount} onChange={set('amount')} />
          <Input label="Date of payment" required type="date" value={v.paid_on} onChange={set('paid_on')} />
          <Input label="Name on the paying account" value={v.payer_name} onChange={set('payer_name')} />
          <Input label="Transaction reference" value={v.bank_reference} onChange={set('bank_reference')} />
          <ProofInput file={file} onChange={setFile} />
          <Textarea label="Notes" className="sm:col-span-2" rows={2} value={v.notes} onChange={set('notes')} />
        </div>
      </Section>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <Button className="w-full" size="lg" loading={busy} onClick={submit}>Submit payment</Button>
      <p className="text-center text-xs text-slate-500 mt-4">New client? <Link to={`/f/${slug}`} className="text-blue-400 hover:underline">Fill the subscription form</Link></p>
    </Shell>
  )
}
