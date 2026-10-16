import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useAsync } from '../../hooks/useAsync'
import { myRealtorDashboard, getRealtorLoginCompany, claimRealtor } from '../../lib/api'
import { naira, nairaShort, fmtDate, initials, isoDate, unitLabel } from '../../lib/format'
import { Loading, Progress, StatusBadge, Tabs } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

// /realtor/:company: realtors sign in with email; they are matched to the
// name (or email) clients wrote for them on the company's forms.
export default function RealtorApp() {
  const { slug } = useParams()
  const { user, loading } = useAuth()
  const company = useAsync(async () => slug ? getRealtorLoginCompany(slug) : null, [slug])
  if (loading || company.loading) return <div className="min-h-screen bg-navy"><Loading /></div>
  if (slug && !company.data) {
    return <Shell><div className="text-center py-16"><div className="text-4xl mb-3">🔎</div><h1 className="text-xl font-bold mb-2">Company not found</h1>
      <p className="text-sm text-slate-400">Check the link the company sent you.</p></div></Shell>
  }
  return user ? <RealtorDashboard company={company.data} /> : <RealtorLogin company={company.data} />
}

function Brand({ company }) {
  if (!company) return <p className="text-xl font-black mb-8">Docu<span className="text-blue-500">Send</span> <span className="text-sm font-semibold text-slate-400">for realtors</span></p>
  return (
    <div className="flex items-center gap-3 mb-8">
      {company.logo_url
        ? <img src={company.logo_url} alt="" className="w-11 h-11 rounded-xl object-contain bg-white/5" />
        : <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black" style={{ background: company.brand_color }}>{initials(company.name)}</div>}
      <div><p className="font-black">{company.name}</p><p className="text-xs text-slate-400">Realtor portal</p></div>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-navy">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">{children}</div>
    </div>
  )
}

function RealtorLogin({ company }) {
  const { signIn, signUp, resetPassword, resendVerification } = useAuth()
  const [mode, setMode] = useState(company ? 'signup' : 'login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'error' })

  const submit = async () => {
    setMsg({ text: '' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg({ text: 'Enter a valid email address.', type: 'error' })
    if (mode === 'signup' && name.trim().split(/\s+/).length < 2) return setMsg({ text: 'Enter your first and last name, as your clients know you.', type: 'error' })
    if (mode !== 'forgot' && password.length < 8) return setMsg({ text: 'Password must be at least 8 characters.', type: 'error' })
    setBusy(true)
    if (mode === 'login') {
      const { error } = await signIn(email.trim(), password)
      if (error) setMsg({ text: error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message, type: 'error' })
    } else if (mode === 'signup') {
      const { data, error } = await signUp(email.trim(), password, null, company ? `/realtor/${company.slug}` : '/realtor',
        { realtor_name: name.trim(), realtor_phone: phone.trim() })
      if (error) setMsg({ text: error.message.includes('registered') ? 'This email already has an account. Sign in instead.' : error.message, type: 'error' })
      else if (!data.session) setMsg({ text: `We've sent a confirmation link to ${email.trim()}. Open it to finish creating your account, then sign in here.`, type: 'success' })
    } else {
      const { error } = await resetPassword(email.trim())
      setMsg(error ? { text: error.message, type: 'error' } : { text: `Password reset link sent to ${email.trim()}.`, type: 'success' })
    }
    setBusy(false)
  }

  return (
    <Shell>
      <div className="max-w-sm mx-auto pt-6">
        <Brand company={company} />
        <h1 className="text-2xl font-black mb-1">
          {mode === 'login' ? 'Realtor sign in' : mode === 'signup' ? 'Create your realtor account' : 'Reset your password'}
        </h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Follow your clients' payments: who is owing, what's due soon, and your commission.
          {mode === 'signup' && <> Use <strong className="text-white">the name your clients know you by</strong>, so we can find them.</>}
        </p>
        <div className="flex flex-col gap-3">
          {mode === 'signup' && <>
            <Input label="Your full name (as clients know you)" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kunle Ade" />
            <Input label="Phone number (optional)" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0803 000 0000" />
          </>}
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
          {mode !== 'forgot' && <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} />}
          {msg.text && <Alert variant={msg.type}>{msg.text}</Alert>}
          <Button className="w-full" loading={busy} onClick={submit}>
            {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </Button>
        </div>
        <div className="text-sm text-slate-400 mt-5 space-y-2 text-center">
          {mode === 'login' && <>
            <p>New here? <button className="text-blue-400 hover:underline" onClick={() => { setMode('signup'); setMsg({ text: '' }) }}>Create an account</button></p>
            <p><button className="text-blue-400 hover:underline" onClick={() => { setMode('forgot'); setMsg({ text: '' }) }}>Forgot password?</button></p>
          </>}
          {mode === 'signup' && <>
            <p>Already have an account? <button className="text-blue-400 hover:underline" onClick={() => { setMode('login'); setMsg({ text: '' }) }}>Sign in</button></p>
            {msg.type === 'success' && <p><button className="text-blue-400 hover:underline" onClick={() => resendVerification(email.trim())}>Resend confirmation email</button></p>}
          </>}
          {mode === 'forgot' && <p><button className="text-blue-400 hover:underline" onClick={() => { setMode('login'); setMsg({ text: '' }) }}>← Back to sign in</button></p>}
        </div>
      </div>
    </Shell>
  )
}

function RealtorDashboard({ company }) {
  const { user, signOut } = useAuth()
  const { data, error, loading, reload } = useAsync(() => myRealtorDashboard(), [])
  const [which, setWhich] = useState(0)
  const [claim, setClaim] = useState({ busy: false, error: '', tried: false })
  const meta = user?.user_metadata || {}
  const linked = data?.companies?.some(c => c.slug === company?.slug)
  const needsClaim = company && data?.confirmed && !linked

  const connect = async (name, phone, quiet = false) => {
    setClaim({ busy: true, error: '', tried: true, auto: quiet === 'auto' || quiet === true })
    try { await claimRealtor(company.slug, name, phone); await reload(); setClaim({ busy: false, error: '', tried: true }) }
    catch (e) { setClaim({ busy: false, error: quiet === true ? '' : e.message, tried: true }) }
  }
  // Signed up on the company link with a name: connect straight away
  const auto = useRef(false)
  useEffect(() => {
    if (needsClaim && !auto.current) { auto.current = true; connect(meta.realtor_name, meta.realtor_phone, meta.realtor_name ? 'auto' : true) }
  }, [needsClaim]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (linked && data) setWhich(Math.max(0, data.companies.findIndex(c => c.slug === company.slug)))
  }, [linked]) // eslint-disable-line react-hooks/exhaustive-deps

  if ((loading && !data) || (needsClaim && (!claim.tried || (claim.busy && claim.auto)))) return <div className="min-h-screen bg-navy"><Loading /></div>

  const header = (
    <div className="flex items-center justify-between gap-3 mb-6">
      <p className="text-lg font-black">Docu<span className="text-blue-500">Send</span> <span className="text-xs font-semibold text-slate-400">for realtors</span></p>
      <div className="flex items-center gap-3 text-xs text-slate-400 min-w-0">
        <span className="truncate hidden sm:inline">{user?.email}</span>
        <button onClick={() => signOut()} className="hover:text-white shrink-0">Sign out</button>
      </div>
    </div>
  )

  if (error) return <Shell>{header}<Alert>{error.message}</Alert></Shell>
  if (!data.confirmed) {
    return <Shell>{header}<Alert variant="info">Please confirm your email first. Open the confirmation link we sent to {data.email}, then come back and refresh this page.</Alert></Shell>
  }
  if (needsClaim) {
    return <Shell>{header}<ConnectForm company={company} defaults={meta} busy={claim.busy} error={claim.error} onSubmit={connect} /></Shell>
  }
  if (!data.companies.length) {
    return (
      <Shell>
        {header}
        <div className="text-center py-10">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-xl font-bold mb-2">Open your company's realtor link</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Each real estate company has its own realtor link (it looks like <span className="font-mono">{window.location.origin}/realtor/company-name</span>).
            Ask the company to send it to you, open it, and we'll connect you to your clients there.
          </p>
          <p className="text-xs text-slate-500 mt-6">Work for a real estate company instead? <Link to="/app" className="text-blue-400 underline">Go to the company app</Link></p>
        </div>
      </Shell>
    )
  }

  const c = data.companies[Math.min(which, data.companies.length - 1)]
  return (
    <Shell>
      {header}
      {data.companies.length > 1 && (
        <Tabs value={which} onChange={setWhich} tabs={data.companies.map((x, i) => ({ id: i, label: x.company_name, count: x.clients.length }))} />
      )}
      <CompanyView c={c} onRefresh={reload} />
    </Shell>
  )
}

function ConnectForm({ company, defaults, busy, error, onSubmit }) {
  const [name, setName] = useState(defaults.realtor_name || '')
  const [phone, setPhone] = useState(defaults.realtor_phone || '')
  return (
    <div className="max-w-sm mx-auto pt-2">
      <Brand company={company} />
      <h1 className="text-2xl font-black mb-1">Connect to {company.name}</h1>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        Enter your name the way your clients write it on {company.name}'s forms. We'll show you the clients who named you.
      </p>
      <div className="flex flex-col gap-3">
        <Input label="Your full name (as clients know you)" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kunle Ade" />
        <Input label="Phone number (optional)" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Helps if two realtors share a name" />
        {error && <Alert>{error}</Alert>}
        <Button className="w-full" loading={busy} onClick={() => onSubmit(name.trim(), phone.trim())}>Connect</Button>
      </div>
      <p className="text-xs text-slate-500 mt-5 text-center leading-relaxed">
        If it says your name is already connected to someone else, or can't tell you apart from another realtor, contact {company.name}.
      </p>
    </div>
  )
}

function CompanyView({ c, onRefresh }) {
  const [tab, setTab] = useState('attention')
  const today = isoDate()
  const in30 = isoDate(new Date(Date.now() + 30 * 864e5))
  const clients = c.clients
  const attention = clients.filter(x => ['owing', 'defaulting'].includes(x.status))
  const upcoming = clients.filter(x => x.next_due_date && x.next_due_date >= today && x.next_due_date <= in30 && !['owing', 'defaulting'].includes(x.status))
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  const lists = { attention, upcoming, all: clients }
  const owed = Math.max(0, Number(c.commission?.earned || 0) - Number(c.commission?.paid || 0))

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        {c.logo_url
          ? <img src={c.logo_url} alt="" className="w-11 h-11 rounded-xl object-contain bg-white/5" />
          : <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black" style={{ background: c.brand_color }}>{initials(c.company_name)}</div>}
        <div className="min-w-0">
          <h1 className="text-xl font-black truncate">Hello, {c.realtor_name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-400 truncate">Your clients at {c.company_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Tile label="Clients" value={clients.length} />
        <Tile label="Need follow-up" value={attention.length} tone={attention.length ? 'text-red-300' : ''} />
        <Tile label="Due in 30 days" value={upcoming.length} />
        <Tile label="Commission owed" value={nairaShort(owed)} sub={`${Number(c.commission_percent)}% · ${nairaShort(c.commission?.earned)} earned`} />
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
        {lists[tab].map(x => (
          <div key={x.client_number} className="bg-navy2 border border-white/8 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{x.name}</p>
                <p className="text-xs text-slate-400 truncate">{x.client_number} · {x.property} · {Number(x.units)} {unitLabel(x.unit_type, x.units)} · {x.plan}</p>
              </div>
              <StatusBadge status={x.status} />
            </div>
            <Progress value={Number(x.paid)} max={Number(x.total_price)} className="mb-2" />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-slate-500">Paid</p><p className="font-semibold text-green-400">{naira(x.paid)}</p></div>
              <div><p className="text-slate-500">Balance</p><p className="font-semibold">{naira(x.balance)}</p></div>
              <div>
                {['owing', 'defaulting'].includes(x.status)
                  ? <><p className="text-slate-500">Overdue</p><p className="font-semibold text-red-300">{naira(x.overdue)}{x.days_overdue > 0 ? ` · ${x.days_overdue}d late` : ''}</p></>
                  : x.next_due_date && Number(x.balance) > 0
                    ? <><p className="text-slate-500">Next payment</p><p className="font-semibold">{naira(x.next_due_amount)} · {fmtDate(x.next_due_date)}</p></>
                    : <><p className="text-slate-500">Status</p><p className="font-semibold text-green-400">{Number(x.balance) > 0 ? 'Up to date' : 'Fully paid'}</p></>}
              </div>
            </div>
            {x.last_paid_on && <p className="text-[11px] text-slate-500 mt-2">Last payment {fmtDate(x.last_paid_on)}</p>}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 text-center mt-8">
        Questions about a client's account? Contact {c.company_name}{c.phone ? ` on ${c.phone}` : ''}{c.contact_email ? ` or ${c.contact_email}` : ''}.
        {' '}<button onClick={onRefresh} className="underline">Refresh</button>
      </p>
    </>
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
