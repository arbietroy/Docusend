import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'
import { getTrialDaysLeft } from '../../lib/trial'

const NAV = [
  { id: 'overview',   icon: '📊', label: 'Overview' },
  { id: 'payments',   icon: '💳', label: 'Payments',  badge: 'amber' },
  { id: 'clients',    icon: '👥', label: 'Clients' },
  { id: 'ledger',     icon: '📒', label: 'Master Ledger' },
  { id: 'products',   icon: '📦', label: 'Products' },
  { id: 'templates',  icon: '📄', label: 'Templates' },
  { id: 'settings',   icon: '⚙️', label: 'Settings' },
  { id: 'billing',    icon: '💼', label: 'Billing' },
]

export default function Sidebar({ activePage, onNavigate, pendingCount = 0 }) {
  const { signOut, businessName } = useAuth()
  const navigate = useNavigate()
  const daysLeft = getTrialDaysLeft()

  const initials = businessName
    ? businessName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AB'

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#111F3A] border-r border-white/8 flex flex-col z-50">
      {/* Logo */}
      <Link to="/" className="block px-5 py-5 border-b border-white/8 text-xl font-black">
        Docu<span className="text-blue-500">Send</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-3 py-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">Main</p>
        {NAV.slice(0, 4).map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={activePage === item.id}
            onClick={() => onNavigate(item.id)}
            badge={item.id === 'payments' && pendingCount > 0 ? pendingCount : null}
            badgeVariant={item.badge}
          />
        ))}
        <p className="px-3 py-2 mt-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">Setup</p>
        {NAV.slice(4, 6).map(item => (
          <NavItem key={item.id} item={item} active={activePage === item.id} onClick={() => onNavigate(item.id)} />
        ))}
        <p className="px-3 py-2 mt-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">Account</p>
        {NAV.slice(6).map(item => (
          <NavItem key={item.id} item={item} active={activePage === item.id} onClick={() => onNavigate(item.id)} />
        ))}
        <NavItem item={{ id: 'site', icon: '🌐', label: 'View site' }} active={false} onClick={() => window.open('/', '_blank')} />
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/8">
        <div
          onClick={() => onNavigate('settings')}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/4 hover:bg-white/8 cursor-pointer transition-colors mb-1.5"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{businessName || 'My Business'}</p>
            <p className="text-xs text-slate-500">
              {daysLeft > 0 ? `Trial · ${daysLeft}d left` : 'Trial expired'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span>🚪</span> Log out
        </button>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onClick, badge, badgeVariant }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5
        ${active
          ? 'bg-blue-600/15 text-white font-semibold'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
    >
      <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
      <span className="flex-1 text-left">{item.label}</span>
      {badge && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeVariant === 'amber' ? 'bg-amber-500 text-black' : 'bg-blue-600 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}
