export const TRIAL_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// The trial is anchored to the Supabase account's creation date, so it follows
// the user across devices and can't be reset by clearing browser storage.
export function getTrialEnd(user) {
  if (!user?.created_at) return null
  return new Date(new Date(user.created_at).getTime() + TRIAL_DAYS * DAY_MS)
}

export function getTrialDaysLeft(user) {
  const end = getTrialEnd(user)
  if (!end) return TRIAL_DAYS
  return Math.max(0, Math.ceil((end - new Date()) / DAY_MS))
}

export function isTrialActive(user) { return getTrialDaysLeft(user) > 0 }

export function isTrialExpired(user) {
  const end = getTrialEnd(user)
  return !!end && new Date() > end
}

export function getPlan(user) {
  return user?.user_metadata?.plan || 'growth'
}
