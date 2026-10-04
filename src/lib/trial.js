const DAY_MS = 24 * 60 * 60 * 1000

// Trials belong to the company and are set by the database (7 days)
export function trialDaysLeft(org) {
  if (!org?.trial_ends_at) return 0
  return Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / DAY_MS))
}

export const isTrialExpired = org => !!org?.trial_ends_at && new Date() > new Date(org.trial_ends_at)

export const PLANS = [
  { id: 'starter',    name: 'Starter',    price: '₦50,000',  period: 'setup + ₦15,000/mo' },
  { id: 'growth',     name: 'Growth',     price: '₦100,000', period: 'setup + ₦30,000/mo' },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom',   period: 'Talk to us' },
]
