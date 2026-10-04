import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import TrialBanner from '../components/layout/TrialBanner'
import { Alert, Badge, Modal } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth.jsx'
import { getPlan, getTrialDaysLeft, getTrialEnd } from '../lib/trial'
import { CONTACT_EMAIL } from '../lib/config'

// ── Stat Card ──
function StatCard({ label, value, change, changeType = 'neutral' }) {
  return (
    <div className="bg-[#111F3A] border border-white/8 rounded-xl p-5">
      <p className="text-xs text-slate-400 font-medium mb-3">{label}</p>
      <p className="text-3xl font-black tracking-tight mb-1">{value}</p>
      <p className={`text-xs ${changeType === 'up' ? 'text-green-400' : changeType === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
        {change}
      </p>
    </div>
  )
}

// ── Data Table ──
function Table({ headers, children, minWidth }) {
  return (
    <div className="bg-[#111F3A] border border-white/8 rounded-xl overflow-hidden mb-6" style={{ overflowX: 'auto' }}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-white/8">
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 text-sm border-b border-white/4 whitespace-nowrap ${className}`}>{children}</td>
}

// ── Overview Page ──
function Overview({ onNavigate, onOpenModal }) {
  const pendingPayments = [
    { name: 'Kemi Adeyemi',  email: 'kemi@email.com',  product: 'Nest Farm Cluster City', amount: '₦2,000,000', type: 'Outright Payment',  time: 'Today, 9:14 AM',    avatar: 'KA', color: '#0891B2' },
    { name: 'Emeka Martins', email: 'emeka@email.com', product: 'Nest Apartments',         amount: '₦800,000',   type: 'Initial Deposit',   time: 'Today, 8:02 AM',    avatar: 'EM', color: '#DC2626' },
    { name: 'Ngozi Obi',     email: 'ngozi@email.com', product: 'Nest Residence',           amount: '₦500,000',   type: '2nd Installment',   time: 'Yesterday, 4:30 PM', avatar: 'NO', color: '#7C3AED' },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="💳 Total Revenue"    value="₦18.4M" change="↑ 23% this month"         changeType="up" />
        <StatCard label="📄 Docs Sent"        value="147"    change="↑ 12 this week"            changeType="up" />
        <StatCard label="👥 Active Clients"   value="38"     change="4 added this month" />
        <StatCard label="⏳ Pending Payments" value="3"      change="Awaiting confirmation"     changeType="down" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold">⚡ Awaiting Your Confirmation</h2>
        <button onClick={() => onNavigate('payments')} className="text-xs text-blue-400 font-medium hover:underline">View all payments →</button>
      </div>

      <Table headers={['Client', 'Product', 'Amount', 'Type', 'Submitted', 'Action']}>
        {pendingPayments.map((p, i) => (
          <tr key={i} className="hover:bg-white/2 transition-colors">
            <Td><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-400">{p.email}</div></Td>
            <Td className="text-slate-300">{p.product}</Td>
            <Td className="font-bold text-green-400">{p.amount}</Td>
            <Td><Badge variant="blue">{p.type}</Badge></Td>
            <Td className="text-slate-400 text-xs">{p.time}</Td>
            <Td>
              <button
                onClick={() => onOpenModal('confirm', p)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
              >
                Preview & Send
              </button>
            </Td>
          </tr>
        ))}
      </Table>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold">Recent Activity</h2>
        <button onClick={() => onNavigate('clients')} className="text-xs text-blue-400 font-medium hover:underline">View all clients →</button>
      </div>

      <Table headers={['Client', 'Product', 'Amount', 'Type', 'Date', 'Status']}>
        {[
          { name: 'Adebayo Okafor',    product: 'Nest Farm Cluster City', amount: '₦1,000,000',  type: 'Initial Deposit',  date: '21 Sep 2026' },
          { name: 'Fatima Nwosu',      product: 'Nest Farm Cluster City', amount: '₦500,000',    type: '2nd Installment',  date: '20 Sep 2026' },
          { name: 'Blessing Kalu',     product: 'Nest Residence',          amount: '₦30,000,000', type: 'Outright Payment', date: '19 Sep 2026' },
          { name: 'Chukwuemeka Eze',   product: 'Nest Apartments',         amount: '₦20,000,000', type: 'Initial Deposit',  date: '18 Sep 2026' },
        ].map((r, i) => (
          <tr key={i} className="hover:bg-white/2 transition-colors">
            <Td className="font-semibold">{r.name}</Td>
            <Td className="text-slate-300">{r.product}</Td>
            <Td className="font-semibold">{r.amount}</Td>
            <Td className="text-slate-400">{r.type}</Td>
            <Td className="text-slate-400 text-xs">{r.date}</Td>
            <Td><Badge variant="green">✓ Sent</Badge></Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

// ── Payments Page ──
function Payments({ onOpenModal }) {
  const [filter, setFilter] = useState('all')
  const all = [
    { name:'Kemi Adeyemi',    product:'Nest Farm Cluster City', amount:'₦2,000,000',  type:'Outright Payment', date:'21/09/2026', status:'pending' },
    { name:'Emeka Martins',   product:'Nest Apartments',         amount:'₦800,000',   type:'Initial Deposit',  date:'21/09/2026', status:'pending' },
    { name:'Adebayo Okafor',  product:'Nest Farm Cluster City', amount:'₦1,000,000',  type:'Initial Deposit',  date:'21/09/2026', status:'sent' },
    { name:'Fatima Nwosu',    product:'Nest Farm Cluster City', amount:'₦500,000',    type:'2nd Installment',  date:'20/09/2026', status:'sent' },
    { name:'Blessing Kalu',   product:'Nest Residence',          amount:'₦30,000,000', type:'Outright Payment', date:'19/09/2026', status:'sent' },
  ]
  const rows = filter === 'all' ? all : all.filter(r => r.status === filter)

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {['all','pending','sent'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors capitalize
              ${filter === f ? 'border-blue-500/50 text-blue-300 bg-blue-600/10' : 'border-white/10 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>
      <Table headers={['Client', 'Product', 'Amount', 'Type', 'Date', 'Status / Action']}>
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-white/2 transition-colors">
            <Td className="font-semibold">{r.name}</Td>
            <Td className="text-slate-300">{r.product}</Td>
            <Td className={`font-bold ${r.status === 'pending' ? 'text-green-400' : ''}`}>{r.amount}</Td>
            <Td className="text-slate-300">{r.type}</Td>
            <Td className="text-slate-400 text-xs">{r.date}</Td>
            <Td>
              {r.status === 'pending'
                ? <button onClick={() => onOpenModal('confirm', r)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-md">Preview & Send</button>
                : <Badge variant="green">✓ Sent</Badge>
              }
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

// ── Clients Page ──
function Clients({ onOpenModal }) {
  const clients = [
    { initials:'AO', color:'#2563EB', name:'Adebayo Okafor',  email:'adebayo@email.com', product:'Nest Farm',    paid:'₦1,000,000',  balance:'₦1,000,000', payments:'1 of 7', status:'In Progress' },
    { initials:'FN', color:'#7C3AED', name:'Fatima Nwosu',    email:'fatima@email.com',  product:'Nest Farm',    paid:'₦1,500,000',  balance:'₦500,000',   payments:'2 of 7', status:'In Progress' },
    { initials:'BK', color:'#0891B2', name:'Blessing Kalu',   email:'blessing@email.com', product:'Nest Residence', paid:'₦30,000,000', balance:'₦0',          payments:'7 of 7', status:'Fully Paid' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-slate-400">All Clients (38)</h2>
        <Button size="sm" onClick={() => onOpenModal('addClient')}>+ Add Client</Button>
      </div>
      <Table headers={['Client', 'Product', 'Total Paid', 'Balance', 'Payments', 'Status', '']}>
        {clients.map((c, i) => (
          <tr key={i} className="hover:bg-white/2 transition-colors">
            <Td>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: c.color }}>{c.initials}</div>
                <div><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-400">{c.email}</p></div>
              </div>
            </Td>
            <Td className="text-slate-300">{c.product}</Td>
            <Td className="font-semibold text-green-400">{c.paid}</Td>
            <Td className={c.balance === '₦0' ? 'text-green-400 font-semibold' : 'text-amber-400'}>{c.balance}</Td>
            <Td className="text-slate-300">{c.payments}</Td>
            <Td><Badge variant={c.status === 'Fully Paid' ? 'green' : 'amber'}>{c.status === 'Fully Paid' ? '✓ Fully Paid' : 'In Progress'}</Badge></Td>
            <Td><button onClick={() => onOpenModal('clientDetail', c)} className="text-xs bg-white/6 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-md transition-colors">View</button></Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

// ── Ledger Page ──
function Ledger() {
  const rows = [
    { name:'Adebayo Okafor', email:'adebayo@email.com', product:'Nest Farm', total:'₦2,000,000', p1:'₦1,000,000', d1:'21/09/26', totalPaid:'₦1,000,000', balance:'₦1,000,000', status:'In Progress' },
    { name:'Fatima Nwosu',   email:'fatima@email.com',  product:'Nest Farm', total:'₦2,000,000', p1:'₦1,000,000', d1:'15/09/26', p2:'₦500,000', d2:'20/09/26', totalPaid:'₦1,500,000', balance:'₦500,000', status:'In Progress' },
    { name:'Blessing Kalu',  email:'blessing@email.com', product:'Nest Res.', total:'₦30,000,000', p1:'₦5M', d1:'01/08/26', p2:'₦5M', p3:'₦5M', p4:'₦5M', p5:'₦5M', p6:'₦5M', p7:'₦0', totalPaid:'₦30,000,000', balance:'₦0', status:'Fully Paid' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-slate-400">Master Ledger</h2>
        <Button size="sm" variant="secondary">⬇ Export CSV</Button>
      </div>
      <Table headers={['Client','Product','Total','P1','P2','P3','P4','P5','P6','P7','Paid','Balance','Status']} minWidth="1100px">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-white/2 transition-colors">
            <Td><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-400">{r.email}</p></Td>
            <Td className="text-slate-300">{r.product}</Td>
            <Td className="text-slate-300">{r.total}</Td>
            {[r.p1,r.p2,r.p3,r.p4,r.p5,r.p6,r.p7].map((p, j) => (
              <Td key={j}>{p ? <span className="text-green-400 font-semibold">{p}</span> : <span className="text-slate-600">—</span>}</Td>
            ))}
            <Td className="font-bold text-green-400">{r.totalPaid}</Td>
            <Td className={r.balance === '₦0' ? 'text-green-400 font-semibold' : 'text-amber-400'}>{r.balance}</Td>
            <Td><Badge variant={r.status === 'Fully Paid' ? 'green' : 'amber'}>{r.status === 'Fully Paid' ? '✓ Fully Paid' : 'In Progress'}</Badge></Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

// ── Products Page ──
function Products({ onOpenModal }) {
  const products = [
    { icon:'🏡', name:'Nest Farm Cluster City', desc:'500 sqm plots for residential use. KM 35, Iseyin Road.', price:'₦1,000,000/plot', status:'Active',     progress:68 },
    { icon:'🏢', name:'Nest Apartments',         desc:'Studio and 1-bedroom beside Lead City University, Ibadan.', price:'₦20M–₦30M',    status:'Pre-Launch', progress:22 },
    { icon:'🏘️', name:'Nest Residence',           desc:'Premium residential estate with modern infrastructure.', price:'From ₦30,000,000', status:'Active',     progress:45 },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-slate-400">Your Products</h2>
        <Button size="sm" onClick={() => onOpenModal('addProduct')}>+ Add Product</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p, i) => (
          <div key={i} className="bg-[#111F3A] border border-white/8 hover:border-blue-600/30 rounded-xl p-5 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-xl mb-4">{p.icon}</div>
            <h3 className="text-sm font-bold mb-1.5">{p.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">{p.desc}</p>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Price</p>
                <p className="text-sm font-bold">{p.price}</p>
              </div>
              <Badge variant={p.status === 'Active' ? 'green' : 'blue'}>{p.status}</Badge>
            </div>
            <div className="mt-3">
              <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.progress}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">{p.progress}% sold</p>
            </div>
          </div>
        ))}
        <div
          onClick={() => onOpenModal('addProduct')}
          className="bg-[#111F3A] border border-dashed border-white/15 hover:border-blue-600/40 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[200px]"
        >
          <span className="text-3xl text-slate-600 mb-2">+</span>
          <p className="text-sm font-semibold text-slate-400">Add new product</p>
          <p className="text-xs text-slate-600 mt-1">Click to create</p>
        </div>
      </div>
    </div>
  )
}

// ── Templates Page ──
function Templates() {
  const templates = [
    { icon:'📝', name:'Contract of Sale',       desc:'Used for all new client purchases. Sent automatically on first payment confirmation.', connected: true },
    { icon:'🧾', name:'Payment Receipt',         desc:'Sent for every confirmed payment — first and subsequent installments.',               connected: true },
    { icon:'📬', name:'Acknowledgement Letter',  desc:'Sent alongside contract and receipt on initial deposit or outright payment.',          connected: true },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-slate-400">Document Templates</h2>
        <Button size="sm" variant="secondary">+ Upload Template</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t, i) => (
          <div key={i} className="bg-[#111F3A] border border-white/8 rounded-xl p-5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-xl mb-4">{t.icon}</div>
            <h3 className="text-sm font-bold mb-1.5">{t.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">{t.desc}</p>
            <div className="flex justify-between items-center">
              <Badge variant="green">✓ Connected</Badge>
              <button className="text-xs bg-white/6 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-md transition-colors">Replace</button>
            </div>
          </div>
        ))}
        <div className="bg-[#111F3A] border border-dashed border-white/15 rounded-xl p-5 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-blue-600/40 transition-colors">
          <span className="text-3xl text-slate-600 mb-2">+</span>
          <p className="text-sm font-semibold text-slate-400">Upload a new template</p>
          <p className="text-xs text-slate-600 mt-1">Google Docs or Word (.docx)</p>
        </div>
      </div>
    </div>
  )
}

// ── Settings Page ──
function Settings() {
  const [panel, setPanel] = useState('profile')
  const tabs = ['profile', 'connections', 'notifications', 'security']
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
      <div className="flex lg:flex-col gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setPanel(t)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors text-left whitespace-nowrap
              ${panel === t ? 'bg-blue-600/12 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="bg-[#111F3A] border border-white/8 rounded-xl p-5 lg:p-6">
        {panel === 'profile'       && <ProfilePanel />}
        {panel === 'connections'   && <ConnectionsPanel />}
        {panel === 'notifications' && <NotificationsPanel />}
        {panel === 'security'      && <SecurityPanel />}
      </div>
    </div>
  )
}

const INDUSTRIES = ['Real Estate / Property', 'Financial Services', 'Cooperatives / Savings', 'Retail / E-commerce', 'Education', 'Healthcare', 'Legal Services', 'Other']

function ProfilePanel() {
  const { user, businessName, updateProfile } = useAuth()
  const meta = user?.user_metadata || {}
  const [form, setForm] = useState({
    business_name: businessName,
    contact_email: meta.contact_email || user?.email || '',
    phone:         meta.phone || '',
    address:       meta.address || '',
    industry:      meta.industry || '',
  })
  const [saving, setSaving] = useState(false)
  const [alert, setAlert]   = useState({ msg: '', type: 'error' })
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    if (!form.business_name.trim()) return setAlert({ msg: 'Business name is required.', type: 'error' })
    setSaving(true); setAlert({ msg: '' })
    const { error } = await updateProfile({ ...form, business_name: form.business_name.trim() })
    setSaving(false)
    setAlert(error ? { msg: error.message, type: 'error' } : { msg: 'Profile saved.', type: 'success' })
  }

  return (
    <div>
      <h3 className="text-sm font-bold mb-1">Business Profile</h3>
      <p className="text-xs text-slate-400 mb-5">This information appears in your documents and emails.</p>
      <div className="grid grid-cols-1 gap-3 max-w-md">
        {alert.msg && <Alert variant={alert.type}>{alert.msg}</Alert>}
        <Input label="Business Name" value={form.business_name} onChange={set('business_name')} />
        <Input label="Contact Email" type="email" value={form.contact_email} onChange={set('contact_email')} hint="Shown to clients. Your login email doesn't change." />
        <Input label="Phone Number" type="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={set('phone')} />
        <Input label="Business Address" placeholder="Street, city" value={form.address} onChange={set('address')} />
        <Select label="Industry" value={form.industry} onChange={set('industry')}>
          <option value="">Select your industry</option>
          {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
        </Select>
        <Button className="w-fit mt-2" loading={saving} onClick={save}>Save changes</Button>
      </div>
    </div>
  )
}

function ConnectionsPanel() {
  return (
    <div>
      <h3 className="text-sm font-bold mb-1">Connected Accounts</h3>
      <p className="text-xs text-slate-400 mb-5">DocuSend uses these to generate and send your documents automatically.</p>
      {[
        { icon:'📧', name:'Gmail',                  detail:'Send documents from your own Gmail address' },
        { icon:'💾', name:'Google Drive',           detail:'Store templates and generated documents' },
        { icon:'🏦', name:'Bank Alert Integration', detail:'Auto-detect incoming transfers' },
      ].map((c, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-4 bg-white/3 border border-white/8 rounded-xl mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-lg shrink-0">{c.icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-slate-400">{c.detail}</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" disabled>Coming soon</Button>
        </div>
      ))}
    </div>
  )
}

const NOTIFICATIONS = [
  { key: 'payment_submitted', label: 'New payment submitted',       default: true },
  { key: 'documents_sent',    label: 'Documents sent successfully', default: true },
  { key: 'client_paid_off',   label: 'Client fully paid off',       default: true },
  { key: 'weekly_summary',    label: 'Weekly summary report',       default: false },
]

function NotificationsPanel() {
  const { user, updateProfile } = useAuth()
  const saved = user?.user_metadata?.notifications || {}
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIFICATIONS.map(n => [n.key, saved[n.key] ?? n.default])))
  const [error, setError] = useState('')

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next); setError('')
    const { error } = await updateProfile({ notifications: next })
    if (error) { setPrefs(prefs); setError(error.message) }
  }

  return (
    <div>
      <h3 className="text-sm font-bold mb-1">Notification Preferences</h3>
      <p className="text-xs text-slate-400 mb-5">Choose when DocuSend notifies you. Changes save automatically.</p>
      {error && <div className="mb-4 max-w-sm"><Alert>{error}</Alert></div>}
      <div className="flex flex-col gap-4 max-w-sm">
        {NOTIFICATIONS.map(n => (
          <label key={n.key} className="flex items-center justify-between text-sm cursor-pointer">
            {n.label}
            <input type="checkbox" checked={prefs[n.key]} onChange={() => toggle(n.key)} className="w-4 h-4 accent-blue-500" />
          </label>
        ))}
      </div>
    </div>
  )
}

function SecurityPanel() {
  const { user, signIn, updatePassword, deleteAccount } = useAuth()
  const navigate = useNavigate()
  // Google-only accounts have no password yet, so there's nothing to re-check
  const hasPassword = user?.identities?.some(i => i.provider === 'email') ?? true

  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [pwAlert, setPwAlert] = useState({ msg: '', type: 'error' })

  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting]           = useState(false)
  const [deleteError, setDeleteError]     = useState('')

  const changePassword = async () => {
    if (hasPassword && !current) return setPwAlert({ msg: 'Enter your current password.', type: 'error' })
    if (next.length < 8)         return setPwAlert({ msg: 'New password must be at least 8 characters.', type: 'error' })
    if (next !== confirm)        return setPwAlert({ msg: 'New passwords do not match.', type: 'error' })
    setSaving(true); setPwAlert({ msg: '' })
    if (hasPassword) {
      const { error } = await signIn(user.email, current)
      if (error) {
        setSaving(false)
        return setPwAlert({ msg: 'Current password is incorrect.', type: 'error' })
      }
    }
    const { error } = await updatePassword(next)
    setSaving(false)
    if (error) return setPwAlert({ msg: error.message, type: 'error' })
    setCurrent(''); setNext(''); setConfirm('')
    setPwAlert({ msg: 'Password updated.', type: 'success' })
  }

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('')
    const { error } = await deleteAccount()
    setDeleting(false)
    if (error) return setDeleteError('Could not delete your account. Please try again or contact support.')
    navigate('/', { replace: true })
  }

  return (
    <div>
      <h3 className="text-sm font-bold mb-1">{hasPassword ? 'Change Password' : 'Set a Password'}</h3>
      <p className="text-xs text-slate-400 mb-5">
        {hasPassword ? "Use a strong password you don't use elsewhere." : 'Add a password so you can also sign in with your email.'}
      </p>
      <div className="flex flex-col gap-3 max-w-sm mb-6">
        {pwAlert.msg && <Alert variant={pwAlert.type}>{pwAlert.msg}</Alert>}
        {hasPassword && <Input label="Current Password" type="password" placeholder="••••••••" value={current} onChange={e => setCurrent(e.target.value)} />}
        <Input label="New Password" type="password" placeholder="At least 8 characters" value={next} onChange={e => setNext(e.target.value)} />
        <Input label="Confirm New Password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
        <Button className="w-fit mt-1" loading={saving} onClick={changePassword}>Update password</Button>
      </div>
      <div className="border-t border-white/8 pt-5 max-w-sm">
        <h3 className="text-sm font-bold text-red-400 mb-1">Danger Zone</h3>
        <p className="text-xs text-slate-400 mb-4">Deleting your account is permanent and cannot be undone.</p>
        <div className="flex flex-col gap-3">
          {deleteError && <Alert>{deleteError}</Alert>}
          <Input label='Type DELETE to confirm' value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} />
          <Button variant="danger" className="w-fit" loading={deleting} disabled={confirmDelete !== 'DELETE'} onClick={handleDelete}>
            Delete account
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Billing Page ──
const PLANS = [
  { id:'starter',    name:'Starter',    price:'₦50,000',  period:'setup + ₦15,000/mo' },
  { id:'growth',     name:'Growth',     price:'₦100,000', period:'setup + ₦30,000/mo' },
  { id:'enterprise', name:'Enterprise', price:'Custom',   period:'Talk to us' },
]

function Billing() {
  const { user, updateProfile } = useAuth()
  const [switching, setSwitching] = useState(null)
  const [error, setError] = useState('')
  const planId   = getPlan(user)
  const current  = PLANS.find(p => p.id === planId) || PLANS[1]
  const daysLeft = getTrialDaysLeft(user)
  const trialEnd = getTrialEnd(user)
  const fmtDate  = d => d?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const selectPlan = async (id) => {
    setSwitching(id); setError('')
    const { error } = await updateProfile({ plan: id })
    setSwitching(null)
    if (error) setError(error.message)
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Current Plan" value={current.name} change={`${current.price} ${current.period}`} />
        <StatCard
          label={daysLeft > 0 ? 'Trial Ends' : 'Trial Ended'}
          value={daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : fmtDate(trialEnd) || '—'}
          change={daysLeft > 0 ? `On ${fmtDate(trialEnd)}` : 'Upgrade to keep sending documents'}
          changeType="down"
        />
        <StatCard label="Next Payment" value="—" change="Online payments coming soon" />
      </div>
      <div className="bg-[#111F3A] border border-white/8 rounded-xl p-5 lg:p-6">
        <h3 className="text-sm font-bold mb-1">Choose your plan</h3>
        <p className="text-xs text-slate-400 mb-5">All plans include automated document sending, installment tracking, and email delivery.</p>
        {error && <div className="mb-4"><Alert>{error}</Alert></div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(p => {
            const isCurrent = p.id === current.id
            return (
              <div key={p.id} className={`p-4 rounded-xl border ${isCurrent ? 'border-blue-500/40 bg-blue-600/6' : 'border-white/8'}`}>
                <p className={`text-sm font-bold mb-1 ${isCurrent ? 'text-blue-300' : ''}`}>{p.name}{isCurrent ? ' ← Current' : ''}</p>
                <p className="text-xl font-black mb-0.5">{p.price}</p>
                <p className="text-xs text-slate-400 mb-4">{p.period}</p>
                {isCurrent ? (
                  <Button size="sm" className="w-full justify-center" disabled>Pay now · coming soon</Button>
                ) : p.id === 'enterprise' ? (
                  <Button size="sm" variant="secondary" className="w-full justify-center" disabled={!CONTACT_EMAIL} onClick={() => { window.location.href = `mailto:${CONTACT_EMAIL}?subject=DocuSend%20Enterprise` }}>Contact us</Button>
                ) : (
                  <Button size="sm" variant="secondary" className="w-full justify-center" loading={switching === p.id} onClick={() => selectPlan(p.id)}>Select</Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Confirm Payment Modal ──
function ConfirmModal({ data, onClose }) {
  const [sent, setSent] = useState(false)
  if (!data) return null
  return (
    <div>
      <div className="bg-blue-600/8 border border-blue-600/20 rounded-xl p-4 mb-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Document Preview</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-slate-400">Client: </span><span className="font-semibold">{data.name}</span></div>
          <div><span className="text-slate-400">Product: </span><span className="font-semibold">{data.product}</span></div>
          <div><span className="text-slate-400">Amount: </span><span className="font-semibold text-green-400">{data.amount}</span></div>
          <div><span className="text-slate-400">Type: </span><span className="font-semibold">{data.type}</span></div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">The following documents will be generated and sent to the client's email automatically:</p>
      <div className="flex gap-2 mb-5">
        <Badge variant="blue">📝 Contract of Sale</Badge>
        <Badge variant="blue">🧾 Receipt</Badge>
        <Badge variant="blue">📬 Acknowledgement</Badge>
      </div>
      {sent
        ? <div className="flex items-center gap-2 text-green-400 text-sm font-semibold"><span>✓</span> Documents sent successfully!</div>
        : (
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setSent(true)}>Confirm & Send Documents</Button>
          </div>
        )
      }
    </div>
  )
}

// ── Add Client Modal ──
function AddClientModal({ onClose }) {
  return (
    <div className="flex flex-col gap-3">
      <Input label="Full Name" placeholder="e.g. Adebayo Okafor" />
      <Input label="Email Address" type="email" placeholder="client@email.com" />
      <Input label="Phone Number" type="tel" placeholder="+234 800 000 0000" />
      <Input label="Address" placeholder="Client's address" />
      <Select label="Product">
        <option>Nest Farm Cluster City</option>
        <option>Nest Apartments</option>
        <option>Nest Residence</option>
      </Select>
      <Input label="Number of Plots / Units" type="number" placeholder="e.g. 2" />
      <Select label="Payment Plan">
        <option>Outright Payment</option>
        <option>3 Months Installment</option>
        <option>6 Months Installment</option>
      </Select>
      <Input label="Initial Amount Paid (₦)" type="number" placeholder="e.g. 1000000" />
      <div className="flex gap-2.5 mt-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onClose}>Add & Send Documents</Button>
      </div>
    </div>
  )
}

// ── Add Product Modal ──
function AddProductModal({ onClose }) {
  return (
    <div className="flex flex-col gap-3">
      <Input label="Product Name" placeholder="e.g. Nest Farm Phase 2" />
      <Input label="Description" placeholder="Short description" />
      <Select label="Unit Type">
        <option>Plots of land</option>
        <option>Apartment units</option>
        <option>House units</option>
      </Select>
      <Input label="Price per Unit (₦)" type="number" placeholder="e.g. 1000000" />
      <Input label="Square Metres per Unit" type="number" placeholder="e.g. 500" />
      <Input label="Location" placeholder="Estate address or location" />
      <div className="flex gap-2.5 mt-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onClose}>Save Product</Button>
      </div>
    </div>
  )
}

// ── MAIN DASHBOARD ──
export default function DashboardPage() {
  const [activePage, setActivePage] = useState('overview')
  const [modal, setModal] = useState({ type: null, data: null })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const goTo = (page) => { setActivePage(page); setSidebarOpen(false) }

  const openModal  = (type, data = null) => setModal({ type, data })
  const closeModal = () => setModal({ type: null, data: null })

  const pageTitles = {
    overview:'Overview', payments:'Payments', clients:'Clients',
    ledger:'Master Ledger', products:'Products', templates:'Templates',
    settings:'Settings', billing:'Billing',
  }

  const renderPage = () => {
    switch (activePage) {
      case 'overview':  return <Overview  onNavigate={setActivePage} onOpenModal={openModal} />
      case 'payments':  return <Payments  onOpenModal={openModal} />
      case 'clients':   return <Clients   onOpenModal={openModal} />
      case 'ledger':    return <Ledger />
      case 'products':  return <Products  onOpenModal={openModal} />
      case 'templates': return <Templates />
      case 'settings':  return <Settings />
      case 'billing':   return <Billing />
      default:          return <Overview  onNavigate={setActivePage} onOpenModal={openModal} />
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar activePage={activePage} onNavigate={goTo} pendingCount={3} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 lg:ml-60 flex flex-col">
        {/* Trial Banner */}
        <TrialBanner onUpgrade={() => goTo('billing')} />

        {/* Topbar */}
        <div className="sticky top-0 z-30 h-16 px-4 lg:px-7 bg-navy/90 backdrop-blur-md border-b border-white/8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg bg-white/6 border border-white/8 flex items-center justify-center text-lg"
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1 className="text-base font-bold">{pageTitles[activePage]}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="w-9 h-9 rounded-lg bg-white/6 border border-white/8 flex items-center justify-center text-base hover:bg-white/10 transition-colors relative">
              🔔
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-navy" />
            </button>
            <Button size="sm" onClick={() => openModal('addClient')}>+ Add Client</Button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-4 lg:p-7">{renderPage()}</div>
      </div>

      {/* Modals */}
      <Modal isOpen={modal.type === 'confirm'}      onClose={closeModal} title="Preview & Confirm Payment"   subtitle="Review the details below before sending documents to the client.">
        <ConfirmModal data={modal.data} onClose={closeModal} />
      </Modal>
      <Modal isOpen={modal.type === 'addClient'}    onClose={closeModal} title="Add New Client"              subtitle="The client will appear in your ledger once their first payment is confirmed.">
        <AddClientModal onClose={closeModal} />
      </Modal>
      <Modal isOpen={modal.type === 'addProduct'}   onClose={closeModal} title="Add New Product"             subtitle="Set up a product once and it's available for all future client transactions.">
        <AddProductModal onClose={closeModal} />
      </Modal>
      <Modal isOpen={modal.type === 'clientDetail'} onClose={closeModal} title={modal.data?.name}            subtitle={modal.data?.email}>
        <div className="text-sm text-slate-400">Full client detail view coming in Step 2 when connected to Supabase.</div>
      </Modal>
    </div>
  )
}
