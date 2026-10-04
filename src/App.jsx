import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { OrgProvider } from './hooks/useOrg.jsx'
import AppLayout from './components/layout/AppLayout'
import { Loading } from './components/ui/Data'

import LandingPage    from './pages/LandingPage'
import AuthPage       from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import { SubscribeForm, PayForm } from './pages/public/PublicForms'
import Overview     from './pages/app/Overview'
import Payments     from './pages/app/Payments'
import Clients      from './pages/app/Clients'
import NewClient    from './pages/app/NewClient'
import ClientDetail from './pages/app/ClientDetail'
import Collections  from './pages/app/Collections'
import Forms        from './pages/app/Forms'
import Properties, { PropertyDetail, NewProperty } from './pages/app/Properties'
import Directors    from './pages/app/Directors'
import Activity     from './pages/app/Activity'
import Team         from './pages/app/Team'
import Settings     from './pages/app/Settings'
import Billing      from './pages/app/Billing'

function RequireUser({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-navy"><Loading /></div>
  if (!user) return <Navigate to="/auth?mode=login" replace />
  return <OrgProvider>{children}</OrgProvider>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"     element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Public client forms: no login */}
        <Route path="/f/:slug"     element={<SubscribeForm />} />
        <Route path="/f/:slug/pay" element={<PayForm />} />

        <Route path="/onboarding" element={<RequireUser><OnboardingPage /></RequireUser>} />
        <Route path="/app" element={<RequireUser><AppLayout /></RequireUser>}>
          <Route index                  element={<Overview />} />
          <Route path="payments"        element={<Payments />} />
          <Route path="clients"         element={<Clients />} />
          <Route path="clients/new"     element={<NewClient />} />
          <Route path="clients/:id"     element={<ClientDetail />} />
          <Route path="collections"     element={<Collections />} />
          <Route path="forms"           element={<Forms />} />
          <Route path="properties"      element={<Properties />} />
          <Route path="properties/new"  element={<NewProperty />} />
          <Route path="properties/:id"  element={<PropertyDetail />} />
          <Route path="directors"       element={<Directors />} />
          <Route path="activity"        element={<Activity />} />
          <Route path="team"            element={<Team />} />
          <Route path="settings"        element={<Settings />} />
          <Route path="billing"         element={<Billing />} />
        </Route>

        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
