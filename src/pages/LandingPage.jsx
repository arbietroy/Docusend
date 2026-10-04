import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONTACT_EMAIL } from '../lib/config'

export default function LandingPage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const steps = [
    { num:'01', icon:'⚙️', title:'Set up your products', desc:'Add your products, set prices, upload your document templates, and connect your Gmail. Takes less than 10 minutes.' },
    { num:'02', icon:'✅', title:'Confirm a payment',     desc:'When a client pays, their details land in your dashboard. You verify the bank transfer and click confirm — that is the only step you take.' },
    { num:'03', icon:'📨', title:'Documents deliver instantly', desc:'Contracts, receipts, and acknowledgement letters are generated, filled with the client\'s details, and sent to their email automatically.' },
  ]

  const features = [
    { icon:'📄', title:'Automatic document generation', desc:'Upload your templates once. Every time a payment is confirmed, DocuSend fills in the client\'s name, amount, date, product, and balance — and sends it instantly.' },
    { icon:'📦', title:'Multi-product support',          desc:'Manage unlimited products from one dashboard. Each product has its own price, template, and payment structure.' },
    { icon:'💳', title:'Installment tracking',           desc:'Track every installment per client. Running totals, outstanding balances, and full payment history — all automatic.' },
    { icon:'🏷️', title:'Promos and price updates',       desc:'Set a discounted price with a start and end date. When the promo expires, the original price kicks back in automatically.' },
    { icon:'📊', title:'Master Ledger',                  desc:'Every client, every payment, every document — tracked in one clean ledger. Filter by product, status, or date range. Export anytime.' },
    { icon:'🔔', title:'Bank alert integration',         desc:'Connect your bank alert emails and DocuSend can detect incoming transfers automatically — reducing confirmation time to near zero.' },
  ]

  const plans = [
    { name:'Starter',    price:'₦50,000',  period:'setup + ₦15,000/mo', features:['Up to 3 products','Up to 50 clients/month','Contract, Receipt & Acknowledgement','Installment tracking','Email support'],           btn:'Get started', featured:false },
    { name:'Growth',     price:'₦100,000', period:'setup + ₦30,000/mo', features:['Unlimited products','Unlimited clients','All document types','Promo and price management','Bank alert integration','Priority support'], btn:'Get started', featured:true,  badge:'Most popular' },
    { name:'Enterprise', price:'Custom',   period:'Setup fee + monthly', features:['Everything in Growth','Fully managed setup','Custom document design','Dedicated account manager','Monthly performance review','Staff training'], btn:'Talk to us',  featured:false },
  ]

  const eyebrow = 'text-xs font-semibold text-blue-600 tracking-wider uppercase mb-4'
  const h2      = 'text-[28px] sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-tight mb-4'
  const lead    = 'text-base text-slate-400 max-w-[520px] leading-relaxed mb-10 lg:mb-14'
  const btnPrimary   = 'bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 rounded-lg text-[15px] font-semibold transition-colors text-center'
  const btnSecondary = 'border border-white/20 hover:border-white/40 text-white px-7 py-3.5 rounded-lg text-[15px] font-medium transition-colors text-center'
  const navLinks = [['#how-it-works','How it works'],['#features','Features'],['#pricing','Pricing']]

  return (
    <div className="bg-navy text-white leading-relaxed overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-navy/85 backdrop-blur-md border-b border-white/8">
        <div className="flex items-center justify-between px-4 sm:px-[6%] py-4">
          <a href="/" className="text-[22px] font-extrabold">Docu<span className="text-blue-600">Send</span></a>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</a>
            ))}
            <button onClick={() => navigate('/auth?mode=login')} className="text-sm text-slate-300 hover:text-white">Sign in</button>
            <button onClick={() => navigate('/auth')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md text-sm font-semibold">Get started</button>
          </div>
          <div className="flex md:hidden items-center gap-2">
            <button onClick={() => navigate('/auth')} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold">Get started</button>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-lg"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/8 px-4 py-3 flex flex-col">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="py-3 text-base text-slate-300 border-b border-white/5">{label}</a>
            ))}
            <button onClick={() => navigate('/auth?mode=login')} className="py-3 text-left text-base text-slate-300">Sign in</button>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden min-h-0 lg:min-h-screen px-4 sm:px-[6%] pt-28 pb-16 lg:pt-36 lg:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] pointer-events-none" style={{ background:'radial-gradient(circle,rgba(37,99,235,0.15) 0%,transparent 70%)' }} />
        <div className="relative min-w-0">
          <div className="inline-flex items-center gap-2 bg-blue-600/12 border border-blue-600/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-400 mb-7">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full inline-block" style={{ animation:'pulse 2s infinite' }} />
            Now available for African businesses
          </div>
          <h1 className="text-[38px] sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-6">
            Stop sending documents <span className="text-blue-600">manually.</span>
          </h1>
          <p className="text-base sm:text-[17px] text-slate-400 leading-relaxed max-w-[480px] mb-10">
            DocuSend automates your entire payment-to-document workflow. A client pays, you confirm, and contracts, receipts, and letters go out instantly — without you lifting a finger.
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5">
            <button onClick={() => navigate('/auth')} className={btnPrimary}>Start your free trial</button>
            <a href="#how-it-works" className={btnSecondary}>See how it works</a>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:flex sm:gap-8 mt-12 pt-8 border-t border-white/8">
            {[['3 sec','Document delivery time'],['100%','Automated after confirmation'],['0','Manual errors']].map(([num, label]) => (
              <div key={label}>
                <div className="text-2xl sm:text-[28px] font-extrabold tracking-tight">{num}</div>
                <div className="text-xs text-slate-400 mt-0.5 leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative min-w-0 bg-navy2 border border-white/8 rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
          <div className="bg-white/3 px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
            {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background:c }} />)}
            <span className="text-xs text-slate-400 ml-2 truncate">DocuSend — Client Payments</span>
          </div>
          <div className="p-3 sm:p-5">
            <p className="text-[11px] font-semibold text-slate-400 tracking-wide mb-4 uppercase">Recent Payments</p>
            {[
              { initials:'AO', color:'#2563EB', name:'Adebayo Okafor',  sub:'Plot A3 · Initial Deposit',  amount:'₦1,000,000', status:'Sent',    sc:'#10B981' },
              { initials:'FN', color:'#7C3AED', name:'Fatima Nwosu',    sub:'Plot B7 · 2nd Installment',  amount:'₦500,000',   status:'Sent',    sc:'#10B981' },
              { initials:'KA', color:'#0891B2', name:'Kemi Adeyemi',    sub:'Plot C2 · Outright Payment', amount:'₦2,000,000', status:'Pending', sc:'#F59E0B' },
              { initials:'EM', color:'#DC2626', name:'Emeka Martins',   sub:'Apt 4B · Initial Deposit',   amount:'₦800,000',   status:'Confirm', sc:'#60A5FA' },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 sm:px-3.5 py-3 rounded-lg bg-white/3 mb-2 gap-2 sm:gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background:r.color }}>{r.initials}</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{r.sub}</p>
                  </div>
                </div>
                <span className="text-xs sm:text-[13px] font-semibold text-emerald-500 shrink-0">{r.amount}</span>
                <span className="hidden sm:inline text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0" style={{ background:`${r.sc}20`, color:r.sc }}>{r.status}</span>
              </div>
            ))}
            <div className="mt-4 p-3.5 bg-blue-600/8 rounded-lg border border-blue-600/20 flex justify-between items-center">
              <span className="text-xs text-blue-400 font-medium">Documents sent this month</span>
              <span className="text-xl font-extrabold">47</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS ── */}
      <div className="px-4 sm:px-[6%] py-10 border-y border-white/8 text-center">
        <p className="text-xs text-slate-400 mb-7">Trusted by businesses across Nigeria</p>
        <div className="flex justify-center gap-2.5 sm:gap-4 flex-wrap">
          {['Real Estate','Property Development','Financial Services','Retail','Cooperatives'].map(t => (
            <span key={t} className="bg-white/5 border border-white/8 px-4 sm:px-6 py-2 sm:py-2.5 rounded-md text-xs sm:text-[13px] font-semibold text-slate-400">{t}</span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="px-4 sm:px-[6%] py-16 lg:py-24 scroll-mt-16">
        <p className={eyebrow}>How it works</p>
        <h2 className={h2}>Three steps from payment to inbox</h2>
        <p className={lead}>DocuSend removes the manual work between receiving a payment and delivering professional documents.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 rounded-xl overflow-hidden">
          {steps.map((s, i) => (
            <div key={i} className="bg-navy2 px-6 py-8 lg:px-9 lg:py-10">
              <div className="text-5xl font-black text-blue-600/15 tracking-tight leading-none mb-6">{s.num}</div>
              <div className="w-11 h-11 rounded-[10px] bg-blue-600/12 border border-blue-600/20 flex items-center justify-center text-xl mb-5">{s.icon}</div>
              <h3 className="text-[17px] font-bold mb-2.5">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-4 sm:px-[6%] py-16 lg:py-24 bg-navy2 scroll-mt-16">
        <p className={eyebrow}>Features</p>
        <h2 className={h2}>Everything your business needs</h2>
        <p className={lead}>Built for businesses that collect payments and need to move fast without sacrificing professionalism.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
          {features.map((f, i) => (
            <div key={i} className="bg-navy hover:bg-[#0D1E36] transition-colors p-6 lg:p-10">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-[22px] mb-5">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2.5">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="px-4 sm:px-[6%] py-16 lg:py-24 scroll-mt-16">
        <p className={eyebrow}>Pricing</p>
        <h2 className={h2}>Simple, honest pricing</h2>
        <p className={lead}>Start with a one-time setup and pay monthly. No hidden fees, no contracts.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-5">
          {plans.map((p, i) => (
            <div key={i} className={`relative rounded-xl p-7 lg:p-9 border ${p.featured ? 'bg-blue-600 border-blue-600' : 'bg-navy2 border-white/8'}`}>
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[11px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">{p.badge}</div>
              )}
              <p className={`text-xs font-semibold tracking-wide mb-4 ${p.featured ? 'text-white/70' : 'text-slate-400'}`}>{p.name}</p>
              <p className="text-4xl font-black tracking-tight mb-1">{p.price}</p>
              <p className={`text-[13px] mb-7 ${p.featured ? 'text-white/70' : 'text-slate-400'}`}>{p.period}</p>
              <div className={`h-px mb-6 ${p.featured ? 'bg-white/15' : 'bg-white/8'}`} />
              <ul className="mb-8">
                {p.features.map(f => (
                  <li key={f} className={`text-sm py-1.5 flex items-center gap-2.5 ${p.featured ? 'text-white/85' : 'text-slate-400'}`}>
                    <span className={`font-bold ${p.featured ? 'text-white' : 'text-emerald-500'}`}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => p.name === 'Enterprise' && CONTACT_EMAIL
                  ? (window.location.href = `mailto:${CONTACT_EMAIL}?subject=DocuSend%20Enterprise`)
                  : navigate('/auth')}
                className={`block w-full text-center py-3.5 rounded-lg text-sm font-semibold transition-colors
                  ${p.featured ? 'bg-white text-blue-600 hover:bg-white/90' : 'border border-white/20 hover:border-white/40 text-white'}`}
              >{p.btn}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden px-4 sm:px-[6%] py-16 lg:py-24 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none" style={{ background:'radial-gradient(ellipse,rgba(37,99,235,0.12) 0%,transparent 70%)' }} />
        <h2 className="relative text-[32px] sm:text-4xl lg:text-[52px] font-black tracking-tight leading-[1.1] mb-5">
          Your next client deserves a faster response.
        </h2>
        <p className="relative text-base sm:text-[17px] text-slate-400 mb-10 max-w-[480px] mx-auto">
          Set up DocuSend in under 10 minutes and never manually send a document again.
        </p>
        <div className="relative flex flex-col sm:flex-row gap-3.5 justify-center">
          <button onClick={() => navigate('/auth')} className={btnPrimary}>Start your free trial</button>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}?subject=DocuSend%20demo`} className={btnSecondary}>Book a demo</a>}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-4 sm:px-[6%] py-10 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
        <a href="/" className="text-lg font-extrabold">Docu<span className="text-blue-600">Send</span></a>
        <div className="flex gap-5 sm:gap-7 flex-wrap justify-center">
          {['Privacy Policy','Terms of Service','Contact'].map(l => (
            <a key={l} href="#" className="text-[13px] text-slate-400 hover:text-white">{l}</a>
          ))}
        </div>
        <p className="text-xs text-slate-400">© 2026 DocuSend. All rights reserved.</p>
      </footer>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
