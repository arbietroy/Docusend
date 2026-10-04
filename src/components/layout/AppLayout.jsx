import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TrialBanner from './TrialBanner'
import { useOrg } from '../../hooks/useOrg.jsx'
import { supabase } from '../../lib/supabase'
import { Loading } from '../ui/Data'

const TITLES = {
  '/app': 'Overview', '/app/payments': 'Payments', '/app/clients': 'Clients', '/app/clients/new': 'Add client',
  '/app/collections': 'Owing & defaulting', '/app/forms': 'Client forms', '/app/directors': 'Weekly summary',
  '/app/properties': 'Properties', '/app/properties/new': 'New property', '/app/activity': 'Activity log',
  '/app/team': 'Team', '/app/settings': 'Settings', '/app/billing': 'Billing',
}

export default function AppLayout() {
  const { org, loading, error } = useOrg()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [tick, setTick] = useState(0)
  const { pathname } = useLocation()

  // Refresh the "awaiting confirmation" badge whenever the page changes
  useEffect(() => {
    if (!org) return
    supabase.from('payments').select('id', { count: 'exact', head: true })
      .eq('org_id', org.id).eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0))
  }, [org, pathname, tick])

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  if (loading) return <div className="min-h-screen bg-navy"><Loading /></div>
  if (error) return <div className="min-h-screen bg-navy p-6 text-red-300 text-sm">Couldn't load your workspace: {error}</div>
  if (!org) return <Navigate to="/onboarding" replace />

  const title = TITLES[pathname] || (pathname.startsWith('/app/clients/') ? 'Client' : pathname.startsWith('/app/properties/') ? 'Property' : '')

  return (
    <div className="flex min-h-screen bg-navy">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} pendingCount={pendingCount} />
      <div className="flex-1 min-w-0 lg:ml-60 flex flex-col">
        <TrialBanner />
        <header className="sticky top-0 z-30 h-14 lg:h-16 px-4 lg:px-7 bg-navy/90 backdrop-blur-md border-b border-white/8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open menu"
              className="lg:hidden w-9 h-9 shrink-0 rounded-lg bg-white/6 border border-white/8 flex items-center justify-center text-lg">☰</button>
            <h1 className="text-base font-bold truncate">{title}</h1>
          </div>
          <Link to="/app/clients/new" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg">+ Add client</Link>
        </header>
        <main className="flex-1 p-4 lg:p-7 max-w-[1400px] w-full">
          <Outlet context={{ refreshPending: () => setTick(t => t + 1) }} />
        </main>
      </div>
    </div>
  )
}
