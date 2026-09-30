import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

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

  const testimonials = [
    { quote:'"Before DocuSend, sending contracts took us two to three days per client. Now it happens in seconds."', name:'Tunde Oladele',  title:'MD, Apex Properties Ltd',  initials:'TO', color:'#2563EB' },
    { quote:'"We were losing clients because our documentation was slow. DocuSend fixed that completely."',           name:'Amaka Nwofor',  title:'CEO, GreenHaven Realty',    initials:'AN', color:'#7C3AED' },
    { quote:'"The installment tracking alone is worth every naira. All my client payment history in one place."',    name:'Blessing Kalu', title:'Director, Sunrise Homes',   initials:'BK', color:'#0891B2' },
  ]

  const plans = [
    { name:'Starter',    price:'₦50,000',  period:'setup + ₦15,000/mo', features:['Up to 3 products','Up to 50 clients/month','Contract, Receipt & Acknowledgement','Installment tracking','Email support'],           btn:'Get started', featured:false },
    { name:'Growth',     price:'₦100,000', period:'setup + ₦30,000/mo', features:['Unlimited products','Unlimited clients','All document types','Promo and price management','Bank alert integration','Priority support'], btn:'Get started', featured:true,  badge:'Most popular' },
    { name:'Enterprise', price:'Custom',   period:'Setup fee + monthly', features:['Everything in Growth','Fully managed setup','Custom document design','Dedicated account manager','Monthly performance review','Staff training'], btn:'Talk to us',  featured:false },
  ]

  return (
    <div style={{ fontFamily:'Inter,sans-serif', background:'#0A1628', color:'#fff', lineHeight:'1.6' }}>

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, padding:'18px 6%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(10,22,40,0.85)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" style={{ fontSize:22, fontWeight:800, color:'#fff', textDecoration:'none' }}>
          Docu<span style={{ color:'#2563EB' }}>Send</span>
        </a>
        <div style={{ display:'flex', alignItems:'center', gap:32 }}>
          <a href="#how-it-works" style={{ color:'#94A3B8', fontSize:14, textDecoration:'none' }}>How it works</a>
          <a href="#features"     style={{ color:'#94A3B8', fontSize:14, textDecoration:'none' }}>Features</a>
          <a href="#pricing"      style={{ color:'#94A3B8', fontSize:14, textDecoration:'none' }}>Pricing</a>
          <button onClick={() => navigate('/auth')} style={{ background:'#2563EB', color:'#fff', border:'none', padding:'10px 22px', borderRadius:6, fontSize:14, fontWeight:600, cursor:'pointer' }}>
            Get started
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight:'100vh', padding:'140px 6% 100px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:60, alignItems:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-200, right:-200, width:700, height:700, background:'radial-gradient(circle,rgba(37,99,235,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.3)', padding:'6px 14px', borderRadius:100, fontSize:12, fontWeight:600, color:'#60A5FA', marginBottom:28 }}>
            <span style={{ width:6, height:6, background:'#60A5FA', borderRadius:'50%', animation:'pulse 2s infinite', display:'inline-block' }} />
            Now available for African businesses
          </div>
          <h1 style={{ fontSize:'clamp(38px,5vw,60px)', fontWeight:900, lineHeight:1.08, letterSpacing:-2, marginBottom:24 }}>
            Stop sending documents <span style={{ color:'#2563EB' }}>manually.</span>
          </h1>
          <p style={{ fontSize:17, color:'#94A3B8', lineHeight:1.7, maxWidth:480, marginBottom:40 }}>
            DocuSend automates your entire payment-to-document workflow. A client pays, you confirm, and contracts, receipts, and letters go out instantly — without you lifting a finger.
          </p>
          <div style={{ display:'flex', gap:14 }}>
            <button onClick={() => navigate('/auth')} style={{ background:'#2563EB', color:'#fff', border:'none', padding:'14px 28px', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer' }}>
              Start your free trial
            </button>
            <a href="#how-it-works" style={{ background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', padding:'14px 28px', borderRadius:8, fontSize:15, fontWeight:500, textDecoration:'none' }}>
              See how it works
            </a>
          </div>
          <div style={{ display:'flex', gap:32, marginTop:52, paddingTop:32, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
            {[['3 sec','Document delivery time'],['100%','Automated after confirmation'],['0','Manual errors']].map(([num, label]) => (
              <div key={label}>
                <div style={{ fontSize:28, fontWeight:800, letterSpacing:-1 }}>{num}</div>
                <div style={{ fontSize:12, color:'#94A3B8', marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div style={{ background:'#111F3A', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, overflow:'hidden', boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ background:'rgba(255,255,255,0.03)', padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:8 }}>
            {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }} />)}
            <span style={{ fontSize:12, color:'#94A3B8', marginLeft:8 }}>DocuSend — Client Payments</span>
          </div>
          <div style={{ padding:20 }}>
            <p style={{ fontSize:11, fontWeight:600, color:'#94A3B8', letterSpacing:0.5, marginBottom:16, textTransform:'uppercase' }}>Recent Payments</p>
            {[
              { initials:'AO', color:'#2563EB', name:'Adebayo Okafor',  sub:'Plot A3 · Initial Deposit',  amount:'₦1,000,000', status:'Sent',    sc:'#10B981' },
              { initials:'FN', color:'#7C3AED', name:'Fatima Nwosu',    sub:'Plot B7 · 2nd Installment',  amount:'₦500,000',   status:'Sent',    sc:'#10B981' },
              { initials:'KA', color:'#0891B2', name:'Kemi Adeyemi',    sub:'Plot C2 · Outright Payment', amount:'₦2,000,000', status:'Pending', sc:'#F59E0B' },
              { initials:'EM', color:'#DC2626', name:'Emeka Martins',   sub:'Apt 4B · Initial Deposit',   amount:'₦800,000',   status:'Confirm', sc:'#60A5FA' },
            ].map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:8, background:'rgba(255,255,255,0.03)', marginBottom:8, gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{r.initials}</div>
                  <div><p style={{ fontSize:13, fontWeight:500 }}>{r.name}</p><p style={{ fontSize:11, color:'#94A3B8' }}>{r.sub}</p></div>
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'#10B981' }}>{r.amount}</span>
                <span style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:100, background:`${r.sc}20`, color:r.sc }}>{r.status}</span>
              </div>
            ))}
            <div style={{ marginTop:16, padding:14, background:'rgba(37,99,235,0.08)', borderRadius:8, border:'1px solid rgba(37,99,235,0.2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'#60A5FA', fontWeight:500 }}>Documents sent this month</span>
              <span style={{ fontSize:20, fontWeight:800 }}>47</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS ── */}
      <div style={{ padding:'40px 6%', borderTop:'1px solid rgba(255,255,255,0.08)', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'center' }}>
        <p style={{ fontSize:12, color:'#94A3B8', marginBottom:28 }}>Trusted by businesses across Nigeria</p>
        <div style={{ display:'flex', justifyContent:'center', gap:16, flexWrap:'wrap' }}>
          {['Real Estate','Property Development','Financial Services','Retail','Cooperatives'].map(t => (
            <span key={t} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', padding:'10px 24px', borderRadius:6, fontSize:13, fontWeight:600, color:'#94A3B8' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding:'100px 6%' }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#2563EB', letterSpacing:1, marginBottom:16, textTransform:'uppercase' }}>How it works</p>
        <h2 style={{ fontSize:'clamp(28px,3.5vw,42px)', fontWeight:800, letterSpacing:-1.5, marginBottom:16 }}>Three steps from payment to inbox</h2>
        <p style={{ fontSize:16, color:'#94A3B8', maxWidth:520, lineHeight:1.7, marginBottom:60 }}>DocuSend removes the manual work between receiving a payment and delivering professional documents.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ padding:'40px 36px', background:'#111F3A', borderRadius: i === 0 ? '12px 0 0 12px' : i === 2 ? '0 12px 12px 0' : 0 }}>
              <div style={{ fontSize:48, fontWeight:900, color:'rgba(37,99,235,0.15)', letterSpacing:-2, lineHeight:1, marginBottom:24 }}>{s.num}</div>
              <div style={{ width:44, height:44, borderRadius:10, background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:20 }}>{s.icon}</div>
              <h3 style={{ fontSize:17, fontWeight:700, marginBottom:10 }}>{s.title}</h3>
              <p style={{ fontSize:14, color:'#94A3B8', lineHeight:1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:'100px 6%', background:'#111F3A' }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#2563EB', letterSpacing:1, marginBottom:16, textTransform:'uppercase' }}>Features</p>
        <h2 style={{ fontSize:'clamp(28px,3.5vw,42px)', fontWeight:800, letterSpacing:-1.5, marginBottom:16 }}>Everything your business needs</h2>
        <p style={{ fontSize:16, color:'#94A3B8', maxWidth:520, lineHeight:1.7, marginBottom:60 }}>Built for businesses that collect payments and need to move fast without sacrificing professionalism.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:2 }}>
          {features.map((f, i) => (
            <div key={i} style={{ padding:40, background:'#0A1628', transition:'background 0.2s', cursor:'default',
              borderRadius: i===0?'12px 0 0 0':i===1?'0 12px 0 0':i===4?'0 0 0 12px':i===5?'0 0 12px 0':0 }}
              onMouseEnter={e => e.currentTarget.style.background='#0D1E36'}
              onMouseLeave={e => e.currentTarget.style.background='#0A1628'}
            >
              <div style={{ width:48, height:48, borderRadius:12, background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:20 }}>{f.icon}</div>
              <h3 style={{ fontSize:18, fontWeight:700, marginBottom:10 }}>{f.title}</h3>
              <p style={{ fontSize:14, color:'#94A3B8', lineHeight:1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding:'100px 6%' }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#2563EB', letterSpacing:1, marginBottom:16, textTransform:'uppercase' }}>Pricing</p>
        <h2 style={{ fontSize:'clamp(28px,3.5vw,42px)', fontWeight:800, letterSpacing:-1.5, marginBottom:16 }}>Simple, honest pricing</h2>
        <p style={{ fontSize:16, color:'#94A3B8', maxWidth:520, lineHeight:1.7, marginBottom:60 }}>Start with a one-time setup and pay monthly. No hidden fees, no contracts.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
          {plans.map((p, i) => (
            <div key={i} style={{ background: p.featured ? '#2563EB' : '#111F3A', border:`1px solid ${p.featured ? '#2563EB' : 'rgba(255,255,255,0.08)'}`, borderRadius:12, padding:36, position:'relative' }}>
              {p.badge && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#10B981', color:'#fff', fontSize:11, fontWeight:700, padding:'4px 14px', borderRadius:100, whiteSpace:'nowrap' }}>{p.badge}</div>
              )}
              <p style={{ fontSize:12, fontWeight:600, color: p.featured ? 'rgba(255,255,255,0.7)' : '#94A3B8', letterSpacing:0.5, marginBottom:16 }}>{p.name}</p>
              <p style={{ fontSize:36, fontWeight:900, letterSpacing:-1.5, marginBottom:4 }}>{p.price}</p>
              <p style={{ fontSize:13, color: p.featured ? 'rgba(255,255,255,0.7)' : '#94A3B8', marginBottom:28 }}>{p.period}</p>
              <div style={{ height:1, background: p.featured ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', marginBottom:24 }} />
              <ul style={{ listStyle:'none', marginBottom:32 }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize:14, color: p.featured ? 'rgba(255,255,255,0.85)' : '#94A3B8', padding:'7px 0', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ color: p.featured ? '#fff' : '#10B981', fontWeight:700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/auth')}
                style={{ display:'block', width:'100%', textAlign:'center', padding:13, borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', border: p.featured ? 'none' : '1px solid rgba(255,255,255,0.2)', background: p.featured ? '#fff' : 'transparent', color: p.featured ? '#2563EB' : '#fff', transition:'all 0.2s' }}
              >{p.btn}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'100px 6%', background:'#111F3A' }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#2563EB', letterSpacing:1, marginBottom:16, textTransform:'uppercase' }}>What our clients say</p>
        <h2 style={{ fontSize:'clamp(28px,3.5vw,42px)', fontWeight:800, letterSpacing:-1.5, marginBottom:60 }}>Built on real results</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{ background:'#0A1628', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:32 }}>
              <p style={{ fontSize:15, color:'#94A3B8', lineHeight:1.7, marginBottom:24, fontStyle:'italic' }}>{t.quote}</p>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:t.color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0 }}>{t.initials}</div>
                <div>
                  <p style={{ fontSize:14, fontWeight:600 }}>{t.name}</p>
                  <p style={{ fontSize:12, color:'#94A3B8' }}>{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:'100px 6%', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:800, height:400, background:'radial-gradient(ellipse,rgba(37,99,235,0.12) 0%,transparent 70%)', pointerEvents:'none' }} />
        <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, letterSpacing:-2, lineHeight:1.1, marginBottom:20, position:'relative' }}>
          Your next client deserves a faster response.
        </h2>
        <p style={{ fontSize:17, color:'#94A3B8', marginBottom:40, maxWidth:480, marginLeft:'auto', marginRight:'auto', position:'relative' }}>
          Set up DocuSend in under 10 minutes and never manually send a document again.
        </p>
        <div style={{ display:'flex', gap:14, justifyContent:'center', position:'relative' }}>
          <button onClick={() => navigate('/auth')} style={{ background:'#2563EB', color:'#fff', border:'none', padding:'14px 28px', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer' }}>Start your free trial</button>
          <button style={{ background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', padding:'14px 28px', borderRadius:8, fontSize:15, fontWeight:500, cursor:'pointer' }}>Book a demo</button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding:'40px 6%', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <a href="/" style={{ fontSize:18, fontWeight:800, textDecoration:'none', color:'#fff' }}>Docu<span style={{ color:'#2563EB' }}>Send</span></a>
        <div style={{ display:'flex', gap:28 }}>
          {['Privacy Policy','Terms of Service','Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize:13, color:'#94A3B8', textDecoration:'none' }}>{l}</a>
          ))}
        </div>
        <p style={{ fontSize:12, color:'#94A3B8' }}>© 2026 DocuSend. All rights reserved.</p>
      </footer>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
