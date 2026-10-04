import { Link } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { trialDaysLeft, isTrialExpired } from '../../lib/trial'

export default function TrialBanner() {
  const { org, can } = useOrg()
  if (!org) return null
  const daysLeft = trialDaysLeft(org)
  const expired  = isTrialExpired(org)
  const urgent   = expired || daysLeft <= 2

  return (
    <div className={`flex items-center justify-between gap-3 px-4 lg:px-7 py-2 border-b text-sm
      ${urgent ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-600/10 border-blue-600/20'}`}>
      <p className="min-w-0">
        {expired
          ? <span className="text-red-300 font-medium">Your free trial has ended.</span>
          : <><span className="font-medium">Free trial · </span>
              <span className={urgent ? 'text-red-300 font-bold' : 'text-blue-300 font-semibold'}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span></>}
      </p>
      {can('billing') && (
        <Link to="/app/billing" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md">Upgrade</Link>
      )}
    </div>
  )
}
