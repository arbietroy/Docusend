export const TRIAL_DAYS = 14

export function getTrialData() {
  try {
    const raw = localStorage.getItem('docusend_trial')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setTrialData(plan = 'growth', businessName = '') {
  const now = new Date()
  const end = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const data = { plan, businessName, startDate: now.toISOString(), endDate: end.toISOString() }
  localStorage.setItem('docusend_trial', JSON.stringify(data))
  return data
}

export function getTrialDaysLeft() {
  const trial = getTrialData()
  if (!trial) return TRIAL_DAYS
  const msLeft = new Date(trial.endDate) - new Date()
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
}

export function isTrialActive() { return getTrialDaysLeft() > 0 }
export function isTrialExpired() {
  const trial = getTrialData()
  if (!trial) return false
  return new Date() > new Date(trial.endDate)
}
