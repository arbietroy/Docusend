import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useOrg } from '../../hooks/useOrg.jsx'
import { ROLE_LABELS } from '../../lib/roles'
import { initials } from '../../lib/format'

const SECTIONS = [
  { label: 'Main', items: [
    { to: '/app',             icon: '📊', label: 'Overview', end: true },
    { to: '/app/payments',    icon: '💳', label: 'Payments', badge: 'pending' },
    { to: '/app/clients',     icon: '👥', label: 'Clients' },
    { to: '/app/collections', icon: '⏰', label: 'Owing & defaulting' },
    { to: '/app/forms',       icon: '🔗', label: 'Client forms' },
  ]},
  { label: 'Directors', items: [
    { to: '/app/directors',  icon: '📈', label: 'Weekly summary', perm: 'viewReports' },
    { to: '/app/properties', icon: '🏘️', label: 'Properties', perm: 'manageProperties' },
    { to: '/app/templates',  icon: '📄', label: 'Document templates', perm: 'manageProperties' },
    { to: '/app/activity',   icon: '🧾', label: 'Activity log', perm: 'viewActivity' },
  ]},
  { label: 'Account', items: [
    { to: '/app/team',     icon: '🧑‍🤝‍🧑', label: 'Team', perm: 'manageTeam' },
    { to: '/app/settings', icon: '⚙️', label: 'Settings' },
    { to: '/app/billing',  icon: '💼', label: 'Billing', perm: 'billing' },
  ]},
]

export default function Sidebar({ open, onClose, pendingCount = 0 }) {
  const { signOut } = useAuth()
  const { org, member, role, can, memberships, switchOrg } = useOrg()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-screen w-64 lg:w-60 bg-navy2 border-r border-white/8 flex flex-col z-50
        transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Company */}
        <div className="px-4 py-4 border-b border-white/8 flex items-center gap-3">
          {org?.logo_url
            ? <img src={org.logo_url} alt="" className="w-9 h-9 rounded-lg object-contain bg-white/5 shrink-0" />
            : <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0" style={{ background: org?.brand_color || '#2563EB' }}>{initials(org?.name)}</div>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{org?.name}</p>
            {memberships.length > 1 ? (
              <select value={org?.id} onChange={e => { switchOrg(e.target.value); onClose?.() }}
                className="text-xs text-slate-400 bg-transparent outline-none cursor-pointer max-w-full [&>option]:bg-navy2">
                {memberships.map(m => <option key={m.organizations.id} value={m.organizations.id}>{m.organizations.name}</option>)}
              </select>
            ) : <p className="text-xs text-slate-500">Powered by DocuSend</p>}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {SECTIONS.map(section => {
            const items = section.items.filter(i => !i.perm || can(i.perm))
            if (!items.length) return null
            return (
              <div key={section.label} className="mb-2">
                <p className="px-3 py-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">{section.label}</p>
                {items.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}
                    className={({ isActive }) => `w-full flex items-center gap-2.5 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors mb-0.5
                      ${isActive ? 'bg-blue-600/15 text-white font-semibold' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge === 'pending' && pendingCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-black">{pendingCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/8">
          <NavLink to="/app/settings" onClick={onClose} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/4 hover:bg-white/8 transition-colors mb-1.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {initials(member?.full_name || member?.email)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{member?.full_name || member?.email}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </NavLink>
          <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <span>🚪</span> Log out
          </button>
        </div>
      </aside>
    </>
  )
}
