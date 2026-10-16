import { useState } from 'react'

// Single-series column chart: thin rounded bars on a baseline, the top value
// marked on a gridline, and a tooltip on hover/tap. The table underneath is for
// screen readers.
export default function BarChart({ data, format = v => v, title, height = 160 }) {
  const [active, setActive] = useState(null)
  const max = Math.max(...data.map(d => d.value), 0)

  return (
    <figure>
      {title && <figcaption className="text-sm font-bold mb-3">{title}</figcaption>}
      <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
        {/* recessive gridline at the top value */}
        {max > 0 && (
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/8">
            <span className="absolute right-0 -top-4 text-[10px] text-slate-500">{format(max)}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-white/15" aria-hidden="true">
          {data.map((d, i) => (
            <button key={d.label} type="button" tabIndex={-1}
              onMouseEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)}
              className="relative flex-1 h-full flex items-end justify-center group">
              <span className={`block w-full max-w-[28px] rounded-t-[4px] transition-colors ${active === i ? 'bg-blue-400' : 'bg-blue-500'}`}
                style={{ height: `${max ? Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0) : 0}%` }} />
            </button>
          ))}
        </div>
        {active != null && (
          <div className="absolute z-10 top-2 pointer-events-none bg-navy border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl whitespace-nowrap"
            style={{ left: `${((active + 0.5) / data.length) * 100}%`, transform: `translateX(${active > data.length / 2 ? '-105%' : '5%'})` }}>
            <p className="text-slate-400">{data[active].fullLabel || data[active].label}</p>
            <p className="font-bold text-white">{format(data[active].value)}</p>
            {data[active].sub && <p className="text-slate-400">{data[active].sub}</p>}
          </div>
        )}
      </div>
      <div className="flex gap-[2px] mt-1.5" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.label} className={`flex-1 text-center text-[10px] text-slate-500 ${i % 2 ? 'hidden sm:block' : ''}`}>{d.label}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{data.map(d => <tr key={d.label}><th>{d.fullLabel || d.label}</th><td>{format(d.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
