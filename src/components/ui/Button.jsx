export function Button({ children, variant = 'primary', size = 'md', loading, disabled, onClick, type = 'button', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  const variants = {
    primary:   'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10',
    danger:    'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    ghost:     'hover:bg-white/5 text-slate-400 hover:text-white',
    outline:   'border border-white/20 hover:border-white/40 text-white',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {children}
        </>
      ) : children}
    </button>
  )
}
