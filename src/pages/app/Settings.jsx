import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAuth } from '../../hooks/useAuth.jsx'
import { supabase, must } from '../../lib/supabase'
import { updateOrg, uploadLogo } from '../../lib/api'
import { ROLE_LABELS } from '../../lib/roles'
import { initials } from '../../lib/format'
import { Card, Tabs } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'

export default function Settings() {
  const { can } = useOrg()
  const [tab, setTab] = useState(can('companySettings') ? 'company' : 'profile')
  const tabs = [
    ...(can('companySettings') ? [{ id: 'company', label: 'Company' }] : []),
    { id: 'profile', label: 'My profile' },
    { id: 'security', label: 'Password & account' },
  ]
  return (
    <div className="max-w-3xl">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'company'  && <CompanySettings />}
      {tab === 'profile'  && <ProfileSettings />}
      {tab === 'security' && <SecuritySettings />}
    </div>
  )
}

function useSaver() {
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState({ msg: '', type: 'error' })
  const run = async (fn, okMsg = 'Saved.') => {
    setBusy(true); setAlert({ msg: '' })
    try { await fn(); setAlert({ msg: okMsg, type: 'success' }) }
    catch (e) { setAlert({ msg: e.message, type: 'error' }) }
    setBusy(false)
  }
  return { busy, alert, setAlert, run }
}

function CompanySettings() {
  const { org, refresh } = useOrg()
  const [v, setV] = useState(() => ({
    name: org.name, client_prefix: org.client_prefix, brand_color: org.brand_color,
    contact_email: org.contact_email || '', phone: org.phone || '', address: org.address || '',
    bank_name: org.bank_name || '', account_name: org.account_name || '', account_number: org.account_number || '',
    sender_name: org.sender_name || '', sender_email: org.sender_email || '', grace_days: String(org.grace_days),
  }))
  const { busy, alert, setAlert, run } = useSaver()
  const [logoBusy, setLogoBusy] = useState(false)
  const set = k => e => setV({ ...v, [k]: e.target.value })

  const save = () => {
    if (v.name.trim().length < 2) return setAlert({ msg: 'Enter the company name.', type: 'error' })
    if (!/^[A-Z0-9]{2,6}$/.test(v.client_prefix)) return setAlert({ msg: 'The company code should be 2–6 letters or numbers.', type: 'error' })
    run(async () => {
      const clean = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? (x.trim() || null) : x]))
      await updateOrg(org.id, { ...clean, name: v.name.trim(), grace_days: Number(v.grace_days || 30), brand_color: v.brand_color })
      await refresh()
    })
  }

  const onLogo = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setAlert({ msg: 'Logo must be under 2MB.', type: 'error' })
    setLogoBusy(true); setAlert({ msg: '' })
    try { await updateOrg(org.id, { logo_url: await uploadLogo(org.id, file) }); await refresh() }
    catch (err) { setAlert({ msg: err.message, type: 'error' }) }
    setLogoBusy(false)
  }

  return (
    <div className="space-y-5">
      <Card title="Brand">
        <p className="text-sm text-slate-400 mb-4">Your team and clients see your company name, logo and colour, not DocuSend's.</p>
        <div className="flex items-center gap-4 mb-4">
          {org.logo_url
            ? <img src={org.logo_url} alt="" className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10" />
            : <div className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-black" style={{ background: v.brand_color }}>{initials(v.name)}</div>}
          <label className="text-sm font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
            {logoBusy ? 'Uploading…' : org.logo_url ? 'Change logo' : 'Upload logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onLogo} disabled={logoBusy} />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Company name" value={v.name} onChange={set('name')} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Brand colour</label>
            <div className="flex gap-2">
              <input type="color" value={v.brand_color} onChange={set('brand_color')} className="w-12 h-[42px] rounded-lg bg-transparent border border-white/10 cursor-pointer" />
              <Input value={v.brand_color} onChange={set('brand_color')} className="flex-1" />
            </div>
          </div>
          <Input label="Company code" value={v.client_prefix} onChange={e => setV({ ...v, client_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
            hint={`Client numbers look like ${v.client_prefix || 'ABC'}-NA-001. Changing it only affects new clients.`} />
          <Input label="Web address" value={`/f/${org.slug}`} disabled hint="Used in your client form links" />
        </div>
      </Card>

      <Card title="Contact details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Contact email" type="email" value={v.contact_email} onChange={set('contact_email')} />
          <Input label="Phone" type="tel" value={v.phone} onChange={set('phone')} />
          <Textarea label="Address" className="sm:col-span-2" rows={2} value={v.address} onChange={set('address')} />
        </div>
      </Card>

      <Card title="Where clients pay">
        <p className="text-sm text-slate-400 mb-4">Shown on your client forms and in reminder emails. Each property can have its own account instead.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Bank" value={v.bank_name} onChange={set('bank_name')} />
          <Input label="Account name" value={v.account_name} onChange={set('account_name')} />
          <Input label="Account number" inputMode="numeric" value={v.account_number} onChange={set('account_number')} />
        </div>
      </Card>

      <Card title="Emails & arrears">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Send emails as (name)" value={v.sender_name} onChange={set('sender_name')} placeholder={v.name} />
          <Input label="Send emails from (address)" type="email" value={v.sender_email} onChange={set('sender_email')} placeholder="documents@yourcompany.com" hint="Used when in-app email sending launches" />
          <Input label="Grace period (days)" type="number" min="0" max="365" value={v.grace_days} onChange={set('grace_days')} hint="How late a payment can be before the client counts as defaulting" />
        </div>
      </Card>

      {alert.msg && <Alert variant={alert.type}>{alert.msg}</Alert>}
      <Button loading={busy} onClick={save}>Save company settings</Button>
    </div>
  )
}

function ProfileSettings() {
  const { org, member, role, refresh } = useOrg()
  const { user } = useAuth()
  const [name, setName] = useState(member?.full_name || '')
  const { busy, alert, run } = useSaver()
  const save = () => run(async () => {
    await must(supabase.from('members').update({ full_name: name.trim() || null }).eq('org_id', org.id).eq('user_id', user.id))
    await refresh()
  })
  return (
    <Card>
      <div className="flex flex-col gap-3 max-w-md">
        <Input label="Your name" value={name} onChange={e => setName(e.target.value)} hint="Shown to your team and in the activity log" />
        <Input label="Login email" value={user.email} disabled />
        <Input label={`Role at ${org.name}`} value={ROLE_LABELS[role]} disabled hint="An admin can change this on the Team page" />
        {alert.msg && <Alert variant={alert.type}>{alert.msg}</Alert>}
        <Button className="w-fit" loading={busy} onClick={save}>Save</Button>
      </div>
    </Card>
  )
}

function SecuritySettings() {
  const { user, signIn, updatePassword, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const hasPassword = user?.identities?.some(i => i.provider === 'email') ?? true
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const { busy, alert, setAlert, run } = useSaver()
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const change = () => {
    if (hasPassword && !current) return setAlert({ msg: 'Enter your current password.', type: 'error' })
    if (next.length < 8) return setAlert({ msg: 'New password must be at least 8 characters.', type: 'error' })
    if (next !== confirm) return setAlert({ msg: 'New passwords do not match.', type: 'error' })
    run(async () => {
      if (hasPassword) {
        const { error } = await signIn(user.email, current)
        if (error) throw new Error('Current password is incorrect.')
      }
      const { error } = await updatePassword(next)
      if (error) throw new Error(error.message)
      setCurrent(''); setNext(''); setConfirm('')
    }, 'Password updated.')
  }

  const remove = async () => {
    setDeleting(true); setDeleteError('')
    const { error } = await deleteAccount()
    setDeleting(false)
    if (error) return setDeleteError('Could not delete your account. Please try again or contact support.')
    navigate('/', { replace: true })
  }

  return (
    <div className="space-y-5">
      <Card title={hasPassword ? 'Change password' : 'Set a password'}>
        <div className="flex flex-col gap-3 max-w-sm">
          {hasPassword && <Input label="Current password" type="password" value={current} onChange={e => setCurrent(e.target.value)} />}
          <Input label="New password" type="password" placeholder="At least 8 characters" value={next} onChange={e => setNext(e.target.value)} />
          <Input label="Confirm new password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {alert.msg && <Alert variant={alert.type}>{alert.msg}</Alert>}
          <Button className="w-fit" loading={busy} onClick={change}>Update password</Button>
        </div>
      </Card>
      <Card title="Delete my account">
        <div className="flex flex-col gap-3 max-w-sm">
          <p className="text-sm text-slate-400">Removes your login and your access to every company. Company data stays with the company.</p>
          {deleteError && <Alert>{deleteError}</Alert>}
          <Input label="Type DELETE to confirm" value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} />
          <Button variant="danger" className="w-fit" loading={deleting} disabled={confirmDelete !== 'DELETE'} onClick={remove}>Delete my account</Button>
        </div>
      </Card>
    </div>
  )
}
