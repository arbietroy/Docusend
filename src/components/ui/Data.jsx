import { Link } from 'react-router-dom'
import { Badge } from './Badge'
import { PAYMENT_STATUS } from '../../lib/format'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        {title && <h2 className="text-lg font-bold">{title}</h2>}
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-navy2 border border-white/8 rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
          {title && <h3 className="text-sm font-bold">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function StatCard({ label, value, sub, tone = 'neutral', to }) {
  const tones = { up: 'text-green-400', down: 'text-red-400', warn: 'text-amber-400', neutral: 'text-slate-400' }
  const body = (
    <>
      <p className="text-xs text-slate-400 font-medium mb-2">{label}</p>
      <p className="text-2xl sm:text-[28px] font-black tracking-tight leading-none mb-1.5 truncate">{value}</p>
      {sub && <p className={`text-xs ${tones[tone]}`}>{sub}</p>}
    </>
  )
  const cls = 'block bg-navy2 border border-white/8 rounded-xl p-4 sm:p-5 min-w-0'
  return to ? <Link to={to} className={`${cls} hover:border-blue-600/40 transition-colors`}>{body}</Link> : <div className={cls}>{body}</div>
}

export function Table({ headers, children, empty }) {
  return (
    <div className="bg-navy2 border border-white/8 rounded-xl overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/8">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 text-sm border-b border-white/4 whitespace-nowrap ${className}`}>{children}</td>
}

export function EmptyState({ icon = '📭', title, children, action }) {
  return (
    <div className="text-center px-6 py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold mb-1">{title}</p>
      {children && <p className="text-sm text-slate-400 max-w-sm mx-auto mb-4">{children}</p>}
      {action}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 text-sm flex items-center justify-between gap-3">
      <span>{error.message || String(error)}</span>
      {onRetry && <button onClick={onRetry} className="underline shrink-0">Try again</button>}
    </div>
  )
}

export function StatusBadge({ status }) {
  const s = PAYMENT_STATUS[status] || { short: status, variant: 'slate' }
  return <Badge variant={s.variant}>{s.short}</Badge>
}

export function Progress({ value, max, className = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`h-1.5 bg-white/8 rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto mb-4 -mx-1 px-1">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border
            ${value === t.id ? 'bg-blue-600/15 border-blue-500/40 text-white' : 'border-white/8 text-slate-400 hover:text-white'}`}>
          {t.label}{t.count != null && <span className="ml-1.5 text-xs opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm break-words">{children || '—'}</p>
    </div>
  )
}
