import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { atLeast, PERMISSIONS } from '../lib/roles'
import { useAuth } from './useAuth.jsx'

const OrgContext = createContext(null)
const STORAGE_KEY = 'docusend_org'

const readStored = () => { try { return localStorage.getItem(STORAGE_KEY) } catch { return null } }
const writeStored = v => { try { localStorage.setItem(STORAGE_KEY, v) } catch { /* private mode */ } }

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [orgId, setOrgId]   = useState(readStored)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const refresh = useCallback(async () => {
    if (!user) { setMemberships([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('members')
      .select('role, full_name, email, organizations(*)')
      .eq('user_id', user.id)
    if (error) setError(error.message)
    else { setError(null); setMemberships((data || []).filter(m => m.organizations)) }
    setLoading(false)
  }, [user])

  useEffect(() => { setLoading(true); refresh() }, [refresh])

  const current = memberships.find(m => m.organizations.id === orgId) || memberships[0] || null

  const switchOrg = useCallback(id => { setOrgId(id); writeStored(id) }, [])

  const value = useMemo(() => {
    const role = current?.role || null
    return {
      loading, error, memberships, refresh, switchOrg,
      org: current?.organizations || null,
      member: current,
      role,
      can: perm => !!role && atLeast(role, PERMISSIONS[perm] || perm),
    }
  }, [current, loading, error, memberships, refresh, switchOrg])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
