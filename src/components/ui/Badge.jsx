export function Badge({ children, variant = 'blue' }) {
  const variants = {
    green:  'bg-green-500/10 text-green-400',
    amber:  'bg-amber-500/10 text-amber-400',
    blue:   'bg-blue-500/10 text-blue-400',
    red:    'bg-red-500/10 text-red-400',
    slate:  'bg-white/5 text-slate-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function Alert({ children, variant = 'error' }) {
  if (!children) return null
  const variants = {
    error:   'bg-red-500/10 border-red-500/20 text-red-300',
    success: 'bg-green-500/10 border-green-500/20 text-green-300',
    info:    'bg-blue-500/10 border-blue-500/20 text-blue-300',
  }
  return (
    <div className={`px-4 py-3 rounded-lg border text-sm leading-relaxed ${variants[variant]}`}>
      {children}
    </div>
  )
}

export function Modal({ isOpen, onClose, title, subtitle, children }) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111F3A] border border-white/10 rounded-2xl w-full max-w-md p-7 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-white text-xl leading-none">✕</button>
        {title    && <h2 className="text-lg font-bold mb-1">{title}</h2>}
        {subtitle && <p className="text-sm text-slate-400 mb-6 leading-relaxed">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
