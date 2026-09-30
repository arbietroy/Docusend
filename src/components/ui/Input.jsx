import { useState } from 'react'

export function Input({ label, error, type = 'text', hint, ...props }) {
  const [showPw, setShowPw] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword && showPw ? 'text' : type

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-white">{label}</label>
      )}
      <div className="relative">
        <input
          type={inputType}
          className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors
            ${error ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'}
            outline-none`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-base"
          >
            {showPw ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Select({ label, error, children, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-white">{label}</label>}
      <select
        className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white outline-none transition-colors cursor-pointer
          ${error ? 'border-red-500' : 'border-white/10 focus:border-blue-500'}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
