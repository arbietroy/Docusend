import { Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { trialDaysLeft, isTrialExpired, PLANS } from '../../lib/trial'
import { fmtDate } from '../../lib/format'
import { CONTACT_EMAIL } from '../../lib/config'
import { Card, StatCard } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'

export default function Billing() {
  const { org, can } = useOrg()
  if (!can('billing')) return <Navigate to="/app" replace />
  const daysLeft = trialDaysLeft(org)
  const current = PLANS.find(p => p.id === org.plan) || PLANS[1]

  return (
    <div className="max-w-4xl space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Plan" value={current.name} sub={`${current.price} ${current.period}`} />
        <StatCard label={isTrialExpired(org) ? 'Trial ended' : 'Free trial'}
          value={isTrialExpired(org) ? fmtDate(org.trial_ends_at) : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
          sub={`Ends ${fmtDate(org.trial_ends_at)}`} tone={daysLeft <= 2 ? 'down' : 'neutral'} />
      </div>
      <Alert variant="info">
        Online subscription payments are coming soon.
        {CONTACT_EMAIL ? <> To upgrade now, email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : ' Your workspace keeps working in the meantime.'}
      </Alert>
      <Card title="Plans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(p => (
            <div key={p.id} className={`p-4 rounded-xl border ${p.id === current.id ? 'border-blue-500/40 bg-blue-600/6' : 'border-white/8'}`}>
              <p className={`text-sm font-bold mb-1 ${p.id === current.id ? 'text-blue-300' : ''}`}>{p.name}{p.id === current.id ? ' · current' : ''}</p>
              <p className="text-xl font-black">{p.price}</p>
              <p className="text-xs text-slate-400">{p.period}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
