import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, needsOnboarding } from './hooks/useAuth.jsx'

// Pages
import LandingPage   from './pages/LandingPage'
import AuthPage      from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0A1628' }}>
      <div style={{ color:'#94A3B8', fontSize:14 }}>Loading...</div>
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  if (needsOnboarding(user)) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/auth"      element={<AuthPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
