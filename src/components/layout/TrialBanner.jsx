import { getTrialDaysLeft, isTrialExpired } from '../../lib/trial'
import { Button } from '../ui/Button'

export default function TrialBanner({ onUpgrade }) {
  const daysLeft = getTrialDaysLeft()
  const expired  = isTrialExpired()

  if (!getTrialDaysLeft() && !expired) return null

  if (expired) {
    return (
      <div className="flex items-center justify-between gap-3 px-7 py-2.5 bg-red-500/10 border-b border-red-500/20 flex-wrap">
        <p className="text-sm text-red-300 font-medium">
          ⏰ Your free trial has ended. Upgrade to keep sending documents.
        </p>
        <Button size="sm" onClick={onUpgrade}>Upgrade now</Button>
      </div>
    )
  }

  const urgent = daysLeft <= 3
  return (
    <div className={`flex items-center justify-between gap-3 px-7 py-2.5 border-b flex-wrap
      ${urgent
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-blue-600/10 border-blue-600/20'
      }`}
    >
      <p className="text-sm">
        <span className="mr-2">🎁</span>
        <span className="font-medium text-white">Free trial — </span>
        <span className={urgent ? 'text-red-300 font-bold' : 'text-blue-300 font-semibold'}>
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
        </span>
        <span className="text-slate-400 ml-1.5">· Full access to all features</span>
      </p>
      <Button size="sm" onClick={onUpgrade}>Upgrade now</Button>
    </div>
  )
}
