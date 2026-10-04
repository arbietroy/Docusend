import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useOrg } from '../hooks/useOrg.jsx'
import { useAsync } from '../hooks/useAsync'
import { createOrganization, myInvitations, acceptInvitation } from '../lib/api'
import { ROLE_LABELS } from '../lib/roles'
import { slugify } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Badge'
import { Loading } from '../components/ui/Data'

const suggestPrefix = name => {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(w => w && !['LTD', 'LIMITED', 'PLC', 'NIG', 'NIGERIA', 'THE', 'AND'].includes(w))
  if (!words.length) return ''
  return (words.length === 1 ? words[0].slice(0, 3) : words.map(w => w[0]).join('')).slice(0, 4)
}

export default function OnboardingPage() {
  const { user, businessName, signOut } = useAuth()
  const { org, refresh, switchOrg, loading: orgLoading } = useOrg()
  const navigate = useNavigate()
  const meta = user?.user_metadata || {}
  const [fullName, setFullName] = useState(meta.full_name || '')
  const [name, setName] = useState(businessName && businessName !== meta.full_name ? businessName : '')
  const [prefix, setPrefix] = useState(() => suggestPrefix(businessName || ''))
  const [slug, setSlug] = useState(() => slugify(businessName || ''))
  const [touched, setTouched] = useState({ prefix: false, slug: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: invites, loading } = useAsync(() => myInvitations(), [user?.id])

  if (orgLoading || loading) return <div className="min-h-screen bg-navy"><Loading /></div>
  if (org && !creating) return <Navigate to="/app" replace />

  const onName = v => {
    setName(v)
    if (!touched.prefix) setPrefix(suggestPrefix(v))
    if (!touched.slug) setSlug(slugify(v))
  }

  const create = async () => {
    setError('')
    if (fullName.trim().length < 2) return setError('Please enter your name.')
    if (name.trim().length < 2) return setError('Please enter your company name.')
    if (!/^[A-Z0-9]{2,6}$/.test(prefix)) return setError('The company code should be 2–6 letters or numbers.')
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) return setError('The web address should be 3–50 lowercase letters, numbers or dashes.')
    setBusy(true); setCreating(true)
    try {
      const id = await createOrganization({ name: name.trim(), slug, prefix, fullName })
      switchOrg(id)
      await refresh()
      navigate('/app', { replace: true })
    } catch (e) { setError(e.message); setCreating(false) }
    setBusy(false)
  }

  const join = async inv => {
    if (fullName.trim().length < 2) return setError('Please enter your name first.')
    setBusy(true); setError(''); setCreating(true)
    try {
      await acceptInvitation(inv.id, fullName)
      switchOrg(inv.org_id)
      await refresh()
      navigate('/app', { replace: true })
    } catch (e) { setError(e.message); setCreating(false) }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-navy flex items-start sm:items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="text-xl font-black mb-8">Docu<span className="text-blue-500">Send</span></p>

        <Input label="Your name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Oluwadamilola Ogunbanjo" className="mb-6" />

        {invites?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-black mb-1">You've been invited</h2>
            <p className="text-sm text-slate-400 mb-4">Join your company's workspace.</p>
            <div className="space-y-2.5">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-navy2 border border-white/10">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{inv.org_name}</p>
                    <p className="text-xs text-slate-400">as {ROLE_LABELS[inv.role]}</p>
                  </div>
                  <Button size="sm" loading={busy} onClick={() => join(inv)}>Join</Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-white/8" /><span className="text-xs text-slate-500">or start a new company</span><div className="flex-1 h-px bg-white/8" /></div>
          </div>
        )}

        {!invites?.length && (
          <>
            <h2 className="text-2xl font-black mb-1">Set up your company</h2>
            <p className="text-sm text-slate-400 mb-6">Your 7-day free trial starts now. You can change all of this later.</p>
          </>
        )}

        <div className="flex flex-col gap-3">
          <Input label="Company name" value={name} onChange={e => onName(e.target.value)} placeholder="e.g. Land Nest Homes Ltd" />
          <Input label="Company code" value={prefix}
            onChange={e => { setTouched(t => ({ ...t, prefix: true })); setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)) }}
            hint={`Starts every client number, e.g. ${prefix || 'LNH'}-NA-001`} />
          <Input label="Web address for your client forms" value={slug}
            onChange={e => { setTouched(t => ({ ...t, slug: true })); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50)) }}
            hint={`${window.location.host}/f/${slug || 'your-company'}`} />
          {error && <Alert>{error}</Alert>}
          <Button className="w-full mt-2" loading={busy && !invites?.length} onClick={create}>Create my workspace →</Button>
          <button onClick={() => signOut()} className="text-xs text-slate-500 hover:text-white mt-2">Signed in as {user?.email} · Sign out</button>
        </div>
      </div>
    </div>
  )
}
