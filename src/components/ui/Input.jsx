import { useId, useState } from 'react'

const fieldClass = (error) => `w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none
  ${error ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'}`

function Label({ children, required, htmlFor }) {
  if (!children) return null
  return <label htmlFor={htmlFor} className="text-sm font-medium text-white">{children}{required && <span className="text-red-400"> *</span>}</label>
}

function Help({ error, hint }) {
  if (error) return <p className="text-xs text-red-400">{error}</p>
  if (hint)  return <p className="text-xs text-slate-500">{hint}</p>
  return null
}

export function Input({ label, error, type = 'text', hint, required, className = '', id, ...props }) {
  const autoId = useId()
  const fieldId = id || autoId
  const [showPw, setShowPw] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword && showPw ? 'text' : type

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label required={required} htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <input id={fieldId} type={inputType} required={required} className={`${fieldClass(error)} ${isPassword ? 'pr-11' : ''}`} {...props} />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-base"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? '🙈' : '👁'}
          </button>
        )}
      </div>
      <Help error={error} hint={hint} />
    </div>
  )
}

export function Select({ label, error, hint, required, children, className = '', id, ...props }) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label required={required} htmlFor={fieldId}>{label}</Label>
      <select id={fieldId} required={required} className={`${fieldClass(error)} cursor-pointer [&>option]:bg-navy2`} {...props}>
        {children}
      </select>
      <Help error={error} hint={hint} />
    </div>
  )
}

export function Textarea({ label, error, hint, required, className = '', rows = 3, id, ...props }) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label required={required} htmlFor={fieldId}>{label}</Label>
      <textarea id={fieldId} rows={rows} required={required} className={`${fieldClass(error)} resize-y`} {...props} />
      <Help error={error} hint={hint} />
    </div>
  )
}
