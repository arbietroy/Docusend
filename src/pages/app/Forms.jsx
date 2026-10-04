import { useState } from 'react'
import { useOrg } from '../../hooks/useOrg.jsx'
import { Card, PageHeader } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'

export default function Forms() {
  const { org, can } = useOrg()
  const base = `${window.location.origin}/f/${org.slug}`
  const forms = [
    { icon: '📝', title: 'Subscription form', url: base,
      desc: 'For new purchases. The client fills in their details, next of kin, the property and plan, their realtor, and uploads proof of their first payment.' },
    { icon: '💳', title: 'Instalment payment form', url: `${base}/pay`,
      desc: 'For existing clients paying an instalment. They enter their client number and the email or phone on file, then upload proof of payment.' },
  ]
  return (
    <div className="max-w-3xl">
      <PageHeader subtitle="Share these links with clients by WhatsApp, email or on your website. Everything they submit lands in Payments for confirmation." />
      {!org.account_number && (
        <div className="mb-4"><Alert variant="warning">
          Your bank details aren't set yet, so clients won't see where to pay. {can('companySettings') ? 'Add them in Settings → Company.' : 'Ask an admin to add them in Settings.'}
        </Alert></div>
      )}
      <div className="space-y-4">
        {forms.map(f => <FormCard key={f.url} {...f} orgName={org.name} />)}
      </div>
    </div>
  )
}

function FormCard({ icon, title, desc, url, orgName }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { window.prompt('Copy this link:', url) }
  }
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${orgName}: ${title}\n${url}`)}`
  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">{icon}</div>
        <div className="min-w-0">
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-300 break-all mb-3">{url}</div>
      <div className="flex flex-wrap gap-2">
        <button onClick={copy} className="text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">{copied ? '✓ Copied' : 'Copy link'}</button>
        <a href={whatsapp} target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-2 rounded-lg bg-green-600/20 text-green-300 border border-green-600/30">Share on WhatsApp</a>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10">Open form ↗</a>
      </div>
    </Card>
  )
}
